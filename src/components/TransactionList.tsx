import { ArrowDownLeft, ArrowRightLeft, ArrowUpRight, Trash2 } from 'lucide-react';
import { currency, shortDate } from '../lib/format';
import type { Account, Transaction, UserSettings } from '../types';

type Props = {
  transactions: Transaction[];
  accounts: Account[];
  settings: UserSettings;
  onDelete?: (tx: Transaction) => void;
};

export function TransactionList({ transactions, accounts, settings, onDelete }: Props) {
  const name = (id: string) => accounts.find((account) => account.id === id)?.name || 'Unknown';

  if (!transactions.length) {
    return <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-500 dark:border-slate-700">No transactions yet.</div>;
  }

  return (
    <div className="space-y-3">
      {transactions.map((tx) => {
        const Icon = tx.type === 'income' ? ArrowDownLeft : tx.type === 'expense' ? ArrowUpRight : ArrowRightLeft;
        const tone = tx.type === 'income' ? 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10' : tx.type === 'expense' ? 'text-rose-600 bg-rose-50 dark:bg-rose-500/10' : 'text-blue-600 bg-blue-50 dark:bg-blue-500/10';

        return (
          <div key={tx.id} className="flex items-center gap-3 rounded-xl bg-white p-3 shadow-sm ring-1 ring-slate-100 transition hover:shadow-md dark:bg-slate-900 dark:ring-slate-800">
            <div className={`grid h-10 w-10 shrink-0 place-items-center rounded-lg ${tone}`}>
              <Icon size={18} />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <p className="truncate font-semibold text-slate-900 dark:text-slate-100">{tx.category}</p>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-500 dark:bg-slate-800">{tx.type}</span>
              </div>
              <p className="truncate text-xs text-slate-500">{shortDate(tx.date)} · Dr {name(tx.debitAccountId)} · Cr {name(tx.creditAccountId)}</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-slate-900 dark:text-slate-100">{currency(tx.amount, settings.currency)}</p>
              {onDelete && (
                <button className="mt-1 inline-flex text-slate-400 transition hover:text-rose-600" title="Delete transaction" onClick={() => onDelete(tx)}>
                  <Trash2 size={15} />
                </button>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
