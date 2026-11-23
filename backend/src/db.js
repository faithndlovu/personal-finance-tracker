const path = require('path');
const fs = require('fs');
const { openDatabase } = require('./sqlite');
const { currencyFractionDigits } = require('./finance');

// Money is stored in each currency's smallest unit to avoid floating-point rounding errors.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'ZAR',
  role          TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin')),
  token_version INTEGER NOT NULL DEFAULT 0,
  created_at    TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS categories (
  id      INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name    TEXT NOT NULL,
  type    TEXT NOT NULL CHECK (type IN ('income','expense')),
  icon    TEXT NOT NULL DEFAULT 'pricetag',
  color   TEXT NOT NULL DEFAULT '#64748b',
  UNIQUE (user_id, name, type)
);

CREATE TABLE IF NOT EXISTS transactions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id  INTEGER NOT NULL REFERENCES categories(id),
  type         TEXT NOT NULL CHECK (type IN ('income','expense')),
  amount_minor INTEGER NOT NULL CHECK (amount_minor > 0),
  currency     TEXT NOT NULL DEFAULT 'ZAR',
  description  TEXT NOT NULL DEFAULT '',
  date         TEXT NOT NULL,              -- YYYY-MM-DD
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budgets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  limit_minor INTEGER NOT NULL CHECK (limit_minor > 0),
  currency    TEXT NOT NULL DEFAULT 'ZAR',
  UNIQUE (user_id, category_id, currency)
);

CREATE TABLE IF NOT EXISTS goals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  target_minor INTEGER NOT NULL CHECK (target_minor > 0),
  saved_minor  INTEGER NOT NULL DEFAULT 0 CHECK (saved_minor >= 0),
  currency     TEXT NOT NULL DEFAULT 'ZAR',
  deadline     TEXT,                       -- YYYY-MM-DD
  icon         TEXT NOT NULL DEFAULT 'flag',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id      INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount_minor INTEGER NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
  token_hash TEXT PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires_at TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

