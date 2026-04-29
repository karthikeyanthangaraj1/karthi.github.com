import { useEffect, useMemo, useState } from 'react';
import bcrypt from 'bcryptjs';
import { motion } from 'framer-motion';
import type * as React from 'react';
import { ArrowDownLeft, ArrowUpRight, CreditCard, Download, Edit3, Landmark, Lock, Plus, Trash2, TrendingUp, Upload, Wallet } from 'lucide-react';
import { Timestamp } from 'firebase/firestore';
import { CategoryPie, IncomeExpenseBar, TrendChart } from './components/Charts';
import { Layout, type View } from './components/Layout';
import { Skeleton } from './components/Skeleton';
import { StatCard } from './components/StatCard';
import { TransactionList } from './components/TransactionList';
import { useAuth } from './hooks/useAuth';
import { useMoneyData } from './hooks/useMoneyData';
import { currency, monthKey, percent } from './lib/format';
import { accountSchema, budgetSchema, debtSchema, investmentSchema, parseOrThrow, pinSchema, transactionSchema } from './lib/validation';
import {
  createAccount,
  createTransaction,
  deleteTransaction,
  exportTransactionsCsv,
  importTransactionsCsv,
  removeDocument,
  saveBookmark,
  saveDebt,
  saveRecurring,
  saveSip,
  updateAccount,
  updateSettings,
  updateTransaction,
  uploadSipBill,
  upsertBudget
} from './services/firestoreService';
import { resetPassword, signIn, signInGoogle, signUp } from './services/authService';
import type { Account, Bookmark, Budget, Debt, NewTransaction, RecurringTransaction, Sip, Transaction, TransactionType } from './types';

function AppContent() {
  const { user, loading: authLoading } = useAuth();
  const [pinUnlocked, setPinUnlocked] = useState(false);

  if (authLoading) {
    return <LoadingScreen />;
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <MoneyApp uid={user.uid} pinUnlocked={pinUnlocked} onUnlock={() => setPinUnlocked(true)} onLock={() => setPinUnlocked(false)} />;
}

export function App() {
  return <AppContent />;
}

function MoneyApp({ uid, pinUnlocked, onUnlock, onLock }: { uid: string; pinUnlocked: boolean; onUnlock: () => void; onLock: () => void }) {
  const [view, setView] = useState<View>('dashboard');
  const data = useMoneyData(uid);
  const [themeOverride, setThemeOverride] = useState<'light' | 'dark' | null>(null);
  const theme = themeOverride || data.settings.theme;

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
  }, [theme]);

  useEffect(() => {
    setThemeOverride(null);
  }, [data.settings.theme]);

  useEffect(() => {
    if (!data.settings.pinHash || !pinUnlocked) return;

    let timer = window.setTimeout(onLock, 5 * 60 * 1000);
    const resetTimer = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(onLock, 5 * 60 * 1000);
    };
    const lockWhenHidden = () => {
      if (document.visibilityState === 'hidden') onLock();
    };

    window.addEventListener('mousemove', resetTimer);
    window.addEventListener('keydown', resetTimer);
    window.addEventListener('click', resetTimer);
    window.addEventListener('touchstart', resetTimer);
    document.addEventListener('visibilitychange', lockWhenHidden);

    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('mousemove', resetTimer);
      window.removeEventListener('keydown', resetTimer);
      window.removeEventListener('click', resetTimer);
      window.removeEventListener('touchstart', resetTimer);
      document.removeEventListener('visibilitychange', lockWhenHidden);
    };
  }, [data.settings.pinHash, onLock, pinUnlocked]);

  if (data.settings.pinHash && !pinUnlocked) {
    return <PinGate hash={data.settings.pinHash} onUnlock={onUnlock} />;
  }

  return (
    <Layout
      active={view}
      onNavigate={setView}
      theme={theme}
      onToggleTheme={() => {
        const nextTheme = theme === 'dark' ? 'light' : 'dark';
        setThemeOverride(nextTheme);
        updateSettings(uid, { theme: nextTheme }).catch((error) => {
          console.error(error);
        });
      }}
    >
      {data.error ? (
        <FirebaseSetupError message={data.error} />
      ) : data.loading ? (
        <DashboardSkeleton />
      ) : (
        <Screen uid={uid} view={view} data={data} />
      )}
    </Layout>
  );
}

type MoneyData = ReturnType<typeof useMoneyData>;

function Screen({ uid, view, data }: { uid: string; view: View; data: MoneyData }) {
  if (view === 'transactions') return <TransactionsScreen uid={uid} data={data} />;
  if (view === 'budget') return <BudgetScreen uid={uid} data={data} />;
  if (view === 'balance') return <BalanceScreen data={data} />;
  if (view === 'debt') return <DebtScreen uid={uid} data={data} />;
  if (view === 'investment') return <InvestmentScreen uid={uid} data={data} />;
  if (view === 'reports') return <ReportsScreen uid={uid} data={data} />;
  if (view === 'accounts') return <AccountsScreen uid={uid} data={data} />;
  if (view === 'settings') return <SettingsScreen uid={uid} data={data} />;
  return <Dashboard uid={uid} data={data} />;
}

function Page({ title, subtitle, action, children }: { title: string; subtitle: string; action?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-5 sm:px-6 lg:px-8">
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
          <p className="text-sm text-slate-500">{subtitle}</p>
        </div>
        {action}
      </header>
      {children}
    </div>
  );
}

function Dashboard({ uid, data }: { uid: string; data: MoneyData }) {
  const { metrics, settings, accounts, recent } = data;
  const readyForTransactions = accounts.length >= 2;

  return (
    <div>
      <section className="bg-money-gradient px-4 py-8 text-white sm:px-6 lg:px-8">
        <div className="mx-auto max-w-7xl">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-sm font-semibold uppercase text-white/75">Today</p>
              <h1 className="mt-2 text-4xl font-black sm:text-5xl">Money Manager</h1>
              <p className="mt-3 max-w-2xl text-white/80">A clean double-entry dashboard for daily cash flow, budgets, cards, and account balances.</p>
            </div>
            {readyForTransactions ? (
              <TransactionQuickAdd uid={uid} accounts={accounts} categories={settings.categories} />
            ) : (
              <div className="w-full rounded-2xl bg-white/15 p-5 ring-1 ring-white/25 backdrop-blur-lg lg:max-w-xl">
                <p className="text-lg font-bold">Set up accounts</p>
                <p className="mt-2 text-sm text-white/80">Create at least two accounts to start adding double-entry transactions.</p>
              </div>
            )}
          </div>
          <div className="mt-8 grid gap-4 md:grid-cols-3">
            <StatCard tone="dark" label="Total Balance" value={currency(metrics.totalBalance, settings.currency)} icon={<Wallet size={21} />} />
            <StatCard tone="dark" label="Income" value={currency(metrics.income, settings.currency)} icon={<ArrowDownLeft size={21} />} />
            <StatCard tone="dark" label="Expenses" value={currency(metrics.expenses, settings.currency)} icon={<ArrowUpRight size={21} />} />
          </div>
        </div>
      </section>

      <Page title="Dashboard" subtitle="Real-time balances and spending patterns from Firestore.">
        <div className="grid gap-5 xl:grid-cols-[1.4fr_0.8fr]">
          <Panel title="Monthly Trend">
            <TrendChart data={metrics.monthlyTrend} />
          </Panel>
          <Panel title="Category Spending">
            {metrics.categorySpend.length ? <CategoryPie data={metrics.categorySpend} /> : <EmptyChart />}
          </Panel>
        </div>
        <div className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.8fr]">
          <Panel title="Recent Transactions">
            <TransactionList transactions={recent} accounts={accounts} settings={settings} />
          </Panel>
          <Panel title="Accounts">
            <div className="space-y-3">
              {accounts.filter((account) => !account.archived).slice(0, 5).map((account) => (
                <div key={account.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 dark:bg-slate-800/60">
                  <div>
                    <p className="font-semibold">{account.name}</p>
                    <p className="text-xs text-slate-500">{account.type}</p>
                  </div>
                  <p className="font-bold">{currency(account.balance, settings.currency)}</p>
                </div>
              ))}
            </div>
          </Panel>
        </div>
      </Page>
    </div>
  );
}

