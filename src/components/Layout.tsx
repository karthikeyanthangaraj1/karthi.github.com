import { BarChart3, CreditCard, HandCoins, Landmark, LayoutDashboard, Moon, PiggyBank, ReceiptText, Settings, Sun, TrendingUp, WalletCards } from 'lucide-react';
import type { ReactNode } from 'react';
import { logout } from '../services/authService';
import type { Theme } from '../types';

export type View = 'dashboard' | 'transactions' | 'budget' | 'balance' | 'debt' | 'investment' | 'reports' | 'accounts' | 'settings';

const nav = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { id: 'transactions', label: 'Transactions', icon: ReceiptText },
  { id: 'budget', label: 'Budget', icon: PiggyBank },
  { id: 'balance', label: 'Balance', icon: Landmark },
  { id: 'debt', label: 'Debt', icon: HandCoins },
  { id: 'investment', label: 'Investment', icon: TrendingUp },
  { id: 'reports', label: 'Reports', icon: BarChart3 },
  { id: 'accounts', label: 'Accounts', icon: WalletCards },
  { id: 'settings', label: 'Settings', icon: Settings }
] as const;

type Props = {
  active: View;
  onNavigate: (view: View) => void;
  theme: Theme;
  onToggleTheme: () => void;
  children: ReactNode;
};

export function Layout({ active, onNavigate, theme, onToggleTheme, children }: Props) {
  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 transition dark:bg-slate-950 dark:text-slate-100">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-slate-200 bg-white/90 p-4 backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/90 lg:block">
        <div className="flex items-center gap-3 px-2 py-3">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-money-gradient text-white shadow-lg shadow-orange-500/25">
            <CreditCard size={20} />
          </div>
          <div>
            <p className="font-bold">Money Manager</p>
            <p className="text-xs text-slate-500">Double-entry wallet</p>
          </div>
        </div>
        <nav className="mt-8 space-y-1">
          {nav.map((item) => {
            const Icon = item.icon;
            const selected = active === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onNavigate(item.id)}
                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition ${selected ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-900'}`}
              >
                <Icon size={18} />
                {item.label}
              </button>
            );
          })}
        </nav>
        <div className="absolute bottom-4 left-4 right-4 space-y-2">
          <button onClick={onToggleTheme} className="btn-secondary w-full">
            {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
            {theme === 'dark' ? 'Light mode' : 'Dark mode'}
          </button>
          <button onClick={logout} className="btn-secondary w-full">Sign out</button>
        </div>
      </aside>

      <main className="pb-24 lg:ml-64 lg:pb-0">
        {children}
      </main>

      <nav className="fixed inset-x-3 bottom-3 z-40 grid grid-cols-5 rounded-2xl border border-slate-200 bg-white/95 p-2 shadow-soft backdrop-blur-xl dark:border-slate-800 dark:bg-slate-950/95 min-[620px]:grid-cols-9 lg:hidden">
        {nav.map((item) => {
          const Icon = item.icon;
          const selected = active === item.id;
          return (
            <button key={item.id} onClick={() => onNavigate(item.id)} className={`grid place-items-center gap-1 rounded-xl px-1 py-2 text-[10px] font-semibold ${selected ? 'bg-orange-50 text-orange-700 dark:bg-orange-500/10 dark:text-orange-300' : 'text-slate-500'}`}>
              <Icon size={18} />
              <span className="hidden min-[420px]:inline">{item.label}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
