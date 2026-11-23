const { test, describe, before } = require('node:test');
const assert = require('node:assert/strict');
const request = require('supertest');
const { createApp } = require('../src/app');
const { createDb } = require('../src/db');
const { currentMonth } = require('../src/finance');

describe('Finance Tracker API', () => {
  const app = createApp({ db: createDb(':memory:') });
  let token, otherToken, cats;
  const auth = (t = token) => ({ Authorization: `Bearer ${t}` });
  const month = currentMonth();
  const day = (d) => `${month}-${String(d).padStart(2, '0')}`;

  before(async () => {
    const r = await request(app).post('/api/auth/register').send({ name: 'Ann', email: 'ann@test.dev', password: 'Password123!' }).expect(201);
    token = r.body.token;
    const o = await request(app).post('/api/auth/register').send({ name: 'Bob', email: 'bob@test.dev', password: 'Password123!' }).expect(201);
    otherToken = o.body.token;
    const c = await request(app).get('/api/categories').set(auth()).expect(200);
    cats = Object.fromEntries(c.body.categories.map((x) => [x.name, x]));
  });

  test('registration creates default categories and ZAR currency', async () => {
    assert.ok(cats.Salary && cats.Groceries);
    const me = await request(app).get('/api/auth/me').set(auth()).expect(200);
    assert.equal(me.body.user.currency, 'ZAR');
  });

  test('auth errors', async () => {
    await request(app).post('/api/auth/login').send({ email: 'ann@test.dev', password: 'nope' }).expect(401);
    await request(app).post('/api/auth/register').send({ name: 'A', email: 'ann@test.dev', password: 'Password123!' }).expect(409);
    await request(app).get('/api/transactions').expect(401);
  });

  test('transaction validation', async () => {
    await request(app).post('/api/transactions').set(auth()).send({ amount: -5, date: day(1), category_id: cats.Salary.id }).expect(400);
    await request(app).post('/api/transactions').set(auth()).send({ amount: 5, date: '2026-02-30', category_id: cats.Salary.id }).expect(400);
    await request(app).post('/api/transactions').set(auth()).send({ amount: 5, date: day(1), category_id: 99999 }).expect(400);
  });

  test('transaction CRUD; type follows category; amounts are exact', async () => {
    const salary = await request(app).post('/api/transactions').set(auth()).send({ amount: '20000', date: day(1), category_id: cats.Salary.id, description: 'Pay' }).expect(201);
    assert.equal(salary.body.transaction.type, 'income');
    assert.equal(salary.body.transaction.amount, 20000);
    const g1 = await request(app).post('/api/transactions').set(auth()).send({ amount: 0.1, date: day(1), category_id: cats.Groceries.id }).expect(201);
    await request(app).post('/api/transactions').set(auth()).send({ amount: 0.2, date: day(1), category_id: cats.Groceries.id }).expect(201);
    await request(app).post('/api/transactions').set(auth()).send({ amount: 3999.7, date: day(1), category_id: cats.Groceries.id }).expect(201);
    await request(app).post('/api/transactions').set(auth()).send({ amount: 1000, date: day(1), category_id: cats.Transport.id }).expect(201);

    const list = await request(app).get(`/api/transactions?month=${month}&type=expense`).set(auth()).expect(200);
    assert.equal(list.body.transactions.length, 4);
    assert.equal(list.body.totals.expense, 5000);

    const upd = await request(app).put(`/api/transactions/${g1.body.transaction.id}`).set(auth()).send({ description: 'Milk' }).expect(200);
    assert.equal(upd.body.transaction.description, 'Milk');
    assert.equal(upd.body.transaction.amount, 0.1);

    // isolation between users
    await request(app).get(`/api/transactions/${g1.body.transaction.id}`).set(auth(otherToken)).expect(404);
    await request(app).delete(`/api/transactions/${g1.body.transaction.id}`).set(auth(otherToken)).expect(404);
    const search = await request(app).get('/api/transactions?q=Milk').set(auth()).expect(200);
    assert.equal(search.body.transactions.length, 1);
  });

  test('budgets: upsert, usage and status', async () => {
    await request(app).post('/api/budgets').set(auth()).send({ category_id: cats.Salary.id, limit: 100 }).expect(400);
    await request(app).post('/api/budgets').set(auth()).send({ category_id: cats.Groceries.id, limit: 3000 }).expect(201);
    const up = await request(app).post('/api/budgets').set(auth()).send({ category_id: cats.Groceries.id, limit: 5000 }).expect(201);
    assert.equal(up.body.budget.limit, 5000);
    await request(app).post('/api/budgets').set(auth()).send({ category_id: cats.Transport.id, limit: 800 }).expect(201);
    const b = await request(app).get(`/api/budgets?month=${month}`).set(auth()).expect(200);
    const groceries = b.body.budgets.find((x) => x.category_name === 'Groceries');
    const transport = b.body.budgets.find((x) => x.category_name === 'Transport');
    assert.equal(b.body.budgets.length, 2);
    assert.equal(groceries.spent, 4000);
    assert.equal(groceries.status, 'warning');
    assert.equal(transport.status, 'over');
    assert.equal(transport.remaining, -200);
  });

  test('goals: create, contribute, withdraw limits, plan', async () => {
    await request(app).post('/api/goals').set(auth()).send({ name: '', target: 100 }).expect(400);
    const g = await request(app).post('/api/goals').set(auth()).send({ name: 'Laptop', target: 12000, saved: 2000, deadline: '2099-01-01' }).expect(201);
    assert.equal(g.body.goal.percent, 17);
    assert.ok(g.body.goal.monthly_needed > 0);
    const c = await request(app).post(`/api/goals/${g.body.goal.id}/contribute`).set(auth()).send({ amount: 10000 }).expect(200);
    assert.equal(c.body.goal.achieved, true);
    assert.equal(c.body.goal.monthly_needed, null);
    await request(app).post(`/api/goals/${g.body.goal.id}/contribute`).set(auth()).send({ amount: -20000 }).expect(400);
    await request(app).post(`/api/goals/${g.body.goal.id}/contribute`).set(auth()).send({ amount: -500 }).expect(200);
    const detail = await request(app).get(`/api/goals/${g.body.goal.id}`).set(auth()).expect(200);
    assert.equal(detail.body.contributions.length, 3);
    assert.equal(detail.body.goal.saved, 11500);
  });

  test('summary: totals, savings rate, breakdown, trend', async () => {
    const s = await request(app).get(`/api/summary?month=${month}`).set(auth()).expect(200);
    assert.equal(s.body.income, 20000);
    assert.equal(s.body.expense, 5000);
    assert.equal(s.body.net, 15000);
    assert.equal(s.body.savings_rate, 75);
    assert.equal(s.body.balance, 15000);
    assert.equal(s.body.by_category[0].name, 'Groceries');
    assert.equal(s.body.by_category[0].percent, 80);
    assert.equal(s.body.trend.length, 6);
    assert.equal(s.body.trend[5].month, month);
    assert.equal(s.body.budgets.over, 1);
    assert.ok(s.body.projection.projected_expense >= 5000);
    await request(app).get('/api/summary?month=2026-13').set(auth()).expect(400);
  });

  test('categories: create custom, cannot delete in-use', async () => {
    await request(app).post('/api/categories').set(auth()).send({ name: 'Pets', type: 'expense', color: '#123456' }).expect(201);
    await request(app).post('/api/categories').set(auth()).send({ name: 'Pets', type: 'expense' }).expect(409);
    await request(app).delete(`/api/categories/${cats.Groceries.id}`).set(auth()).expect(409);
  });

  test('profile update and account deletion', async () => {
    const u = await request(app).put('/api/auth/me').set(auth()).send({ currency: 'usd' }).expect(200);
    assert.equal(u.body.user.currency, 'USD');
    await request(app).delete('/api/auth/me').set(auth(otherToken)).send({ password: 'wrong' }).expect(400);
    await request(app).delete('/api/auth/me').set(auth(otherToken)).send({ password: 'Password123!' }).expect(204);
    await request(app).get('/api/auth/me').set(auth(otherToken)).expect(401);
  });
});
