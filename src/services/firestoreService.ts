import {
  Timestamp,
  addDoc,
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  updateDoc,
  where,
  writeBatch,
  type DocumentData,
  type FirestoreError,
  type QueryConstraint
} from 'firebase/firestore';
import { getDownloadURL, ref, uploadBytes } from 'firebase/storage';
import Papa from 'papaparse';
import { db, storage } from '../lib/firebase';
import { accountDelta, validateDoubleEntry } from '../lib/doubleEntry';
import { monthKey } from '../lib/format';
import type { Account, Bookmark, Budget, DashboardMetrics, Debt, NewTransaction, RecurringTransaction, Sip, Transaction, UserSettings } from '../types';

const path = (uid: string, name: string) => collection(db, 'users', uid, name);
const userRef = (uid: string) => doc(db, 'users', uid);

function withId<T>(docSnap: DocumentData): T {
  return { id: docSnap.id, ...docSnap.data() } as T;
}

function withoutUndefined<T extends Record<string, unknown>>(value: T) {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined));
}

export function listenUserSettings(uid: string, callback: (settings: UserSettings) => void) {
  return onSnapshot(userRef(uid), (snap) => callback(snap.data()?.settings), snapshotError);
}

export async function updateSettings(uid: string, settings: Partial<UserSettings>) {
  const fieldUpdates = Object.fromEntries(
    Object.entries(settings).map(([key, value]) => [`settings.${key}`, value === undefined ? deleteField() : value])
  );

  await updateDoc(userRef(uid), {
    ...fieldUpdates,
    updatedAt: serverTimestamp()
  });
}

export function listenAccounts(uid: string, callback: (accounts: Account[]) => void, onError: (error: FirestoreError) => void = snapshotError) {
  const q = query(path(uid, 'accounts'), orderBy('createdAt', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map(withId<Account>)), onError);
}

