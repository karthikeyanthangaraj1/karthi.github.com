import { useEffect, useMemo, useState } from 'react';
import type { FirestoreError } from 'firebase/firestore';
import { monthKey } from '../lib/format';
import { computeDashboard, latestTransactions, listenAccounts, listenBookmarks, listenBudgets, listenDebts, listenRecurring, listenSips, listenTransactions, listenUserSettings, seedDefaultAccounts } from '../services/firestoreService';
import { defaultSettings } from '../services/authService';
import type { Account, Bookmark, Budget, Debt, RecurringTransaction, Sip, Transaction, UserSettings } from '../types';

export function useMoneyData(uid?: string) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [recent, setRecent] = useState<Transaction[]>([]);
  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [bookmarks, setBookmarks] = useState<Bookmark[]>([]);
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [sips, setSips] = useState<Sip[]>([]);
  const [settings, setSettings] = useState<UserSettings>(defaultSettings);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!uid) return;
    let active = true;

    const handleError = (error: FirestoreError | Error) => {
      setError(error.message);
      setLoading(false);
      console.error(error);
    };

    seedDefaultAccounts(uid, settings.currency).catch(handleError);

    const unsubscribers = [
      listenUserSettings(uid, (next) => next && setSettings({ ...defaultSettings, ...next })),
      listenAccounts(uid, (items) => {
        setAccounts(items);
        if (active) setLoading(false);
      }, handleError),
      listenTransactions(uid, setTransactions, [], handleError),
      latestTransactions(uid, setRecent, handleError),
      listenBudgets(uid, monthKey(), setBudgets, handleError),
      listenBookmarks(uid, setBookmarks, handleError),
      listenRecurring(uid, setRecurring, handleError),
      listenDebts(uid, setDebts, handleError),
      listenSips(uid, setSips, handleError)
    ];

    setLoading(false);

    return () => {
      active = false;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
    };
  }, [uid, settings.currency]);

  const metrics = useMemo(() => computeDashboard(accounts, transactions), [accounts, transactions]);

  return { accounts, transactions, recent, budgets, bookmarks, recurring, debts, sips, settings, metrics, loading, error };
}
