const express = require('express');
const { MONTH_RE, toCents, fromCents, isValidDate, monthRange } = require('../finance');

const SELECT = `SELECT t.id, t.type, t.amount_cents, t.description, t.date, t.created_at, t.category_id,
  c.name AS category_name, c.icon AS category_icon, c.color AS category_color
  FROM transactions t JOIN categories c ON c.id = t.category_id`;

const serialize = ({ amount_cents, ...t }) => ({ ...t, amount: fromCents(amount_cents) });

module.exports = function transactionRoutes(db) {
  const router = express.Router();
  const getOne = (id, userId) => db.prepare(`${SELECT} WHERE t.id = ? AND t.user_id = ?`).get(id, userId);

  function validate(body, userId, existing) {
    const merged = { ...existing, ...body };
    const amount = toCents(merged.amount);
    if (amount === null || amount <= 0) return { error: 'Amount must be a number greater than 0' };
    if (amount > 100_000_000_00) return { error: 'Amount is too large' };
    if (!isValidDate(merged.date)) return { error: 'Date must be a valid YYYY-MM-DD date' };
    const cat = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(Number(merged.category_id), userId);
    if (!cat) return { error: 'Choose a valid category' };
    return { fields: { amount_cents: amount, date: merged.date, category_id: cat.id, type: cat.type, description: String(merged.description || '').trim().slice(0, 200) } };
  }

  router.get('/', (req, res) => {
    const { month, type, category_id, q, limit } = req.query;
    const where = ['t.user_id = ?'];
    const params = [req.user.id];
    if (month) {
      if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
      where.push('t.date BETWEEN ? AND ?'); params.push(...monthRange(month));
    }
    if (type) { where.push('t.type = ?'); params.push(type); }
    if (category_id) { where.push('t.category_id = ?'); params.push(Number(category_id)); }
    if (q) { where.push('(t.description LIKE ? OR c.name LIKE ?)'); params.push(`%${q}%`, `%${q}%`); }
    const lim = Math.min(Number(limit) || 500, 1000);
    const rows = db.prepare(`${SELECT} WHERE ${where.join(' AND ')} ORDER BY t.date DESC, t.id DESC LIMIT ${lim}`).all(...params);
    const totals = rows.reduce((a, t) => { a[t.type] += t.amount_cents; return a; }, { income: 0, expense: 0 });
    res.json({ transactions: rows.map(serialize), totals: { income: fromCents(totals.income), expense: fromCents(totals.expense), net: fromCents(totals.income - totals.expense) } });
  });

  router.post('/', (req, res) => {
    const { error, fields } = validate(req.body || {}, req.user.id, {});
    if (error) return res.status(400).json({ error });
    const info = db.prepare('INSERT INTO transactions (user_id, category_id, type, amount_cents, description, date) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, fields.category_id, fields.type, fields.amount_cents, fields.description, fields.date);
    res.status(201).json({ transaction: serialize(getOne(info.lastInsertRowid, req.user.id)) });
  });

  router.get('/:id', (req, res) => {
    const t = getOne(Number(req.params.id), req.user.id);
    if (!t) return res.status(404).json({ error: 'Transaction not found' });
    res.json({ transaction: serialize(t) });
  });

  router.put('/:id', (req, res) => {
    const existing = getOne(Number(req.params.id), req.user.id);
    if (!existing) return res.status(404).json({ error: 'Transaction not found' });
    const { error, fields } = validate(req.body || {}, req.user.id, serialize(existing));
    if (error) return res.status(400).json({ error });
    db.prepare('UPDATE transactions SET category_id = ?, type = ?, amount_cents = ?, description = ?, date = ? WHERE id = ?')
      .run(fields.category_id, fields.type, fields.amount_cents, fields.description, fields.date, existing.id);
    res.json({ transaction: serialize(getOne(existing.id, req.user.id)) });
  });

  router.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM transactions WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
    if (!info.changes) return res.status(404).json({ error: 'Transaction not found' });
    res.status(204).end();
  });

  return router;
};
