const { test } = require('node:test');
const assert = require('node:assert/strict');
const { openDatabase } = require('../src/sqlite');
const { migrateCurrencySchema } = require('../src/db');
const { fromMinorUnits } = require('../src/finance');

test('migrates existing amounts into each user currency without changing their value', () => {
  const db = openDatabase(':memory:');
  db.pragma('foreign_keys = ON');
  db.exec(`
    CREATE TABLE users (id INTEGER PRIMARY KEY, currency TEXT NOT NULL);
    CREATE TABLE categories (id INTEGER PRIMARY KEY);
    CREATE TABLE transactions (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      type TEXT NOT NULL,
      amount_cents INTEGER NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE budgets (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      category_id INTEGER NOT NULL REFERENCES categories(id),
      limit_cents INTEGER NOT NULL,
      UNIQUE (user_id, category_id)
    );
    CREATE TABLE goals (
      id INTEGER PRIMARY KEY,
      user_id INTEGER NOT NULL REFERENCES users(id),
      name TEXT NOT NULL,
      target_cents INTEGER NOT NULL,
      saved_cents INTEGER NOT NULL,
      deadline TEXT,
      icon TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE TABLE goal_contributions (
      id INTEGER PRIMARY KEY,
      goal_id INTEGER NOT NULL REFERENCES goals(id),
      amount_cents INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
    CREATE INDEX idx_tx_user_date ON transactions(user_id, date);
  `);
  db.prepare('INSERT INTO users (id, currency) VALUES (1, ?)').run('KWD');
  db.prepare('INSERT INTO categories (id) VALUES (1)').run();
  db.prepare('INSERT INTO transactions (id, user_id, category_id, type, amount_cents, date) VALUES (1, 1, 1, ?, ?, ?)')
    .run('expense', 12345, '2026-01-01');
  db.prepare('INSERT INTO budgets (id, user_id, category_id, limit_cents) VALUES (1, 1, 1, ?)').run(8500);
  db.prepare('INSERT INTO goals (id, user_id, name, target_cents, saved_cents, icon) VALUES (1, 1, ?, ?, ?, ?)')
    .run('Reserve', 100000, 2500, 'flag');
  db.prepare('INSERT INTO goal_contributions (id, goal_id, amount_cents) VALUES (1, 1, ?)').run(2500);

  migrateCurrencySchema(db);

  assert.equal(db.prepare('SELECT role FROM users WHERE id = 1').get().role, 'user');
  const tx = db.prepare('SELECT amount_minor, currency FROM transactions WHERE id = 1').get();
  assert.equal(tx.currency, 'KWD');
  assert.equal(fromMinorUnits(tx.amount_minor, tx.currency), 123.45);
  const budget = db.prepare('SELECT limit_minor, currency FROM budgets WHERE id = 1').get();
  assert.equal(budget.currency, 'KWD');
  assert.equal(fromMinorUnits(budget.limit_minor, budget.currency), 85);
  const goal = db.prepare('SELECT target_minor, saved_minor, currency FROM goals WHERE id = 1').get();
  assert.equal(goal.currency, 'KWD');
  assert.equal(fromMinorUnits(goal.target_minor, goal.currency), 1000);
  assert.equal(fromMinorUnits(goal.saved_minor, goal.currency), 25);
  const contribution = db.prepare('SELECT amount_minor FROM goal_contributions WHERE id = 1').get();
  assert.equal(fromMinorUnits(contribution.amount_minor, goal.currency), 25);

  db.prepare('INSERT INTO budgets (user_id, category_id, limit_minor, currency) VALUES (1, 1, 500, ?)').run('USD');
  assert.deepEqual(db.prepare('PRAGMA foreign_key_check').all(), []);
  const indexes = db.prepare('PRAGMA index_list(transactions)').all().map((index) => index.name);
  assert.ok(indexes.includes('idx_tx_user_currency_date'));
  assert.ok(!indexes.includes('idx_tx_user_date'));
  db.close();
});
