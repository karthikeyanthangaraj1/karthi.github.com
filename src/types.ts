import type { Timestamp } from 'firebase/firestore';

export type Theme = 'light' | 'dark';
export type AccountType = 'cash' | 'bank' | 'credit' | 'wallet' | 'investment' | 'income' | 'expense' | 'equity' | 'liability';
export type TransactionType = 'income' | 'expense' | 'transfer';
export type Frequency = 'weekly' | 'monthly' | 'yearly';
export type DateFilter = 'daily' | 'weekly' | 'monthly' | 'custom';

export type Profile = {
  displayName: string;
  email: string;
  photoURL?: string;
};

export type UserSettings = {
  currency: string;
  monthStartDay: number;
  theme: Theme;
  categories: string[];
  subcategoriesEnabled: boolean;
  pinHash?: string;
};

export type Account = {
  id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  institution?: string;
  billingCycleDay?: number;
  dueDay?: number;
  creditLimit?: number;
  archived?: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type Transaction = {
  id: string;
  type: TransactionType;
  amount: number;
  category: string;
  subcategory?: string;
  debitAccountId: string;
  creditAccountId: string;
  accountId?: string;
  date: Timestamp;
  notes?: string;
  source?: 'manual' | 'import' | 'recurring' | 'bookmark';
  bookmarkId?: string;
  recurringId?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type Budget = {
  id: string;
  category: string;
  month: string;
  monthlyLimit: number;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type Bookmark = {
  id: string;
  name: string;
  type: TransactionType;
  amount: number;
  category: string;
  debitAccountId: string;
  creditAccountId: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type RecurringTransaction = {
  id: string;
  name: string;
  type: TransactionType;
  amount: number;
  category: string;
  debitAccountId: string;
  creditAccountId: string;
  notes?: string;
  frequency: Frequency;
  nextRun: Timestamp;
  active: boolean;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type Debt = {
  id: string;
  lender: string;
  principal: number;
  monthlyPayment: number;
  paidAmount: number;
  interestRate?: number;
  dueDay?: number;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type Sip = {
  id: string;
  investmentType?: string;
  customInvestmentType?: string;
  fundName: string;
  folioNumber?: string;
  amount: number;
  frequency: Frequency;
  startDate: Timestamp;
  paidInstallments: number;
  targetInstallments?: number;
  billName?: string;
  billUrl?: string;
  notes?: string;
  createdAt?: Timestamp;
  updatedAt?: Timestamp;
};

export type NewTransaction = Omit<Transaction, 'id' | 'createdAt' | 'updatedAt' | 'date'> & {
  date: Date;
};

export type DashboardMetrics = {
  totalBalance: number;
  income: number;
  expenses: number;
  monthlyTrend: Array<{ month: string; income: number; expense: number }>;
  categorySpend: Array<{ name: string; value: number }>;
};
