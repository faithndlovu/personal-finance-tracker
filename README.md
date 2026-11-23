# Personal Finance Tracker

A cross-platform **mobile app** (React Native + Expo) backed by a **REST API** (Node.js, Express, SQLite) for tracking income and expenses, setting monthly budgets and saving towards goals.

It covers **mobile development**, **database management**, **authentication** and **financial calculations**.

## Features

**Authentication**
- Register and sign in with bcrypt-hashed passwords and JWT tokens.
- The token is stored in the device keychain/keystore (`expo-secure-store`), so you stay signed in.
- Change your password, set your currency (ZAR, USD, EUR, GBP), or delete your account with all its data.

**Transactions**
- Add, edit and delete income and expenses with category, description and date.
- Browse by month, filter by income or expense, and search. Lists are grouped by day with daily totals.
- Comes with 14 default categories. You can also create your own with a colour and icon.

**Budgets**
- Set a monthly limit for any expense category.
- Progress bars show green (on track), amber (80% or more used) or red (over the limit), with the amount remaining or overspent.
- The overview screen warns you when budgets are close to or over their limits.

**Savings goals**
- Set a target, an optional deadline and a starting amount.
- Add or withdraw money. Every contribution is logged.
- The app works out how much you need to save each month to reach the goal on time.

**Overview dashboard**
- Balance, monthly income and expenses, net amount and savings rate.
- Daily average spending and projected month-end spending.
- Donut chart of spending by category and a 6-month income vs expenses chart.

**How the calculations work** (`backend/src/finance.js`, unit-tested)
- Money is stored as **integer cents**, so there are no floating-point errors (`0.1 + 0.2` gives exactly `0.30`).
- Savings rate = (income − expenses) ÷ income
- Projected spend = daily average so far × days in the month
- Monthly amount needed for a goal = remaining amount ÷ whole calendar months until the deadline
- Budget status: `ok` below 80%, `warning` from 80%, `over` above 100%

## Tech stack

| Part | Technology |
|---|---|
| Mobile | Expo SDK 58, React Native 0.88, TypeScript, Expo Router (file-based navigation, protected routes), react-native-svg charts, expo-secure-store |
| API | Node.js 22.13+, Express 5, SQLite (Node’s built-in `node:sqlite`, so there are no native modules to compile), JWT, bcrypt, CORS |
| Tests | API and finance tests (`node:test` and Supertest), TypeScript type-checking |

## Project structure

```
personal-finance-tracker/
├── backend/                 REST API
│   ├── src/
│   │   ├── app.js           Express app and /api/summary
│   │   ├── finance.js       Pure financial calculations
│   │   ├── db.js            Schema and default categories
│   │   ├── auth.js          JWT middleware
│   │   ├── seed.js          Demo data (4 months of transactions)
│   │   └── routes/          auth, categories, transactions, budgets, goals
│   └── tests/
└── mobile/                  Expo React Native app
    └── src/
        ├── app/             Screens (Expo Router)
        │   ├── _layout.tsx  Auth-protected navigation
        │   ├── sign-in.tsx, sign-up.tsx
        │   ├── (tabs)/      Overview, Transactions, Budgets, Goals, Settings
        │   ├── transaction.tsx, goal.tsx, categories.tsx
        ├── components/      UI kit, charts, bottom sheet
        └── lib/             API client, auth context, formatting, hooks
```

## Running it

You need **Node.js 22.13 or newer** (check with `node -v`) and, to run it on your phone, the **Expo Go** app from the App Store or Google Play.

### 1. Start the API

```bash
cd backend
npm install
npm run seed      # optional: demo account demo@example.com / Password123!
npm start
```

The API listens on port 4000 and prints your computer's network address, e.g. `http://192.168.1.20:4000`.

### 2. Start the mobile app

In a second terminal:

```bash
cd mobile
npm install
npx expo start
```

- **On your phone:** scan the QR code with Expo Go (Android) or the Camera app (iOS). Your phone must be on the **same Wi-Fi** as your computer.
- **Android emulator:** press `a`. **iOS simulator:** press `i` (macOS only).
- **In a browser:** press `w`.

