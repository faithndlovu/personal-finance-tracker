const express = require('express');
const { MONTH_RE, toCents, fromCents, currentMonth, monthRange, budgetStatus } = require('../finance');

/** Monthly budgets per expense category, with spending for a given month. */
module.exports = function budgetRoutes(db) {
  const router = express.Router();

  function budgetsFor(userId, month) {
    const [from, to] = monthRange(month);
    return db.prepare(`SELECT b.id, b.category_id, b.limit_cents, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
        COALESCE((SELECT SUM(t.amount_cents) FROM transactions t WHERE t.category_id = b.category_id AND t.user_id = b.user_id
          AND t.date BETWEEN ? AND ?), 0) AS spent_cents
      FROM budgets b JOIN categories c ON c.id = b.category_id WHERE b.user_id = ? ORDER BY c.name`).all(from, to, userId)
      .map((b) => {
        const s = budgetStatus(b.spent_cents, b.limit_cents);
        return {
          id: b.id, category_id: b.category_id, category_name: b.category_name, category_icon: b.category_icon, category_color: b.category_color,
          limit: fromCents(b.limit_cents), spent: fromCents(s.spent_cents), remaining: fromCents(s.remaining_cents), percent: s.percent, status: s.status,
        };
      });
  }

  router.get('/', (req, res) => {
    const month = req.query.month || currentMonth();
    if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
    const budgets = budgetsFor(req.user.id, month);
    const limit = budgets.reduce((a, b) => a + b.limit, 0);
    const spent = budgets.reduce((a, b) => a + b.spent, 0);
    res.json({
      month, budgets,
      totals: { limit: Math.round(limit * 100) / 100, spent: Math.round(spent * 100) / 100, remaining: Math.round((limit - spent) * 100) / 100, percent: limit ? Math.round((spent / limit) * 100) : 0 },
    });
  });

  /** Create or update the budget for a category. */
  router.post('/', (req, res) => {
    const { category_id, limit } = req.body || {};
    const cat = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(Number(category_id), req.user.id);
    if (!cat) return res.status(400).json({ error: 'Choose a valid category' });
    if (cat.type !== 'expense') return res.status(400).json({ error: 'Budgets can only be set for expense categories' });
    const cents = toCents(limit);
    if (cents === null || cents <= 0) return res.status(400).json({ error: 'Limit must be greater than 0' });
    db.prepare(`INSERT INTO budgets (user_id, category_id, limit_cents) VALUES (?, ?, ?)
      ON CONFLICT(user_id, category_id) DO UPDATE SET limit_cents = excluded.limit_cents`).run(req.user.id, cat.id, cents);
    const budget = budgetsFor(req.user.id, currentMonth()).find((b) => b.category_id === cat.id);
    res.status(201).json({ budget });
  });

  router.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM budgets WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
    if (!info.changes) return res.status(404).json({ error: 'Budget not found' });
    res.status(204).end();
  });

  router.budgetsFor = budgetsFor;
  return router;
};