function TransactionsScreen({ uid, data }: { uid: string; data: MoneyData }) {
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [filter, setFilter] = useState('monthly');
  const filtered = useMemo(() => filterTransactions(data.transactions, filter), [data.transactions, filter]);

  return (
    <Page title="Transactions" subtitle="Every entry debits one account and credits another." action={<select className="input max-w-44" value={filter} onChange={(e) => setFilter(e.target.value)}><option value="daily">Daily</option><option value="weekly">Weekly</option><option value="monthly">Monthly</option><option value="all">All</option></select>}>
      <div className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
        <Panel title={editing ? 'Edit Transaction' : 'Add Transaction'}>
          <TransactionForm
            accounts={data.accounts}
            categories={data.settings.categories}
            initial={editing}
            onCancel={() => setEditing(null)}
            onSubmit={async (entry) => {
              if (editing) {
                await updateTransaction(uid, editing, entry, data.accounts);
                setEditing(null);
              } else {
                await createTransaction(uid, entry);
              }
            }}
          />
        </Panel>
        <Panel title="Ledger">
          <TransactionList transactions={filtered} accounts={data.accounts} settings={data.settings} onDelete={(tx) => deleteTransaction(uid, tx, data.accounts)} />
          <div className="mt-4 flex flex-wrap gap-2">
            <button className="btn-secondary" onClick={async () => downloadCsv(await exportTransactionsCsv(uid))}><Download size={16} />Export CSV</button>
            <label className="btn-secondary cursor-pointer">
              <Upload size={16} />Import CSV
              <input className="hidden" type="file" accept=".csv,text/csv" onChange={(e) => handleImport(uid, e.currentTarget.files?.[0])} />
            </label>
          </div>
        </Panel>
      </div>
    </Page>
  );
}