The app finds the API automatically by using the IP address of the computer running Expo. If it can't connect, tap **Server settings** on the sign-in screen and enter the network address the API printed. You can also set `EXPO_PUBLIC_API_URL` in `mobile/.env`. On Windows, allow Node.js through the firewall when asked.

### Share it online

The web app is hosted on Vercel, the API on Railway, and mobile builds are shared through Expo EAS. Vercel serves the static app; the API needs a persistent Railway volume because the database is SQLite.

1. **Deploy the web app to Vercel.** Import this repository into your Vercel account, set the Root Directory to `mobile`, and deploy. [mobile/vercel.json](./mobile/vercel.json) configures the export and client-side routes. Note the production URL Vercel assigns.
2. **Deploy the API to Railway.** Create a service from this repository with `backend` as its root directory. Add a persistent volume mounted at `/data`, then set these service variables:
   - `NODE_ENV=production`
   - `DB_PATH=/data/finance.db`
   - `JWT_SECRET` to a randomly generated secret of at least 32 characters. Generate one locally with `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`. Never commit or share it.
   - `CORS_ORIGINS` to the exact Vercel origin, for example `https://your-project.vercel.app` (no trailing slash). Include additional trusted origins as a comma-separated list.
   Generate a public Railway domain and configure the service health check to use `/api/health`.
3. **Connect Vercel to the API.** In Vercel project settings, add `EXPO_PUBLIC_API_URL` with the Railway public URL (for example `https://your-api.up.railway.app`, without a trailing slash), then redeploy the web app. Since this URL is embedded in the client bundle, it is public configuration, not a secret.
4. **Build mobile apps for sharing.** Create an Expo account, then run these commands from `mobile`. Link the project when prompted and set the API URL in both EAS environments:
   ```bash
   cd mobile
   npx eas-cli@latest build:configure
   npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://your-api.up.railway.app --environment preview --visibility plaintext
   npx eas-cli@latest env:set --name EXPO_PUBLIC_API_URL --value https://your-api.up.railway.app --environment production --visibility plaintext
   npx eas-cli@latest build --platform android --profile preview
   ```
   The Android preview build is an installable APK. EAS provides a download link when the build completes. For iOS testers, run `npx eas-cli@latest build --platform ios --profile preview`; internal builds require Apple Developer credentials and registered tester devices. Wider distribution is through the app stores. [mobile/eas.json](./mobile/eas.json) contains the build profiles.

The API refuses to start in production without a strong `JWT_SECRET` and a configured `CORS_ORIGINS`. The demo seed command deletes and recreates its database and is intentionally blocked in production. Do not run it against live data. Enable and test backups for the Railway volume before inviting people to use real financial data. The example app identifiers in `mobile/app.json` must be replaced with identifiers you control before an app-store release.

### Tests

```bash
cd backend && npm test             # API + calculation + production-config tests
cd mobile && npm run typecheck     # TypeScript
```

## API reference

All routes except register, login and health need `Authorization: Bearer <token>`. Amounts are sent and returned as decimals (e.g. `149.99`).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/api/auth/register` | `{ name, email, password, currency? }` creates the account and default categories |
| POST | `/api/auth/login` | `{ email, password }` returns `{ token, user }` |
| GET / PUT / DELETE | `/api/auth/me` | Profile, update (name, currency, password), delete account |
| GET / POST | `/api/categories` | List / create categories |
| DELETE | `/api/categories/:id` | Delete (only if it has no transactions) |
| GET | `/api/transactions?month=YYYY-MM&type=&category_id=&q=` | List with totals |
| POST / PUT / DELETE | `/api/transactions[/:id]` | `{ amount, date, category_id, description? }` |
| GET | `/api/budgets?month=YYYY-MM` | Budgets with spent, remaining, percent and status |
| POST | `/api/budgets` | `{ category_id, limit }`. Creates the budget, or updates it if one exists |
| DELETE | `/api/budgets/:id` | Remove a budget |
| GET / POST | `/api/goals` | List with plan / create `{ name, target, saved?, deadline?, icon? }` |
| GET / PUT / DELETE | `/api/goals/:id` | Detail (with contributions) / update / delete |
| POST | `/api/goals/:id/contribute` | `{ amount }`. Use a negative amount to withdraw |
| GET | `/api/summary?month=YYYY-MM` | Dashboard: totals, savings rate, categories, trend, projection |

## License

MIT
