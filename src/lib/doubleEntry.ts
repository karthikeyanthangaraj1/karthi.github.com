import type { Account, NewTransaction } from '../types';

const debitIncreases = new Set(['cash', 'bank', 'wallet', 'investment', 'expense']);
const creditIncreases = new Set(['credit', 'liability', 'income', 'equity']);

export function accountDelta(account: Account, side: 'debit' | 'credit', amount: number) {
  const debitNormal = debitIncreases.has(account.type);
  const creditNormal = creditIncreases.has(account.type);

  if (side === 'debit') {
    return debitNormal ? amount : creditNormal ? -amount : amount;
  }

  return creditNormal ? amount : debitNormal ? -amount : -amount;
}

export function validateDoubleEntry(entry: Pick<NewTransaction, 'amount' | 'debitAccountId' | 'creditAccountId'>) {
  if (!Number.isFinite(entry.amount) || entry.amount <= 0) {
    throw new Error('Amount must be greater than zero.');
  }

  if (!entry.debitAccountId || !entry.creditAccountId) {
    throw new Error('Both debit and credit accounts are required.');
  }

  if (entry.debitAccountId === entry.creditAccountId) {
    throw new Error('Debit and credit accounts cannot be the same.');
  }
}

export function defaultEntryForType(type: NewTransaction['type'], accountId: string, categoryAccountId: string) {
  if (type === 'income') {
    return { debitAccountId: accountId, creditAccountId: categoryAccountId };
  }

  if (type === 'expense') {
    return { debitAccountId: categoryAccountId, creditAccountId: accountId };
  }

  return { debitAccountId: accountId, creditAccountId: categoryAccountId };
}