export async function createAccount(uid: string, account: Omit<Account, 'id'>) {
  await addDoc(path(uid, 'accounts'), {
    ...account,
    archived: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export async function updateAccount(uid: string, account: Account) {
  const { id, createdAt, ...accountData } = account;
  await updateDoc(doc(db, 'users', uid, 'accounts', id), withoutUndefined({
    ...accountData,
    createdAt,
    updatedAt: serverTimestamp()
  }));
}

export async function seedDefaultAccounts(uid: string, currency = 'USD') {
  const existing = await getDocs(path(uid, 'accounts'));
  if (!existing.empty) return;

  const batch = writeBatch(db);
  [
    { name: 'Cash', type: 'cash', balance: 0 },
    { name: 'Bank', type: 'bank', balance: 0 },
    { name: 'Credit Card', type: 'credit', balance: 0, billingCycleDay: 1, dueDay: 20, creditLimit: 1000 },
    { name: 'Salary', type: 'income', balance: 0 },
    { name: 'Food', type: 'expense', balance: 0 },
    { name: 'Transfer Clearing', type: 'equity', balance: 0 }
  ].forEach((account) => {
    batch.set(doc(path(uid, 'accounts')), {
      ...account,
      currency,
      archived: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });

  await batch.commit();
}

export function listenTransactions(uid: string, callback: (transactions: Transaction[]) => void, constraints: QueryConstraint[] = [], onError: (error: FirestoreError) => void = snapshotError) {
  const q = query(path(uid, 'transactions'), ...constraints, orderBy('date', 'desc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map(withId<Transaction>)), onError);
}

export function latestTransactions(uid: string, callback: (transactions: Transaction[]) => void, onError: (error: FirestoreError) => void = snapshotError) {
  const q = query(path(uid, 'transactions'), orderBy('date', 'desc'), limit(8));
  return onSnapshot(q, (snap) => callback(snap.docs.map(withId<Transaction>)), onError);
}

export async function createTransaction(uid: string, entry: NewTransaction) {
  validateDoubleEntry(entry);

  await runTransaction(db, async (tx) => {
    const debitRef = doc(db, 'users', uid, 'accounts', entry.debitAccountId);
    const creditRef = doc(db, 'users', uid, 'accounts', entry.creditAccountId);
    const debitSnap = await tx.get(debitRef);
    const creditSnap = await tx.get(creditRef);

    if (!debitSnap.exists() || !creditSnap.exists()) {
      throw new Error('Selected debit or credit account no longer exists.');
    }

    const debit = { id: debitSnap.id, ...debitSnap.data() } as Account;
    const credit = { id: creditSnap.id, ...creditSnap.data() } as Account;

    tx.update(debitRef, {
      balance: increment(accountDelta(debit, 'debit', entry.amount)),
      updatedAt: serverTimestamp()
    });
    tx.update(creditRef, {
      balance: increment(accountDelta(credit, 'credit', entry.amount)),
      updatedAt: serverTimestamp()
    });
    tx.set(doc(path(uid, 'transactions')), {
      ...entry,
      date: Timestamp.fromDate(entry.date),
      source: entry.source || 'manual',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  });
}

export async function deleteTransaction(uid: string, transaction: Transaction, accounts: Account[]) {
  await runTransaction(db, async (tx) => {
    const debit = accounts.find((account) => account.id === transaction.debitAccountId);
    const credit = accounts.find((account) => account.id === transaction.creditAccountId);
    if (!debit || !credit) throw new Error('Cannot reverse transaction because an account is missing.');

    tx.update(doc(db, 'users', uid, 'accounts', debit.id), {
      balance: increment(-accountDelta(debit, 'debit', transaction.amount)),
      updatedAt: serverTimestamp()
    });
    tx.update(doc(db, 'users', uid, 'accounts', credit.id), {
      balance: increment(-accountDelta(credit, 'credit', transaction.amount)),
      updatedAt: serverTimestamp()
    });
    tx.delete(doc(db, 'users', uid, 'transactions', transaction.id));
  });
}

export async function updateTransaction(uid: string, original: Transaction, next: NewTransaction, accounts: Account[]) {
  validateDoubleEntry(next);

  await runTransaction(db, async (tx) => {
    const originalDebit = accounts.find((account) => account.id === original.debitAccountId);
    const originalCredit = accounts.find((account) => account.id === original.creditAccountId);
    if (!originalDebit || !originalCredit) throw new Error('Cannot reverse original transaction because an account is missing.');

    const nextDebitRef = doc(db, 'users', uid, 'accounts', next.debitAccountId);
    const nextCreditRef = doc(db, 'users', uid, 'accounts', next.creditAccountId);
    const nextDebitSnap = await tx.get(nextDebitRef);
    const nextCreditSnap = await tx.get(nextCreditRef);
    if (!nextDebitSnap.exists() || !nextCreditSnap.exists()) throw new Error('Selected debit or credit account no longer exists.');

    const nextDebit = { id: nextDebitSnap.id, ...nextDebitSnap.data() } as Account;
    const nextCredit = { id: nextCreditSnap.id, ...nextCreditSnap.data() } as Account;

    tx.update(doc(db, 'users', uid, 'accounts', originalDebit.id), {
      balance: increment(-accountDelta(originalDebit, 'debit', original.amount)),
      updatedAt: serverTimestamp()
    });
    tx.update(doc(db, 'users', uid, 'accounts', originalCredit.id), {
      balance: increment(-accountDelta(originalCredit, 'credit', original.amount)),
      updatedAt: serverTimestamp()
    });
    tx.update(nextDebitRef, {
      balance: increment(accountDelta(nextDebit, 'debit', next.amount)),
      updatedAt: serverTimestamp()
    });
    tx.update(nextCreditRef, {
      balance: increment(accountDelta(nextCredit, 'credit', next.amount)),
      updatedAt: serverTimestamp()
    });
    tx.update(doc(db, 'users', uid, 'transactions', original.id), {
      ...next,
      date: Timestamp.fromDate(next.date),
      updatedAt: serverTimestamp()
    });
  });
}

export function listenBudgets(uid: string, month: string, callback: (budgets: Budget[]) => void, onError: (error: FirestoreError) => void = snapshotError) {
  const q = query(path(uid, 'budgets'), where('month', '==', month));
  return onSnapshot(q, (snap) => {
    const budgets = snap.docs.map(withId<Budget>).sort((a, b) => a.category.localeCompare(b.category));
    callback(budgets);
  }, onError);
}

export async function upsertBudget(uid: string, budget: Omit<Budget, 'id'> & { id?: string }) {
  const { id, ...budgetData } = budget;
  const payload = withoutUndefined({ ...budgetData, updatedAt: serverTimestamp(), createdAt: budget.createdAt || serverTimestamp() });
  if (id) await updateDoc(doc(db, 'users', uid, 'budgets', id), payload);
  else await addDoc(path(uid, 'budgets'), payload);
}

export function listenBookmarks(uid: string, callback: (bookmarks: Bookmark[]) => void, onError: (error: FirestoreError) => void = snapshotError) {
  const q = query(path(uid, 'bookmarks'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map(withId<Bookmark>)), onError);
}

export async function saveBookmark(uid: string, bookmark: Omit<Bookmark, 'id'>) {
  await addDoc(path(uid, 'bookmarks'), {
    ...bookmark,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export function listenRecurring(uid: string, callback: (items: RecurringTransaction[]) => void, onError: (error: FirestoreError) => void = snapshotError) {
  const q = query(path(uid, 'recurring'), orderBy('nextRun', 'asc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map(withId<RecurringTransaction>)), onError);
}

export async function saveRecurring(uid: string, item: Omit<RecurringTransaction, 'id'>) {
  await addDoc(path(uid, 'recurring'), {
    ...item,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

export function listenDebts(uid: string, callback: (items: Debt[]) => void, onError: (error: FirestoreError) => void = snapshotError) {
  const q = query(path(uid, 'debts'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map(withId<Debt>)), onError);
}

export async function saveDebt(uid: string, item: Omit<Debt, 'id'> & { id?: string }) {
  const { id, ...debtData } = item;
  const payload = withoutUndefined({
    ...debtData,
    updatedAt: serverTimestamp(),
    createdAt: item.createdAt || serverTimestamp()
  });

  if (id) await updateDoc(doc(db, 'users', uid, 'debts', id), payload);
  else await addDoc(path(uid, 'debts'), payload);
}

export function listenSips(uid: string, callback: (items: Sip[]) => void, onError: (error: FirestoreError) => void = snapshotError) {
  const q = query(path(uid, 'sips'), orderBy('createdAt', 'desc'));
  return onSnapshot(q, (snap) => callback(snap.docs.map(withId<Sip>)), onError);
}

export async function saveSip(uid: string, item: Omit<Sip, 'id'> & { id?: string }) {
  const { id, ...sipData } = item;
  const payload = withoutUndefined({
    ...sipData,
    updatedAt: serverTimestamp(),
    createdAt: item.createdAt || serverTimestamp()
  });

  if (id) await updateDoc(doc(db, 'users', uid, 'sips', id), payload);
  else await addDoc(path(uid, 'sips'), payload);
}

export async function uploadSipBill(uid: string, file: File) {
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const fileRef = ref(storage, `users/${uid}/sip-bills/${Date.now()}-${safeName}`);
  await uploadBytes(fileRef, file);
  return getDownloadURL(fileRef);
}

export async function exportTransactionsCsv(uid: string) {
  const snap = await getDocs(query(path(uid, 'transactions'), orderBy('date', 'desc')));
  const rows = snap.docs.map((item) => {
    const tx = withId<Transaction>(item);
    return {
      id: tx.id,
      type: tx.type,
      amount: tx.amount,
      category: tx.category,
      debitAccountId: tx.debitAccountId,
      creditAccountId: tx.creditAccountId,
      date: tx.date.toDate().toISOString(),
      notes: tx.notes || ''
    };
  });

  return Papa.unparse(rows);
}

export async function importTransactionsCsv(uid: string, csv: string) {
  const result = Papa.parse<Record<string, string>>(csv, { header: true, skipEmptyLines: true });
  if (result.errors.length) throw new Error(result.errors[0].message);

  for (const row of result.data) {
    await createTransaction(uid, {
      type: row.type as NewTransaction['type'],
      amount: Number(row.amount),
      category: row.category,
      debitAccountId: row.debitAccountId,
      creditAccountId: row.creditAccountId,
      date: new Date(row.date),
      notes: row.notes,
      source: 'import'
    });
  }
}

export function computeDashboard(accounts: Account[], transactions: Transaction[]): DashboardMetrics {
  const spendable = accounts.filter((account) => ['cash', 'bank', 'wallet', 'investment'].includes(account.type));
  const totalBalance = spendable.reduce((sum, account) => sum + account.balance, 0);
  const currentMonth = monthKey();
  const thisMonth = transactions.filter((tx) => monthKey(tx.date.toDate()) === currentMonth);
  const income = thisMonth.filter((tx) => tx.type === 'income').reduce((sum, tx) => sum + tx.amount, 0);
  const expenses = thisMonth.filter((tx) => tx.type === 'expense').reduce((sum, tx) => sum + tx.amount, 0);
  const months = Array.from({ length: 6 }, (_, index) => {
    const d = new Date();
    d.setMonth(d.getMonth() - (5 - index));
    return monthKey(d);
  });

  const monthlyTrend = months.map((month) => ({
    month,
    income: transactions.filter((tx) => tx.type === 'income' && monthKey(tx.date.toDate()) === month).reduce((sum, tx) => sum + tx.amount, 0),
    expense: transactions.filter((tx) => tx.type === 'expense' && monthKey(tx.date.toDate()) === month).reduce((sum, tx) => sum + tx.amount, 0)
  }));

  const categorySpend = Object.entries(
    thisMonth.filter((tx) => tx.type === 'expense').reduce<Record<string, number>>((map, tx) => {
      map[tx.category] = (map[tx.category] || 0) + tx.amount;
      return map;
    }, {})
  ).map(([name, value]) => ({ name, value }));

  return { totalBalance, income, expenses, monthlyTrend, categorySpend };
}

export async function removeDocument(uid: string, collectionName: string, id: string) {
  await deleteDoc(doc(db, 'users', uid, collectionName, id));
}

function snapshotError(error: FirestoreError) {
  console.error('Firestore listener failed:', error);
}