function AccountsScreen({ uid, data }: { uid: string; data: MoneyData }) {
  const [editing, setEditing] = useState<Account | null>(null);

  return (
    <Page title="Accounts" subtitle="Cash, bank, credit cards, income, expenses, and clearing accounts.">
      <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title={editing ? 'Edit Account' : 'New Account'}>
          <AccountForm uid={uid} currencyCode={data.settings.currency} initial={editing} onSaved={() => setEditing(null)} />
        </Panel>
        <Panel title="Balances">
          <div className="grid gap-3 md:grid-cols-2">
            {data.accounts.map((account) => (
              <motion.div whileHover={{ y: -2 }} key={account.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="font-bold">{account.name}</p>
                    <p className="text-xs uppercase text-slate-500">{account.type}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-lg font-black">{currency(account.balance, data.settings.currency)}</p>
                    <button className="text-slate-400 transition hover:text-orange-600" title="Edit account" onClick={() => setEditing(account)}>
                      <Edit3 size={16} />
                    </button>
                    <button className="text-slate-400 transition hover:text-rose-600" title="Delete account" onClick={() => {
                      if (window.confirm(`Delete account "${account.name}"? Transactions that reference it may show as Unknown.`)) {
                        removeDocument(uid, 'accounts', account.id);
                      }
                    }}>
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                {account.type === 'credit' && (
                  <div className="mt-4 rounded-lg bg-orange-50 p-3 text-sm text-orange-800 dark:bg-orange-500/10 dark:text-orange-200">
                    Billing day {account.billingCycleDay || 1} · Due day {account.dueDay || 20} · Outstanding {currency(account.balance, data.settings.currency)}
                  </div>
                )}
              </motion.div>
            ))}
          </div>
        </Panel>
      </div>
    </Page>
  );
}

function BudgetScreen({ uid, data }: { uid: string; data: MoneyData }) {
  const [editing, setEditing] = useState<Budget | null>(null);
  const actualByCategory = data.transactions
    .filter((tx) => tx.type === 'expense' && monthKey(tx.date.toDate()) === monthKey())
    .reduce<Record<string, number>>((map, tx) => {
      map[tx.category] = (map[tx.category] || 0) + tx.amount;
      return map;
    }, {});

  return (
    <Page title="Budget" subtitle="Monthly limits compared against actual double-entry expenses.">
      <div className="grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
        <Panel title="Set Budget">
          <BudgetForm uid={uid} categories={data.settings.categories} initial={editing} onSaved={() => setEditing(null)} />
        </Panel>
        <Panel title="Budget vs Actual">
          <div className="space-y-4">
            {data.budgets.length ? data.budgets.map((budget) => {
              const actual = actualByCategory[budget.category] || 0;
              const value = percent(actual, budget.monthlyLimit);
              return (
                <div key={budget.id}>
                  <div className="flex items-center justify-between text-sm">
                    <p className="font-semibold">{budget.category}</p>
                    <div className="flex items-center gap-2">
                      <p className="text-slate-500">{currency(actual, data.settings.currency)} / {currency(budget.monthlyLimit, data.settings.currency)}</p>
                      <button className="text-slate-400 transition hover:text-orange-600" title="Edit budget" onClick={() => setEditing(budget)}>
                        <Edit3 size={15} />
                      </button>
                      <button className="text-slate-400 transition hover:text-rose-600" title="Delete budget" onClick={() => {
                        if (window.confirm(`Delete ${budget.category} budget?`)) {
                          removeDocument(uid, 'budgets', budget.id);
                        }
                      }}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                  <div className="mt-2 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-orange-500 transition-all" style={{ width: `${value}%` }} />
                  </div>
                </div>
              );
            }) : <EmptyChart label="No budgets for this month." />}
          </div>
        </Panel>
      </div>
    </Page>
  );
}

function BalanceScreen({ data }: { data: MoneyData }) {
  const assetAccounts = data.accounts.filter((account) => ['cash', 'bank', 'wallet', 'investment'].includes(account.type) && !account.archived);
  const liabilityAccounts = data.accounts.filter((account) => ['credit', 'liability'].includes(account.type) && !account.archived);
  const categoryAccounts = data.accounts.filter((account) => ['income', 'expense', 'equity'].includes(account.type) && !account.archived);
  const cashBalance = assetAccounts.reduce((sum, account) => sum + account.balance, 0);
  const creditOutstanding = liabilityAccounts.reduce((sum, account) => sum + account.balance, 0);
  const investmentValue = data.sips.reduce((sum, sip) => sum + sip.amount * sip.paidInstallments, 0);
  const debtPrincipal = data.debts.reduce((sum, debt) => sum + debt.principal, 0);
  const debtPaid = data.debts.reduce((sum, debt) => sum + Math.min(debt.paidAmount, debt.principal), 0);
  const debtPending = Math.max(debtPrincipal - debtPaid, 0);
  const overallAssets = cashBalance + investmentValue;
  const overallLiabilities = creditOutstanding + debtPending;
  const netBalance = overallAssets - overallLiabilities;

  return (
    <Page title="Balance" subtitle="Overall account balance after spending, investments, and pending debts.">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Overall Net Balance" value={currency(netBalance, data.settings.currency)} icon={<Landmark size={20} />} />
        <StatCard label="Cash & Accounts" value={currency(cashBalance, data.settings.currency)} icon={<Wallet size={20} />} />
        <StatCard label="Investments" value={currency(investmentValue, data.settings.currency)} icon={<TrendingUp size={20} />} />
        <StatCard label="Pending Debt" value={currency(overallLiabilities, data.settings.currency)} icon={<CreditCard size={20} />} />
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <Panel title="Account Balances After Spending">
          <div className="space-y-3">
            {assetAccounts.length ? assetAccounts.map((account) => (
              <BalanceRow key={account.id} label={account.name} detail={account.type} value={account.balance} currencyCode={data.settings.currency} />
            )) : <EmptyChart label="No asset accounts yet." />}
          </div>
        </Panel>

        <Panel title="Overall Summary">
          <div className="space-y-3">
            <BalanceRow label="Cash, bank, wallet, investment accounts" detail="Account assets" value={cashBalance} currencyCode={data.settings.currency} />
            <BalanceRow label="Investment records" detail="Paid installments value" value={investmentValue} currencyCode={data.settings.currency} />
            <BalanceRow label="Credit cards / liabilities" detail="Outstanding account liabilities" value={-creditOutstanding} currencyCode={data.settings.currency} />
            <BalanceRow label="Debt tracker pending" detail="Debt principal minus completed" value={-debtPending} currencyCode={data.settings.currency} />
            <div className="rounded-xl bg-orange-50 p-4 dark:bg-orange-500/10">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-bold text-orange-900 dark:text-orange-100">Net Balance</p>
                  <p className="text-xs text-orange-700 dark:text-orange-200">Assets minus pending debts and liabilities</p>
                </div>
                <p className={`text-xl font-black ${netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>{currency(netBalance, data.settings.currency)}</p>
              </div>
            </div>
          </div>
        </Panel>
      </div>

      <div className="mt-5 grid gap-5 xl:grid-cols-2">
        <Panel title="Liabilities">
          <div className="space-y-3">
            {liabilityAccounts.length ? liabilityAccounts.map((account) => (
              <BalanceRow key={account.id} label={account.name} detail={account.type} value={account.balance} currencyCode={data.settings.currency} danger />
            )) : <EmptyChart label="No liability accounts yet." />}
          </div>
        </Panel>

        <Panel title="Income / Expense / Equity Accounts">
          <div className="space-y-3">
            {categoryAccounts.length ? categoryAccounts.map((account) => (
              <BalanceRow key={account.id} label={account.name} detail={account.type} value={account.balance} currencyCode={data.settings.currency} />
            )) : <EmptyChart label="No category accounts yet." />}
          </div>
        </Panel>
      </div>
    </Page>
  );
}

function BalanceRow({ label, detail, value, currencyCode, danger = false }: { label: string; detail: string; value: number; currencyCode: string; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-4 rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
      <div className="min-w-0">
        <p className="truncate font-semibold text-slate-950 dark:text-white">{label}</p>
        <p className="text-xs uppercase text-slate-500">{detail}</p>
      </div>
      <p className={`shrink-0 text-lg font-black ${danger || value < 0 ? 'text-rose-600' : 'text-slate-950 dark:text-white'}`}>
        {currency(value, currencyCode)}
      </p>
    </div>
  );
}

function DebtScreen({ uid, data }: { uid: string; data: MoneyData }) {
  const [editing, setEditing] = useState<Debt | null>(null);
  const totalDebt = data.debts.reduce((sum, item) => sum + item.principal, 0);
  const completed = data.debts.reduce((sum, item) => sum + Math.min(item.paidAmount, item.principal), 0);
  const pending = Math.max(totalDebt - completed, 0);
  const monthly = data.debts.reduce((sum, item) => sum + item.monthlyPayment, 0);

  return (
    <Page title="Debt" subtitle="Track monthly debt payments, completed amount, and pending balance.">
      <div className="grid gap-5 md:grid-cols-3">
        <StatCard label="Monthly Paying" value={currency(monthly, data.settings.currency)} icon={<Wallet size={20} />} />
        <StatCard label="Completed" value={currency(completed, data.settings.currency)} icon={<ArrowDownLeft size={20} />} />
        <StatCard label="Pending" value={currency(pending, data.settings.currency)} icon={<ArrowUpRight size={20} />} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title={editing ? 'Edit Debt' : 'Add Debt'}>
          <DebtForm uid={uid} initial={editing} onSaved={() => setEditing(null)} />
        </Panel>
        <Panel title="Debt Calculator">
          <div className="space-y-4">
            {data.debts.length ? data.debts.map((item) => {
              const pendingAmount = Math.max(item.principal - item.paidAmount, 0);
              const progress = percent(item.paidAmount, item.principal);
              const monthsLeft = item.monthlyPayment > 0 ? Math.ceil(pendingAmount / item.monthlyPayment) : 0;
              return (
                <div key={item.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{item.lender}</p>
                      <p className="text-xs text-slate-500">Monthly {currency(item.monthlyPayment, data.settings.currency)} · {monthsLeft} months left</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button className="text-slate-400 transition hover:text-orange-600" onClick={() => setEditing(item)} title="Edit debt"><Edit3 size={16} /></button>
                      <button className="text-slate-400 transition hover:text-rose-600" onClick={() => removeDocument(uid, 'debts', item.id)} title="Delete debt"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                    <p>Debt: <b>{currency(item.principal, data.settings.currency)}</b></p>
                    <p>Completed: <b>{currency(item.paidAmount, data.settings.currency)}</b></p>
                    <p>Pending: <b>{currency(pendingAmount, data.settings.currency)}</b></p>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                    <div className="h-full rounded-full bg-emerald-500" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              );
            }) : <EmptyChart label="No debts added yet." />}
          </div>
        </Panel>
      </div>
    </Page>
  );
}

const investmentOptions = [
  'Systematic Investment Plan (SIP)',
  'Systematic Withdrawal Plan (SWP)',
  'Fixed Deposit (FD)',
  'Recurring Deposit (RD)',
  'National Pension System (NPS)',
  'Public Provident Fund (PPF)',
  'Employee Provident Fund (EPF/PF)',
  'Unit-Linked Insurance Plans (ULIPs)',
  'Direct Equity (Stocks)',
  'Equity Mutual Funds',
  'Debt Funds / Corporate Bonds / Government Bonds',
  'Real Estate / Real Estate Investment Trusts (REITs)',
  'Sovereign Gold Bonds (SGBs) / Gold Investments',
  'Senior Citizens Savings Scheme (SCSS)',
  'Sukanya Samriddhi Yojana (SSY)',
  'Money Market Funds / Liquid Funds / Treasury Bills (T-Bills)',
  'High-Yield Savings Accounts / Certificates of Deposit (CDs)',
  'Hedge Funds / Alternative Investments (e.g., Crypto, Private Equity)',
  'Add'
];

function displayInvestmentType(item: Sip) {
  if (item.investmentType === 'Add') return item.customInvestmentType || 'Other Investment';
  return item.investmentType || 'Systematic Investment Plan (SIP)';
}

function InvestmentScreen({ uid, data }: { uid: string; data: MoneyData }) {
  const [editing, setEditing] = useState<Sip | null>(null);
  const monthlyTotal = data.sips.filter((sip) => sip.frequency === 'monthly').reduce((sum, sip) => sum + sip.amount, 0);
  const invested = data.sips.reduce((sum, sip) => sum + (sip.amount * sip.paidInstallments), 0);

  return (
    <Page title="Investment" subtitle="Store SIP, FD, RD, NPS, PPF, stocks, funds, bonds, gold, and other investment details.">
      <div className="grid gap-5 md:grid-cols-3">
        <StatCard label="Monthly Plans" value={currency(monthlyTotal, data.settings.currency)} icon={<Wallet size={20} />} />
        <StatCard label="Invested" value={currency(invested, data.settings.currency)} icon={<ArrowDownLeft size={20} />} />
        <StatCard label="Plans" value={String(data.sips.length)} icon={<Plus size={20} />} />
      </div>
      <div className="mt-5 grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
        <Panel title={editing ? 'Edit Investment' : 'Add Investment'}>
          <SipForm uid={uid} initial={editing} onSaved={() => setEditing(null)} />
        </Panel>
        <Panel title="Investment Details">
          <div className="grid gap-3">
            {data.sips.length ? data.sips.map((sip) => {
              const paid = sip.amount * sip.paidInstallments;
              const target = sip.targetInstallments ? sip.amount * sip.targetInstallments : 0;
              const progress = target ? percent(paid, target) : 0;
              return (
                <div key={sip.id} className="rounded-xl bg-white p-4 shadow-sm ring-1 ring-slate-100 dark:bg-slate-900 dark:ring-slate-800">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-bold">{sip.fundName}</p>
                      <p className="text-xs text-slate-500">{displayInvestmentType(sip)} · {sip.frequency} · {currency(sip.amount, data.settings.currency)} · {sip.paidInstallments} paid</p>
                    </div>
                    <div className="flex items-center gap-2">
                      {sip.billUrl && <a className="text-sm font-semibold text-orange-600" href={sip.billUrl} target="_blank" rel="noreferrer">Bill</a>}
                      <button className="text-slate-400 transition hover:text-orange-600" onClick={() => setEditing(sip)} title="Edit investment"><Edit3 size={16} /></button>
                      <button className="text-slate-400 transition hover:text-rose-600" onClick={() => removeDocument(uid, 'sips', sip.id)} title="Delete investment"><Trash2 size={16} /></button>
                    </div>
                  </div>
                  <div className="mt-4 grid gap-2 text-sm sm:grid-cols-3">
                    <p>Paid: <b>{currency(paid, data.settings.currency)}</b></p>
                    <p>Target: <b>{target ? currency(target, data.settings.currency) : 'Not set'}</b></p>
                    <p>Folio: <b>{sip.folioNumber || 'Not set'}</b></p>
                  </div>
                  {target > 0 && <div className="mt-3 h-3 overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800"><div className="h-full rounded-full bg-orange-500" style={{ width: `${progress}%` }} /></div>}
                </div>
              );
            }) : <EmptyChart label="No investments added yet." />}
          </div>
        </Panel>
      </div>
    </Page>
  );
}

function ReportsScreen({ uid, data }: { uid: string; data: MoneyData }) {
  return (
    <Page title="Reports" subtitle="Income, expenses, monthly trends, and category analytics.">
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Income vs Expense">
          <IncomeExpenseBar data={data.metrics.monthlyTrend} />
        </Panel>
        <Panel title="Category Breakdown">
          {data.metrics.categorySpend.length ? <CategoryPie data={data.metrics.categorySpend} /> : <EmptyChart />}
        </Panel>
        <Panel title="Monthly Trends">
          <TrendChart data={data.metrics.monthlyTrend} />
        </Panel>
        <Panel title="Quick Bookmarks">
          <BookmarkTools uid={uid} data={data} />
        </Panel>
      </div>
    </Page>
  );
}

function SettingsScreen({ uid, data }: { uid: string; data: MoneyData }) {
  const [pin, setPin] = useState('');
  const [category, setCategory] = useState('');

  return (
    <Page title="Settings" subtitle="Currency, month start, categories, PIN lock, and recurring entries.">
      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Preferences">
          <div className="grid gap-3">
            <label className="text-sm font-semibold">Currency</label>
            <select className="input" value={data.settings.currency} onChange={(e) => updateSettings(uid, { currency: e.target.value })}>
              {['INR', 'USD', 'EUR', 'GBP', 'JPY', 'AUD', 'CAD'].map((code) => <option key={code}>{code}</option>)}
            </select>
            <label className="text-sm font-semibold">Start day of month</label>
            <input className="input" type="number" min={1} max={31} value={data.settings.monthStartDay} onChange={(e) => updateSettings(uid, { monthStartDay: Number(e.target.value) })} />
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input type="checkbox" checked={data.settings.subcategoriesEnabled} onChange={(e) => updateSettings(uid, { subcategoriesEnabled: e.target.checked })} />
              Enable subcategories
            </label>
          </div>
        </Panel>
        <Panel title="Categories">
          <div className="flex gap-2">
            <input className="input" value={category} onChange={(e) => setCategory(e.target.value)} placeholder="New category" />
            <button className="btn-primary" onClick={() => {
              const next = category.trim();
              if (!next) return;
              updateSettings(uid, { categories: Array.from(new Set([...data.settings.categories, next])) });
              setCategory('');
            }}><Plus size={16} /></button>
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {data.settings.categories.map((item) => (
              <button key={item} className="rounded-full bg-slate-100 px-3 py-1 text-sm font-semibold text-slate-700 dark:bg-slate-800 dark:text-slate-200" onClick={() => updateSettings(uid, { categories: data.settings.categories.filter((x) => x !== item) })}>{item}</button>
            ))}
          </div>
        </Panel>
        <Panel title="PIN Lock">
          <div className="flex gap-2">
            <input className="input" type="password" minLength={4} maxLength={12} value={pin} onChange={(e) => setPin(e.target.value)} placeholder="Set 4-12 digit PIN" />
            <button className="btn-primary" onClick={async () => {
              try {
                const validPin = parseOrThrow(pinSchema, pin);
                const pinHash = await bcrypt.hash(validPin, 12);
                await updateSettings(uid, { pinHash });
                setPin('');
              } catch (error) {
                window.alert(error instanceof Error ? error.message : 'Invalid PIN');
              }
            }}><Lock size={16} /></button>
          </div>
          {data.settings.pinHash && <button className="btn-secondary mt-3" onClick={() => updateSettings(uid, { pinHash: undefined })}>Remove PIN</button>}
        </Panel>
        <Panel title="Recurring Transactions">
          <RecurringTools uid={uid} data={data} />
        </Panel>
      </div>
    </Page>
  );
}

function TransactionForm({ accounts, categories, initial, onSubmit, onCancel }: { accounts: Account[]; categories: string[]; initial?: Transaction | null; onSubmit: (entry: NewTransaction) => Promise<void>; onCancel?: () => void }) {
  const [type, setType] = useState<TransactionType>(initial?.type || 'expense');
  const [amount, setAmount] = useState(String(initial?.amount || ''));
  const [category, setCategory] = useState(initial?.category || categories[0] || '');
  const [debitAccountId, setDebitAccountId] = useState(initial?.debitAccountId || accounts[0]?.id || '');
  const [creditAccountId, setCreditAccountId] = useState(initial?.creditAccountId || accounts[1]?.id || '');
  const [date, setDate] = useState(initial?.date.toDate().toISOString().slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState(initial?.notes || '');
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!initial) return;
    setType(initial.type);
    setAmount(String(initial.amount));
    setCategory(initial.category);
    setDebitAccountId(initial.debitAccountId);
    setCreditAccountId(initial.creditAccountId);
    setDate(initial.date.toDate().toISOString().slice(0, 10));
    setNotes(initial.notes || '');
  }, [initial]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      const validated = parseOrThrow(transactionSchema, { type, amount, category, debitAccountId, creditAccountId, date, notes });
      await onSubmit({ ...validated, accountId: type === 'expense' ? creditAccountId : debitAccountId });
      if (!initial) {
        setAmount('');
        setNotes('');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save transaction.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <form className="grid gap-3" onSubmit={submit}>
      <Segmented value={type} onChange={(next) => setType(next as TransactionType)} options={['income', 'expense', 'transfer']} />
      <input className="input" required type="number" step="0.01" min="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
      <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
      <div className="grid gap-3 sm:grid-cols-2">
        <AccountSelect label="Debit" accounts={accounts} value={debitAccountId} onChange={setDebitAccountId} />
        <AccountSelect label="Credit" accounts={accounts} value={creditAccountId} onChange={setCreditAccountId} />
      </div>
      <input className="input" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      <textarea className="input min-h-24" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : initial ? 'Update' : 'Add'} Transaction</button>
        {initial && <button type="button" className="btn-secondary" onClick={onCancel}>Cancel</button>}
      </div>
    </form>
  );
}

function TransactionQuickAdd({ uid, accounts, categories }: { uid: string; accounts: Account[]; categories: string[] }) {
  return (
    <div className="w-full rounded-2xl bg-white/15 p-4 ring-1 ring-white/25 backdrop-blur-lg lg:max-w-xl">
      <TransactionForm accounts={accounts} categories={categories} onSubmit={(entry) => createTransaction(uid, entry)} />
    </div>
  );
}

function AccountForm({ uid, currencyCode, initial, onSaved }: { uid: string; currencyCode: string; initial?: Account | null; onSaved?: () => void }) {
  const [name, setName] = useState(initial?.name || '');
  const [type, setType] = useState<Account['type']>(initial?.type || 'cash');
  const [balance, setBalance] = useState(initial ? String(initial.balance) : '0');
  const [institution, setInstitution] = useState(initial?.institution || '');
  const [billingCycleDay, setBillingCycleDay] = useState(initial?.billingCycleDay ? String(initial.billingCycleDay) : '');
  const [dueDay, setDueDay] = useState(initial?.dueDay ? String(initial.dueDay) : '');
  const [creditLimit, setCreditLimit] = useState(initial?.creditLimit ? String(initial.creditLimit) : '');
  const [error, setError] = useState('');

  useEffect(() => {
    setName(initial?.name || '');
    setType(initial?.type || 'cash');
    setBalance(initial ? String(initial.balance) : '0');
    setInstitution(initial?.institution || '');
    setBillingCycleDay(initial?.billingCycleDay ? String(initial.billingCycleDay) : '');
    setDueDay(initial?.dueDay ? String(initial.dueDay) : '');
    setCreditLimit(initial?.creditLimit ? String(initial.creditLimit) : '');
  }, [initial]);

  return (
    <form className="grid gap-3" onSubmit={async (e) => {
      e.preventDefault();
      setError('');
      try {
        const validated = parseOrThrow(accountSchema, {
          name,
          type,
          balance,
          currency: initial?.currency || currencyCode,
          institution: institution || undefined,
          billingCycleDay: billingCycleDay ? Number(billingCycleDay) : undefined,
          dueDay: dueDay ? Number(dueDay) : undefined,
          creditLimit: creditLimit ? Number(creditLimit) : undefined
        });
        const payload = {
          ...validated,
          archived: initial?.archived || false,
          createdAt: initial?.createdAt
        };
        if (initial) await updateAccount(uid, { id: initial.id, ...payload });
        else await createAccount(uid, payload);
        onSaved?.();
        if (!initial) {
          setName('');
          setBalance('0');
          setInstitution('');
          setBillingCycleDay('');
          setDueDay('');
          setCreditLimit('');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save account.');
      }
    }}>
      <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Account name" />
      <select className="input" value={type} onChange={(e) => setType(e.target.value as Account['type'])}>
        {['cash', 'bank', 'credit', 'wallet', 'investment', 'income', 'expense', 'liability', 'equity'].map((item) => <option key={item}>{item}</option>)}
      </select>
      <input className="input" type="number" step="0.01" value={balance} onChange={(e) => setBalance(e.target.value)} placeholder="Opening balance" />
      <input className="input" value={institution} onChange={(e) => setInstitution(e.target.value)} placeholder="Institution / bank name" />
      {type === 'credit' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <input className="input" min="1" max="31" type="number" value={billingCycleDay} onChange={(e) => setBillingCycleDay(e.target.value)} placeholder="Billing day" />
          <input className="input" min="1" max="31" type="number" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="Due day" />
          <input className="input" min="0" type="number" step="0.01" value={creditLimit} onChange={(e) => setCreditLimit(e.target.value)} placeholder="Credit limit" />
        </div>
      )}
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary">{initial ? 'Update Account' : 'Create Account'}</button>
        {initial && <button type="button" className="btn-secondary" onClick={onSaved}>Cancel</button>}
      </div>
    </form>
  );
}

function BudgetForm({ uid, categories, initial, onSaved }: { uid: string; categories: string[]; initial?: Budget | null; onSaved?: () => void }) {
  const [category, setCategory] = useState(initial?.category || categories[0] || '');
  const [monthlyLimit, setMonthlyLimit] = useState(initial ? String(initial.monthlyLimit) : '');
  const [error, setError] = useState('');

  useEffect(() => {
    setCategory(initial?.category || categories[0] || '');
    setMonthlyLimit(initial ? String(initial.monthlyLimit) : '');
  }, [categories, initial]);

  return (
    <form className="grid gap-3" onSubmit={async (e) => {
      e.preventDefault();
      setError('');
      try {
        const validated = parseOrThrow(budgetSchema, { category, month: initial?.month || monthKey(), monthlyLimit });
        await upsertBudget(uid, { id: initial?.id, ...validated, createdAt: initial?.createdAt });
        setMonthlyLimit('');
        onSaved?.();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save budget.');
      }
    }}>
      <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{categories.map((item) => <option key={item}>{item}</option>)}</select>
      <input className="input" required min="0" type="number" step="0.01" value={monthlyLimit} onChange={(e) => setMonthlyLimit(e.target.value)} placeholder="Monthly limit" />
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary">{initial ? 'Update Budget' : 'Save Budget'}</button>
        {initial && <button type="button" className="btn-secondary" onClick={onSaved}>Cancel</button>}
      </div>
    </form>
  );
}

function DebtForm({ uid, initial, onSaved }: { uid: string; initial?: Debt | null; onSaved?: () => void }) {
  const [lender, setLender] = useState(initial?.lender || '');
  const [principal, setPrincipal] = useState(initial ? String(initial.principal) : '');
  const [monthlyPayment, setMonthlyPayment] = useState(initial ? String(initial.monthlyPayment) : '');
  const [paidAmount, setPaidAmount] = useState(initial ? String(initial.paidAmount) : '0');
  const [interestRate, setInterestRate] = useState(initial?.interestRate ? String(initial.interestRate) : '');
  const [dueDay, setDueDay] = useState(initial?.dueDay ? String(initial.dueDay) : '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [error, setError] = useState('');

  useEffect(() => {
    setLender(initial?.lender || '');
    setPrincipal(initial ? String(initial.principal) : '');
    setMonthlyPayment(initial ? String(initial.monthlyPayment) : '');
    setPaidAmount(initial ? String(initial.paidAmount) : '0');
    setInterestRate(initial?.interestRate ? String(initial.interestRate) : '');
    setDueDay(initial?.dueDay ? String(initial.dueDay) : '');
    setNotes(initial?.notes || '');
  }, [initial]);

  return (
    <form className="grid gap-3" onSubmit={async (e) => {
      e.preventDefault();
      setError('');
      try {
        const validated = parseOrThrow(debtSchema, {
          lender,
          principal,
          monthlyPayment,
          paidAmount,
          interestRate: interestRate ? Number(interestRate) : undefined,
          dueDay: dueDay ? Number(dueDay) : undefined,
          notes
        });
        await saveDebt(uid, {
          id: initial?.id,
          ...validated,
          createdAt: initial?.createdAt
        });
        onSaved?.();
        if (!initial) {
          setLender('');
          setPrincipal('');
          setMonthlyPayment('');
          setPaidAmount('0');
          setInterestRate('');
          setDueDay('');
          setNotes('');
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save debt.');
      }
    }}>
      <input className="input" required value={lender} onChange={(e) => setLender(e.target.value)} placeholder="Lender / Loan name" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input" required min="0" type="number" step="0.01" value={principal} onChange={(e) => setPrincipal(e.target.value)} placeholder="Total debt" />
        <input className="input" required min="0" type="number" step="0.01" value={monthlyPayment} onChange={(e) => setMonthlyPayment(e.target.value)} placeholder="Monthly paying" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input className="input" required min="0" type="number" step="0.01" value={paidAmount} onChange={(e) => setPaidAmount(e.target.value)} placeholder="Completed paid" />
        <input className="input" min="0" type="number" step="0.01" value={interestRate} onChange={(e) => setInterestRate(e.target.value)} placeholder="Interest %" />
        <input className="input" min="1" max="31" type="number" value={dueDay} onChange={(e) => setDueDay(e.target.value)} placeholder="Due day" />
      </div>
      <textarea className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary">{initial ? 'Update Debt' : 'Save Debt'}</button>
        {initial && <button type="button" className="btn-secondary" onClick={onSaved}>Cancel</button>}
      </div>
    </form>
  );
}

function SipForm({ uid, initial, onSaved }: { uid: string; initial?: Sip | null; onSaved?: () => void }) {
  const [investmentType, setInvestmentType] = useState(initial?.investmentType || 'Systematic Investment Plan (SIP)');
  const [customInvestmentType, setCustomInvestmentType] = useState(initial?.customInvestmentType || '');
  const [fundName, setFundName] = useState(initial?.fundName || '');
  const [folioNumber, setFolioNumber] = useState(initial?.folioNumber || '');
  const [amount, setAmount] = useState(initial ? String(initial.amount) : '');
  const [frequency, setFrequency] = useState<Sip['frequency']>(initial?.frequency || 'monthly');
  const [startDate, setStartDate] = useState(initial?.startDate.toDate().toISOString().slice(0, 10) || new Date().toISOString().slice(0, 10));
  const [paidInstallments, setPaidInstallments] = useState(initial ? String(initial.paidInstallments) : '0');
  const [targetInstallments, setTargetInstallments] = useState(initial?.targetInstallments ? String(initial.targetInstallments) : '');
  const [notes, setNotes] = useState(initial?.notes || '');
  const [billFile, setBillFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    setInvestmentType(initial?.investmentType || 'Systematic Investment Plan (SIP)');
    setCustomInvestmentType(initial?.customInvestmentType || '');
    setFundName(initial?.fundName || '');
    setFolioNumber(initial?.folioNumber || '');
    setAmount(initial ? String(initial.amount) : '');
    setFrequency(initial?.frequency || 'monthly');
    setStartDate(initial?.startDate.toDate().toISOString().slice(0, 10) || new Date().toISOString().slice(0, 10));
    setPaidInstallments(initial ? String(initial.paidInstallments) : '0');
    setTargetInstallments(initial?.targetInstallments ? String(initial.targetInstallments) : '');
    setNotes(initial?.notes || '');
    setBillFile(null);
  }, [initial]);

  return (
    <form className="grid gap-3" onSubmit={async (e) => {
      e.preventDefault();
      setError('');
      setSaving(true);
      try {
        if (billFile && !isAllowedBillFile(billFile)) {
          throw new Error('Upload only PDF or image files under 10 MB.');
        }
        const validated = parseOrThrow(investmentSchema, {
          investmentType,
          customInvestmentType: investmentType === 'Add' ? customInvestmentType : undefined,
          fundName,
          folioNumber,
          amount,
          frequency,
          startDate,
          paidInstallments,
          targetInstallments: targetInstallments ? Number(targetInstallments) : undefined,
          notes
        });
        const billUrl = billFile ? await uploadSipBill(uid, billFile) : initial?.billUrl;
        await saveSip(uid, {
          id: initial?.id,
          ...validated,
          startDate: Timestamp.fromDate(validated.startDate),
          billName: billFile?.name || initial?.billName,
          billUrl,
          createdAt: initial?.createdAt
        });
        onSaved?.();
        if (!initial) {
          setFundName('');
          setFolioNumber('');
          setAmount('');
          setPaidInstallments('0');
          setTargetInstallments('');
          setNotes('');
          setBillFile(null);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Could not save investment.');
      } finally {
        setSaving(false);
      }
    }}>
      <input className="input" required value={fundName} onChange={(e) => setFundName(e.target.value)} placeholder="Fund name" />
      <select className="input" value={investmentType} onChange={(e) => setInvestmentType(e.target.value)}>
        {investmentOptions.map((option) => <option key={option}>{option}</option>)}
      </select>
      {investmentType === 'Add' && (
        <input className="input" required value={customInvestmentType} onChange={(e) => setCustomInvestmentType(e.target.value)} placeholder="Enter investment type" />
      )}
      <input className="input" value={folioNumber} onChange={(e) => setFolioNumber(e.target.value)} placeholder="Folio number" />
      <div className="grid gap-3 sm:grid-cols-2">
        <input className="input" required min="0" type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Investment amount" />
        <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as Sip['frequency'])}>
          <option>weekly</option>
          <option>monthly</option>
          <option>yearly</option>
        </select>
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        <input className="input" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        <input className="input" min="0" type="number" value={paidInstallments} onChange={(e) => setPaidInstallments(e.target.value)} placeholder="Paid count" />
        <input className="input" min="0" type="number" value={targetInstallments} onChange={(e) => setTargetInstallments(e.target.value)} placeholder="Target count" />
      </div>
      <label className="btn-secondary cursor-pointer">
        <Upload size={16} />{billFile ? billFile.name : 'Upload paid bill'}
        <input className="hidden" type="file" accept="image/*,.pdf" onChange={(e) => setBillFile(e.currentTarget.files?.[0] || null)} />
      </label>
      <textarea className="input min-h-20" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Notes" />
      {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700 dark:bg-rose-500/10 dark:text-rose-200">{error}</p>}
      <div className="flex gap-2">
        <button className="btn-primary" disabled={saving}>{saving ? 'Saving...' : initial ? 'Update Investment' : 'Save Investment'}</button>
        {initial && <button type="button" className="btn-secondary" onClick={onSaved}>Cancel</button>}
      </div>
    </form>
  );
}

function BookmarkTools({ uid, data }: { uid: string; data: MoneyData }) {
  if (!uid) return <EmptyChart label="Bookmarks are available in Settings." />;
  return (
    <div className="space-y-3">
      {data.bookmarks.map((bookmark) => <BookmarkRow key={bookmark.id} uid={uid} bookmark={bookmark} />)}
    </div>
  );
}

function BookmarkRow({ uid, bookmark }: { uid: string; bookmark: Bookmark }) {
  return (
    <button className="flex w-full items-center justify-between rounded-lg bg-slate-50 p-3 text-left dark:bg-slate-800" onClick={() => createTransaction(uid, { ...bookmark, date: new Date(), source: 'bookmark', bookmarkId: bookmark.id })}>
      <span className="font-semibold">{bookmark.name}</span>
      <span>{bookmark.amount}</span>
    </button>
  );
}

function RecurringTools({ uid, data }: { uid: string; data: MoneyData }) {
  const [name, setName] = useState('');
  const [frequency, setFrequency] = useState<RecurringTransaction['frequency']>('monthly');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState(data.settings.categories[0] || '');
  const [debitAccountId, setDebitAccountId] = useState(data.accounts[0]?.id || '');
  const [creditAccountId, setCreditAccountId] = useState(data.accounts[1]?.id || '');

  return (
    <div>
      <form className="grid gap-3" onSubmit={async (e) => {
        e.preventDefault();
        await saveRecurring(uid, { name, frequency, amount: Number(amount), category, debitAccountId, creditAccountId, type: 'expense', active: true, nextRun: Timestamp.fromDate(new Date()) });
        await saveBookmark(uid, { name, type: 'expense', amount: Number(amount), category, debitAccountId, creditAccountId });
        setName('');
        setAmount('');
      }}>
        <input className="input" required value={name} onChange={(e) => setName(e.target.value)} placeholder="Name" />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="input" required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="Amount" />
          <select className="input" value={frequency} onChange={(e) => setFrequency(e.target.value as RecurringTransaction['frequency'])}><option>weekly</option><option>monthly</option><option>yearly</option></select>
        </div>
        <select className="input" value={category} onChange={(e) => setCategory(e.target.value)}>{data.settings.categories.map((item) => <option key={item}>{item}</option>)}</select>
        <div className="grid gap-3 sm:grid-cols-2">
          <AccountSelect label="Debit" accounts={data.accounts} value={debitAccountId} onChange={setDebitAccountId} />
          <AccountSelect label="Credit" accounts={data.accounts} value={creditAccountId} onChange={setCreditAccountId} />
        </div>
        <button className="btn-primary">Save Recurring</button>
      </form>
      <div className="mt-4 space-y-2">
        {data.recurring.map((item) => (
          <div key={item.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3 text-sm dark:bg-slate-800">
            <span>{item.name} · {item.frequency}</span>
            <button className="text-rose-600" onClick={() => removeDocument(uid, 'recurring', item.id)}>Delete</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function AuthScreen() {
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setNotice('');
    try {
      if (mode === 'signup') await signUp(email, password, name);
      else await signIn(email, password);
    } catch (err) {
      const message = authMessage(err);
      setError(message);
      if (String(err).includes('auth/email-already-in-use')) {
        setMode('signin');
        setNotice('That email already has an account. Try signing in instead.');
      }
    }
  }

  return (
    <main className="min-h-screen bg-money-gradient p-4">
      <div className="mx-auto grid min-h-[calc(100vh-2rem)] max-w-6xl items-center gap-8 lg:grid-cols-[1fr_420px]">
        <section className="text-white">
          <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="text-5xl font-black sm:text-7xl">Money Manager</motion.h1>
          <p className="mt-5 max-w-2xl text-lg text-white/80">Track income, expenses, transfers, budgets, cards, and recurring entries with a proper double-entry ledger.</p>
        </section>
        <section className="rounded-2xl bg-white p-6 shadow-2xl dark:bg-slate-950">
          <h2 className="text-2xl font-bold text-slate-950 dark:text-white">{mode === 'signup' ? 'Create account' : 'Welcome back'}</h2>
          <form className="mt-5 grid gap-3" onSubmit={submit}>
            {mode === 'signup' && <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Display name" required />}
            <input className="input" type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required />
            <input className="input" type="password" minLength={6} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required />
            {notice && <p className="rounded-lg bg-orange-50 p-3 text-sm text-orange-800">{notice}</p>}
            {error && <p className="rounded-lg bg-rose-50 p-3 text-sm text-rose-700">{error}</p>}
            <button className="btn-primary">{mode === 'signup' ? 'Sign up' : 'Sign in'}</button>
          </form>
          <button className="btn-secondary mt-3 w-full" onClick={signInGoogle}>Continue with Google</button>
          <div className="mt-4 flex flex-wrap justify-between gap-3 text-sm">
            <button className="font-semibold text-orange-700" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'Have an account?' : 'Create account'}</button>
            <button className="text-slate-500" onClick={async () => {
              setError('');
              setNotice('');
              if (!email) {
                setError('Enter your email first, then reset your password.');
                return;
              }
              try {
                await resetPassword(email);
                setNotice('Password reset email sent. Check your inbox.');
              } catch (err) {
                setError(authMessage(err));
              }
            }}>Reset password</button>
          </div>
        </section>
      </div>
    </main>
  );
}

function PinGate({ hash, onUnlock }: { hash: string; onUnlock: () => void }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  return (
    <main className="grid min-h-screen place-items-center bg-slate-950 p-4 text-white">
      <form className="w-full max-w-sm rounded-2xl bg-white/10 p-6 ring-1 ring-white/10" onSubmit={async (e) => {
        e.preventDefault();
        if (await bcrypt.compare(pin, hash)) onUnlock();
        else setError('Incorrect PIN');
      }}>
        <Lock className="mb-4 text-orange-400" />
        <h1 className="text-2xl font-bold">App locked</h1>
        <input className="input mt-5" type="password" value={pin} onChange={(e) => setPin(e.target.value)} placeholder="PIN" />
        {error && <p className="mt-3 text-sm text-rose-300">{error}</p>}
        <button className="btn-primary mt-4 w-full">Unlock</button>
      </form>
    </main>
  );
}

function AccountSelect({ label, accounts, value, onChange }: { label: string; accounts: Account[]; value: string; onChange: (value: string) => void }) {
  return (
    <label className="text-sm font-semibold">
      {label}
      <select className="input mt-1" value={value} onChange={(e) => onChange(e.target.value)}>
        {accounts.map((account) => <option key={account.id} value={account.id}>{account.name} ({account.type})</option>)}
      </select>
    </label>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-3 rounded-lg bg-slate-100 p-1 dark:bg-slate-800">
      {options.map((option) => (
        <button key={option} type="button" className={`rounded-md px-3 py-2 text-sm font-semibold capitalize transition ${value === option ? 'bg-white text-orange-700 shadow-sm dark:bg-slate-950 dark:text-orange-300' : 'text-slate-500'}`} onClick={() => onChange(option)}>{option}</button>
      ))}
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="glass-panel rounded-xl p-4">
      <h2 className="mb-4 text-lg font-bold text-slate-950 dark:text-white">{title}</h2>
      {children}
    </section>
  );
}

function EmptyChart({ label = 'No data yet.' }: { label?: string }) {
  return <div className="grid h-64 place-items-center rounded-xl border border-dashed border-slate-300 text-sm text-slate-500 dark:border-slate-700">{label}</div>;
}

function DashboardSkeleton() {
  return (
    <div className="mx-auto max-w-7xl space-y-5 p-6">
      <Skeleton className="h-52" />
      <div className="grid gap-5 md:grid-cols-3">
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
        <Skeleton className="h-28" />
      </div>
      <Skeleton className="h-80" />
    </div>
  );
}

function LoadingScreen() {
  return <div className="grid min-h-screen place-items-center bg-slate-50 dark:bg-slate-950"><Skeleton className="h-16 w-64" /></div>;
}

function FirebaseSetupError({ message }: { message: string }) {
  return (
    <div className="mx-auto grid min-h-screen max-w-2xl place-items-center p-6">
      <div className="rounded-2xl border border-orange-200 bg-white p-6 shadow-soft dark:border-orange-500/30 dark:bg-slate-900">
        <h1 className="text-2xl font-bold text-slate-950 dark:text-white">Firebase needs one more step</h1>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">{message}</p>
        <div className="mt-5 rounded-xl bg-orange-50 p-4 text-sm text-orange-900 dark:bg-orange-500/10 dark:text-orange-100">
          Enable Firestore in Firebase Console, then deploy the included rules with <code>firebase deploy --only firestore:rules,firestore:indexes</code>.
        </div>
      </div>
    </div>
  );
}

function filterTransactions(transactions: Transaction[], filter: string) {
  if (filter === 'all') return transactions;
  const now = new Date();
  return transactions.filter((tx) => {
    const date = tx.date.toDate();
    const diff = now.getTime() - date.getTime();
    if (filter === 'daily') return diff <= 24 * 60 * 60 * 1000;
    if (filter === 'weekly') return diff <= 7 * 24 * 60 * 60 * 1000;
    return monthKey(date) === monthKey(now);
  });
}

function downloadCsv(csv: string) {
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = `money-manager-${monthKey()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

async function handleImport(uid: string, file?: File) {
  if (!file) return;
  await importTransactionsCsv(uid, await file.text());
}

function isAllowedBillFile(file: File) {
  return file.size <= 10 * 1024 * 1024 && (file.type.startsWith('image/') || file.type === 'application/pdf');
}

function authMessage(err: unknown) {
  const text = err instanceof Error ? err.message : String(err);
  if (text.includes('auth/email-already-in-use')) return 'This email already has an account. Sign in instead or reset your password.';
  if (text.includes('auth/invalid-credential') || text.includes('auth/wrong-password')) return 'The email or password is incorrect.';
  if (text.includes('auth/user-not-found')) return 'No account was found for this email.';
  if (text.includes('auth/too-many-requests')) return 'Too many attempts. Please wait a moment and try again.';
  if (text.includes('auth/popup-closed-by-user')) return 'Google sign-in was closed before it finished.';
  if (text.includes('auth/unauthorized-domain')) return 'This domain is not authorized in Firebase Authentication settings.';
  if (text.includes('auth/operation-not-allowed')) return 'This sign-in method is not enabled in Firebase Authentication.';
  return 'Authentication failed. Please try again.';
}
