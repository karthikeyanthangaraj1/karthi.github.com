import { z } from 'zod';

const positiveAmount = z.coerce.number().positive('Amount must be greater than zero');

export const transactionSchema = z.object({
  type: z.enum(['income', 'expense', 'transfer']),
  amount: positiveAmount,
  category: z.string().min(1, 'Choose a category'),
  debitAccountId: z.string().min(1, 'Choose a debit account'),
  creditAccountId: z.string().min(1, 'Choose a credit account'),
  date: z.coerce.date(),
  notes: z.string().max(240).optional()
}).refine((value) => value.debitAccountId !== value.creditAccountId, {
  message: 'Debit and credit accounts must be different',
  path: ['creditAccountId']
});

export const accountSchema = z.object({
  name: z.string().min(2, 'Name is too short'),
  type: z.enum(['cash', 'bank', 'credit', 'wallet', 'investment', 'income', 'expense', 'equity', 'liability']),
  balance: z.coerce.number(),
  currency: z.string().min(3).max(3),
  institution: z.string().optional(),
  billingCycleDay: z.coerce.number().min(1).max(31).optional(),
  dueDay: z.coerce.number().min(1).max(31).optional(),
  creditLimit: z.coerce.number().nonnegative().optional()
});

export const budgetSchema = z.object({
  category: z.string().min(1),
  month: z.string().regex(/^\d{4}-\d{2}$/),
  monthlyLimit: z.coerce.number().nonnegative()
});

export const debtSchema = z.object({
  lender: z.string().min(1, 'Enter lender or loan name').max(80),
  principal: z.coerce.number().nonnegative('Debt amount cannot be negative'),
  monthlyPayment: z.coerce.number().nonnegative('Monthly payment cannot be negative'),
  paidAmount: z.coerce.number().nonnegative('Completed amount cannot be negative'),
  interestRate: z.coerce.number().min(0).max(100).optional(),
  dueDay: z.coerce.number().min(1).max(31).optional(),
  notes: z.string().max(240).optional()
}).refine((value) => value.paidAmount <= value.principal, {
  message: 'Completed amount cannot be more than total debt',
  path: ['paidAmount']
});

export const investmentSchema = z.object({
  investmentType: z.string().min(1),
  customInvestmentType: z.string().max(80).optional(),
  fundName: z.string().min(1, 'Enter investment name').max(100),
  folioNumber: z.string().max(80).optional(),
  amount: z.coerce.number().nonnegative('Amount cannot be negative'),
  frequency: z.enum(['weekly', 'monthly', 'yearly']),
  startDate: z.coerce.date(),
  paidInstallments: z.coerce.number().int().nonnegative(),
  targetInstallments: z.coerce.number().int().nonnegative().optional(),
  notes: z.string().max(240).optional()
}).refine((value) => value.investmentType !== 'Add' || Boolean(value.customInvestmentType?.trim()), {
  message: 'Enter custom investment type',
  path: ['customInvestmentType']
});

export const pinSchema = z.string().regex(/^\d{4,12}$/, 'PIN must be 4 to 12 digits');

export function parseOrThrow<T>(schema: z.ZodType<T>, value: unknown) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new Error(result.error.issues[0]?.message || 'Invalid input');
  }
  return result.data;
}