`;

const DEFAULT_CATEGORIES = [
  ['Salary', 'income', 'briefcase', '#16a34a'],
  ['Freelance', 'income', 'laptop', '#0d9488'],
  ['Investments', 'income', 'trending-up', '#2563eb'],
  ['Other income', 'income', 'cash', '#65a30d'],
  ['Groceries', 'expense', 'cart', '#f97316'],
  ['Rent & housing', 'expense', 'home', '#8b5cf6'],
  ['Transport', 'expense', 'car', '#0ea5e9'],
  ['Utilities', 'expense', 'flash', '#eab308'],
  ['Eating out', 'expense', 'restaurant', '#ef4444'],
  ['Entertainment', 'expense', 'film', '#ec4899'],
  ['Health', 'expense', 'medkit', '#14b8a6'],
  ['Shopping', 'expense', 'bag-handle', '#a855f7'],
  ['Education', 'expense', 'school', '#6366f1'],
  ['Other', 'expense', 'ellipsis-horizontal', '#64748b'],
];

function createDb(file) {
  const target = file || process.env.DB_PATH || path.join(__dirname, '..', 'data', 'finance.db');
  if (target !== ':memory:') fs.mkdirSync(path.dirname(target), { recursive: true });
  const db = openDatabase(target);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');
  db.exec(SCHEMA);
  migrateCurrencySchema(db);
  if (process.env.ADMIN_EMAIL) {
    db.prepare('UPDATE users SET role = ? WHERE email = ? COLLATE NOCASE')
      .run('admin', process.env.ADMIN_EMAIL.trim());
  }
  return db;
}

function columns(db, table) {
  return new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
}

function rescaleLegacyValues(db, query, update) {
  const rows = db.prepare(query).all();
  const statement = db.prepare(update);
  for (const row of rows) {
    const digits = currencyFractionDigits(row.currency);
    statement.run(Math.round((row.value / 100) * (10 ** digits)), row.id);
  }
}

function migrateCurrencySchema(db) {
  const userColumns = columns(db, 'users');
  const txColumns = columns(db, 'transactions');
  const budgetColumns = columns(db, 'budgets');
  const goalColumns = columns(db, 'goals');
  const contributionColumns = columns(db, 'goal_contributions');

  const migrate = db.transaction(() => {
    if (userColumns.size > 0 && !userColumns.has('role')) {
      db.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user','admin'))");
    }
    if (userColumns.size > 0 && !userColumns.has('token_version')) {
      db.exec('ALTER TABLE users ADD COLUMN token_version INTEGER NOT NULL DEFAULT 0');
    }
    if (txColumns.has('amount_cents')) {
      db.exec('ALTER TABLE transactions RENAME COLUMN amount_cents TO amount_minor');
      db.exec("ALTER TABLE transactions ADD COLUMN currency TEXT NOT NULL DEFAULT 'ZAR'");
      db.exec('UPDATE transactions SET currency = (SELECT UPPER(currency) FROM users WHERE users.id = transactions.user_id)');
      rescaleLegacyValues(
        db,
        'SELECT id, amount_minor AS value, currency FROM transactions',
        'UPDATE transactions SET amount_minor = ? WHERE id = ?',
      );
    }

    if (budgetColumns.has('limit_cents')) {
      db.exec(`CREATE TABLE budgets_new (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
        category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
        limit_minor INTEGER NOT NULL CHECK (limit_minor > 0),
        currency TEXT NOT NULL DEFAULT 'ZAR',
        UNIQUE (user_id, category_id, currency)
      )`);
      db.exec(`INSERT INTO budgets_new (id, user_id, category_id, limit_minor, currency)
        SELECT b.id, b.user_id, b.category_id, b.limit_cents, UPPER(u.currency)
        FROM budgets b JOIN users u ON u.id = b.user_id`);
      db.exec('DROP TABLE budgets');
      db.exec('ALTER TABLE budgets_new RENAME TO budgets');
      rescaleLegacyValues(
        db,
        'SELECT id, limit_minor AS value, currency FROM budgets',
        'UPDATE budgets SET limit_minor = ? WHERE id = ?',
      );
    }

    if (goalColumns.has('target_cents')) {
      db.exec('ALTER TABLE goals RENAME COLUMN target_cents TO target_minor');
      db.exec('ALTER TABLE goals RENAME COLUMN saved_cents TO saved_minor');
      db.exec("ALTER TABLE goals ADD COLUMN currency TEXT NOT NULL DEFAULT 'ZAR'");
      db.exec('UPDATE goals SET currency = (SELECT UPPER(currency) FROM users WHERE users.id = goals.user_id)');
      rescaleLegacyValues(
        db,
        'SELECT id, target_minor AS value, currency FROM goals',
        'UPDATE goals SET target_minor = ? WHERE id = ?',
      );
      rescaleLegacyValues(
        db,
        'SELECT id, saved_minor AS value, currency FROM goals',
        'UPDATE goals SET saved_minor = ? WHERE id = ?',
      );
    }

    if (contributionColumns.has('amount_cents')) {
      db.exec('ALTER TABLE goal_contributions RENAME COLUMN amount_cents TO amount_minor');
      rescaleLegacyValues(
        db,
        `SELECT c.id, c.amount_minor AS value, g.currency
          FROM goal_contributions c JOIN goals g ON g.id = c.goal_id`,
        'UPDATE goal_contributions SET amount_minor = ? WHERE id = ?',
      );
    }
  });

  migrate();
  db.exec(`CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash TEXT PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);
  db.exec('DROP INDEX IF EXISTS idx_tx_user_date');
  db.exec('CREATE INDEX IF NOT EXISTS idx_tx_user_currency_date ON transactions(user_id, currency, date)');
}

function addDefaultCategories(db, userId) {
  const ins = db.prepare('INSERT OR IGNORE INTO categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)');
  for (const c of DEFAULT_CATEGORIES) ins.run(userId, ...c);
}

module.exports = { createDb, migrateCurrencySchema, addDefaultCategories };
