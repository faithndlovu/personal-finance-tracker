const express = require('express');
const cors = require('cors');
const { createDb } = require('./db');
const { authenticate } = require('./auth');
const F = require('./finance');

function createApp({ db = createDb() } = {}) {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: '100kb' }));
  const auth = authenticate(db);

  app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'finance-tracker-api' }));
  app.use('/api/auth', require('./routes/auth')(db));
  app.use('/api/categories', auth, require('./routes/categories')(db));
  app.use('/api/transactions', auth, require('./routes/transactions')(db));
  const budgets = require('./routes/budgets')(db);
  app.use('/api/budgets', auth, budgets);
  app.use('/api/goals', auth, require('./routes/goals')(db));

  /** Monthly overview: totals, savings rate, category breakdown, trend, projection, budgets and balance. */
  app.get('/api/summary', auth, (req, res) => {
    const month = req.query.month || F.currentMonth();
    if (!F.MONTH_RE.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
    const uid = req.user.id;
    const [from, to] = F.monthRange(month);
    const sum = (type, a, b) => db.prepare('SELECT COALESCE(SUM(amount_cents),0) AS n FROM transactions WHERE user_id = ? AND type = ? AND date BETWEEN ? AND ?').get(uid, type, a, b).n;

    const income = sum('income', from, to);
    const expense = sum('expense', from, to);
    const byCategory = db.prepare(`SELECT c.id, c.name, c.icon, c.color, SUM(t.amount_cents) AS total, COUNT(*) AS count
      FROM transactions t JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ? AND t.type = 'expense' AND t.date BETWEEN ? AND ? GROUP BY c.id ORDER BY total DESC`).all(uid, from, to)
      .map((c) => ({ ...c, total: F.fromCents(c.total), percent: expense ? Math.round((c.total / expense) * 100) : 0 }));
    const trend = F.previousMonths(month, 6).map((m) => {
      const [a, b] = F.monthRange(m);
      return { month: m, income: F.fromCents(sum('income', a, b)), expense: F.fromCents(sum('expense', a, b)) };
    });
    const balance = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount_cents ELSE -amount_cents END),0) AS n
      FROM transactions WHERE user_id = ? AND date <= ?`).get(uid, to).n;
    const projection = F.spendingProjection(expense, month);
    const budgetList = budgets.budgetsFor(uid, month);
    const recent = db.prepare(`SELECT t.id, t.type, t.amount_cents, t.description, t.date, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
      FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.user_id = ? ORDER BY t.date DESC, t.id DESC LIMIT 5`).all(uid)
      .map(({ amount_cents, ...t }) => ({ ...t, amount: F.fromCents(amount_cents) }));

    res.json({
      month,
      currency: req.user.currency,
      income: F.fromCents(income),
      expense: F.fromCents(expense),
      net: F.fromCents(income - expense),
      savings_rate: F.savingsRate(income, expense),
      balance: F.fromCents(balance),
      by_category: byCategory,
      trend,
      projection: {
        days_elapsed: projection.days_elapsed,
        days_in_month: projection.days_in_month,
        daily_average: F.fromCents(projection.daily_average_cents),
        projected_expense: F.fromCents(projection.projected_cents),
      },
      budgets: {
        count: budgetList.length,
        over: budgetList.filter((b) => b.status === 'over').length,
        warning: budgetList.filter((b) => b.status === 'warning').length,
      },
      recent,
    });
  });

  app.use('/api', (req, res) => res.status(404).json({ error: 'Not found' }));
  app.get('/', (req, res) => res.type('text').send('Finance Tracker API is running. See README for endpoints.'));

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    if (err.type === 'entity.parse.failed') return res.status(400).json({ error: 'Invalid JSON body' });
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = { createApp };
