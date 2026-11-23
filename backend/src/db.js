const path = require('path');
const fs = require('fs');
const { openDatabase } = require('./sqlite');

// Money is stored as integer cents to avoid floating-point rounding errors.
const SCHEMA = `
CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  name          TEXT NOT NULL,
  email         TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL,
  currency      TEXT NOT NULL DEFAULT 'ZAR',
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
  amount_cents INTEGER NOT NULL CHECK (amount_cents > 0),
  description  TEXT NOT NULL DEFAULT '',
  date         TEXT NOT NULL,              -- YYYY-MM-DD
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS budgets (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  limit_cents INTEGER NOT NULL CHECK (limit_cents > 0),
  UNIQUE (user_id, category_id)
);

CREATE TABLE IF NOT EXISTS goals (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id      INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  target_cents INTEGER NOT NULL CHECK (target_cents > 0),
  saved_cents  INTEGER NOT NULL DEFAULT 0 CHECK (saved_cents >= 0),
  deadline     TEXT,                       -- YYYY-MM-DD
  icon         TEXT NOT NULL DEFAULT 'flag',
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS goal_contributions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  goal_id      INTEGER NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  amount_cents INTEGER NOT NULL,
  created_at   TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_tx_user_date ON transactions(user_id, date);
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
  return db;
}

function addDefaultCategories(db, userId) {
  const ins = db.prepare('INSERT OR IGNORE INTO categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)');
  for (const c of DEFAULT_CATEGORIES) ins.run(userId, ...c);
}

module.exports = { createDb, addDefaultCategories };
