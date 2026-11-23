const express = require('express');
const { MONTH_RE, normalizeCurrency, toMinorUnits, fromMinorUnits, currentMonth, monthRange, budgetStatus } = require('../finance');

/** Monthly budgets per expense category, with spending for a given month. */
module.exports = function budgetRoutes(db) {
  const router = express.Router();

  function budgetsFor(userId, month, currency) {
    const [from, to] = monthRange(month);
    return db.prepare(`SELECT b.id, b.category_id, b.limit_minor, b.currency, c.name AS category_name, c.icon AS category_icon, c.color AS category_color,
        COALESCE((SELECT SUM(t.amount_minor) FROM transactions t WHERE t.category_id = b.category_id AND t.user_id = b.user_id
          AND t.currency = b.currency AND t.date BETWEEN ? AND ?), 0) AS spent_minor
      FROM budgets b JOIN categories c ON c.id = b.category_id WHERE b.user_id = ? AND b.currency = ? ORDER BY c.name`).all(from, to, userId, currency)
      .map((b) => {
        const s = budgetStatus(b.spent_minor, b.limit_minor);
        return {
          id: b.id, category_id: b.category_id, category_name: b.category_name, category_icon: b.category_icon,
          category_color: b.category_color, currency: b.currency,
          limit: fromMinorUnits(b.limit_minor, b.currency), spent: fromMinorUnits(s.spent_minor, b.currency),
          remaining: fromMinorUnits(s.remaining_minor, b.currency), percent: s.percent, status: s.status,
        };
      });
  }

  router.get('/', (req, res) => {
    const month = req.query.month || currentMonth();
    if (!MONTH_RE.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
    const currency = normalizeCurrency(req.query.currency || req.user.currency);
    if (!currency) return res.status(400).json({ error: 'Choose a supported ISO 4217 currency' });
    const budgets = budgetsFor(req.user.id, month, currency);
    const limit = budgets.reduce((a, b) => a + toMinorUnits(b.limit, currency), 0);
    const spent = budgets.reduce((a, b) => a + toMinorUnits(b.spent, currency), 0);
    res.json({
      month, currency, budgets,
      totals: {
        limit: fromMinorUnits(limit, currency),
        spent: fromMinorUnits(spent, currency),
        remaining: fromMinorUnits(limit - spent, currency),
        percent: limit ? Math.round((spent / limit) * 100) : 0,
      },
    });
  });

  /** Create or update the budget for a category. */
  router.post('/', (req, res) => {
    const { category_id, limit } = req.body || {};
    const currency = normalizeCurrency(req.body?.currency || req.user.currency);
    if (!currency) return res.status(400).json({ error: 'Choose a supported ISO 4217 currency' });
    const cat = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(Number(category_id), req.user.id);
    if (!cat) return res.status(400).json({ error: 'Choose a valid category' });
    if (cat.type !== 'expense') return res.status(400).json({ error: 'Budgets can only be set for expense categories' });
    const minor = toMinorUnits(limit, currency);
    if (minor === null || minor <= 0) return res.status(400).json({ error: 'Limit must be greater than 0' });
    db.prepare(`INSERT INTO budgets (user_id, category_id, limit_minor, currency) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, category_id, currency) DO UPDATE SET limit_minor = excluded.limit_minor`)
      .run(req.user.id, cat.id, minor, currency);
    const budget = budgetsFor(req.user.id, currentMonth(), currency).find((b) => b.category_id === cat.id);
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
