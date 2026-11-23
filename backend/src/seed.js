/**
 * Resets the database and creates a demo account with ~4 months of realistic data.
 * Login: demo@example.com / Password123!
 */
require('dotenv').config({ quiet: true });
const fs = require('fs');
const path = require('path');
const bcrypt = require('bcryptjs');
const { createDb, addDefaultCategories } = require('./db');

if (process.env.NODE_ENV === 'production') {
  throw new Error('Demo seeding is disabled in production because it replaces the database');
}

const file = process.env.DB_PATH || path.join(__dirname, '..', 'data', 'finance.db');
for (const f of [file, `${file}-wal`, `${file}-shm`]) if (fs.existsSync(f)) fs.unlinkSync(f);
const db = createDb(file);

const uid = db.prepare('INSERT INTO users (name, email, password_hash, currency) VALUES (?, ?, ?, ?)')
  .run('Naledi Demo', 'demo@example.com', bcrypt.hashSync('Password123!', 10), 'ZAR').lastInsertRowid;
addDefaultCategories(db, uid);
const cat = Object.fromEntries(db.prepare('SELECT id, name FROM categories WHERE user_id = ?').all(uid).map((c) => [c.name, c.id]));
const type = Object.fromEntries(db.prepare('SELECT id, type FROM categories WHERE user_id = ?').all(uid).map((c) => [c.id, c.type]));

let seed = 42;
const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
const between = (a, b) => Math.round((a + rand() * (b - a)) * 100);

const addTx = db.prepare('INSERT INTO transactions (user_id, category_id, type, amount_cents, description, date) VALUES (?, ?, ?, ?, ?, ?)');
const today = new Date();
const fmt = (d) => d.toISOString().slice(0, 10);

db.transaction(() => {
  for (let back = 3; back >= 0; back--) {
    const y = today.getUTCFullYear();
    const m = today.getUTCMonth() - back;
    const lastDay = back === 0 ? today.getUTCDate() : new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
    const day = (d) => fmt(new Date(Date.UTC(y, m, Math.min(d, lastDay))));
    const tx = (name, cents, desc, d) => addTx.run(uid, cat[name], type[cat[name]], cents, desc, day(d));

    tx('Salary', 28500_00, 'Monthly salary', 1);
    if (rand() > 0.4) tx('Freelance', between(1500, 4500), 'Website project', 14);
    tx('Rent & housing', 8500_00, 'Rent', 1);
    tx('Utilities', between(850, 1300), 'Electricity & water', 3);
    tx('Utilities', 599_00, 'Fibre internet', 5);
    tx('Health', 1450_00, 'Medical aid', 2);
    tx('Education', 750_00, 'Online course subscription', 6);
    for (const d of [4, 11, 18, 25]) tx('Groceries', between(650, 1400), 'Weekly groceries', d);
    for (const d of [2, 9, 16, 23, 29]) tx('Transport', between(300, 700), 'Fuel', d);
    for (const d of [7, 15, 21, 27]) if (rand() > 0.25) tx('Eating out', between(150, 520), ['Lunch with friends', 'Takeaway', 'Coffee', 'Dinner'][Math.floor(rand() * 4)], d);
    tx('Entertainment', 199_00, 'Streaming subscriptions', 10);
    if (rand() > 0.5) tx('Entertainment', between(200, 600), 'Cinema', 20);
    if (rand() > 0.3) tx('Shopping', between(400, 2200), 'Clothing', 19);
  }
})();

const addBudget = db.prepare('INSERT INTO budgets (user_id, category_id, limit_cents) VALUES (?, ?, ?)');
addBudget.run(uid, cat.Groceries, 4500_00);
addBudget.run(uid, cat.Transport, 2200_00);
addBudget.run(uid, cat['Eating out'], 1000_00);
addBudget.run(uid, cat.Entertainment, 600_00);
addBudget.run(uid, cat.Shopping, 1500_00);

const addGoal = db.prepare('INSERT INTO goals (user_id, name, target_cents, saved_cents, deadline, icon) VALUES (?, ?, ?, ?, ?, ?)');
const addContribution = db.prepare('INSERT INTO goal_contributions (goal_id, amount_cents) VALUES (?, ?)');
const inMonths = (n) => fmt(new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + n, 28)));
for (const [name, target, saved, deadline, icon] of [
  ['Emergency fund', 60000_00, 24500_00, inMonths(12), 'shield-checkmark'],
  ['New laptop', 18000_00, 9200_00, inMonths(4), 'laptop'],
  ['Holiday in Cape Town', 12000_00, 12000_00, inMonths(2), 'airplane'],
]) {
  const id = addGoal.run(uid, name, target, saved, deadline, icon).lastInsertRowid;
  addContribution.run(id, saved);
}

console.log('Database seeded. Log in with demo@example.com / Password123!');
db.close();
