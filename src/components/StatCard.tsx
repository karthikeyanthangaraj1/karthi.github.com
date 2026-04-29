import type { ReactNode } from 'react';
import { motion } from 'framer-motion';

type Props = {
  label: string;
  value: string;
  icon: ReactNode;
  tone?: 'light' | 'dark';
};

export function StatCard({ label, value, icon, tone = 'light' }: Props) {
  const dark = tone === 'dark';
  return (
    <motion.div
      whileHover={{ y: -3 }}
      className={`rounded-xl p-4 shadow-soft ${dark ? 'bg-white/15 text-white ring-1 ring-white/20' : 'glass-panel text-slate-900'}`}
    >
      <div className="flex items-center justify-between gap-4">
        <div>
          <p className={`text-xs font-medium uppercase tracking-wide ${dark ? 'text-white/70' : 'text-slate-500 dark:text-slate-400'}`}>{label}</p>
          <p className="mt-2 text-2xl font-bold">{value}</p>
        </div>
        <div className={`grid h-11 w-11 place-items-center rounded-lg ${dark ? 'bg-white/15' : 'bg-orange-50 text-orange-600 dark:bg-orange-500/10'}`}>
          {icon}
        </div>
      </div>
    </motion.div>
  );
}
