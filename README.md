# Money Manager Web

A full-stack Firebase money manager with React, Tailwind CSS, Framer Motion, Recharts, secure per-user data paths, and double-entry bookkeeping.

## Highlights

- Firebase Authentication with email/password and Google sign-in.
- Firestore-only backend data model under `users/{userId}` for strict user isolation.
- Double-entry transactions: every entry debits one account and credits another.
- Dashboard, transactions, budgets, reports, accounts, card tracking, bookmarks, recurring entries, imports, exports, settings, dark mode, and PIN lock.
- Firebase Functions scheduled job for recurring transactions.

## Local Setup

1. Create a Firebase project and enable Authentication providers: Email/Password and Google.
2. Create a `.env` file from `.env.example` and fill in your Firebase web app values.
3. Install dependencies:

```bash
npm install
cd functions && npm install
```

4. Run locally:

```bash
npm run dev
```

5. Build:

```bash
npm run build
```

## Deploy

```bash
npm run build
firebase deploy --only firestore:rules,firestore:indexes,storage,hosting
cd functions && npm run build
cd .. && firebase deploy --only functions
```

For Vercel, set the `VITE_FIREBASE_*` variables in Project Settings, build with `npm run build`, and deploy the `dist` output.

## Firestore Shape

All user-owned documents live below `users/{uid}`:

- `accounts/{accountId}`
- `transactions/{transactionId}`
- `budgets/{budgetId}`
- `bookmarks/{bookmarkId}`
- `recurring/{recurringId}`

This keeps security rules straightforward and prevents cross-user reads or writes.
