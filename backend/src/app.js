const express = require('express');
const cors = require('cors');
const { createDb } = require('./db');
const { authenticate } = require('./auth');
const F = require('./finance');

function createApp({ db = createDb() } = {}) {
  const app = express();
  const allowedOrigins = (process.env.CORS_ORIGINS || '').split(',').map((origin) => origin.trim()).filter(Boolean);
  if (process.env.NODE_ENV === 'production' && allowedOrigins.length === 0) {
    throw new Error('CORS_ORIGINS must contain the deployed web app origin in production');
  }
  app.use(cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.length === 0 || allowedOrigins.includes(origin)) return callback(null, true);
      return callback(null, false);
    },
  }));
  app.use(express.json({ limit: '100kb' }));
  const auth = authenticate(db);

  app.get('/api/health', (req, res) => res.json({ status: 'ok', service: 'finance-tracker-api' }));
  app.get('/api/currencies', (req, res) => res.json({ currencies: F.listCurrencies() }));
  app.use('/api/auth', require('./routes/auth')(db));
  app.use('/api/categories', auth, require('./routes/categories')(db));
  app.use('/api/transactions', auth, require('./routes/transactions')(db));
  app.use('/api/admin', auth, require('./routes/admin')(db));
  const budgets = require('./routes/budgets')(db);
  app.use('/api/budgets', auth, budgets);
  app.use('/api/goals', auth, require('./routes/goals')(db));

  /** Monthly overview: totals, savings rate, category breakdown, trend, projection, budgets and balance. */
  app.get('/api/summary', auth, (req, res) => {
    const month = req.query.month || F.currentMonth();
    if (!F.MONTH_RE.test(month)) return res.status(400).json({ error: 'month must be YYYY-MM' });
    const currency = F.normalizeCurrency(req.query.currency || req.user.currency);
    if (!currency) return res.status(400).json({ error: 'Choose a supported ISO 4217 currency' });
    const uid = req.user.id;
    const [from, to] = F.monthRange(month);
    const sum = (type, a, b) => db.prepare('SELECT COALESCE(SUM(amount_minor),0) AS n FROM transactions WHERE user_id = ? AND currency = ? AND type = ? AND date BETWEEN ? AND ?').get(uid, currency, type, a, b).n;

    const income = sum('income', from, to);
    const expense = sum('expense', from, to);
    const byCategory = db.prepare(`SELECT c.id, c.name, c.icon, c.color, SUM(t.amount_minor) AS total, COUNT(*) AS count
      FROM transactions t JOIN categories c ON c.id = t.category_id
      WHERE t.user_id = ? AND t.currency = ? AND t.type = 'expense' AND t.date BETWEEN ? AND ? GROUP BY c.id ORDER BY total DESC`).all(uid, currency, from, to)
      .map((c) => ({ ...c, total: F.fromMinorUnits(c.total, currency), percent: expense ? Math.round((c.total / expense) * 100) : 0 }));
    const trend = F.previousMonths(month, 6).map((m) => {
      const [a, b] = F.monthRange(m);
      return { month: m, income: F.fromMinorUnits(sum('income', a, b), currency), expense: F.fromMinorUnits(sum('expense', a, b), currency) };
    });
    const balance = db.prepare(`SELECT COALESCE(SUM(CASE WHEN type='income' THEN amount_minor ELSE -amount_minor END),0) AS n
      FROM transactions WHERE user_id = ? AND currency = ? AND date <= ?`).get(uid, currency, to).n;
    const projection = F.spendingProjection(expense, month);
    const budgetList = budgets.budgetsFor(uid, month, currency);
    const recent = db.prepare(`SELECT t.id, t.type, t.amount_minor, t.currency, t.description, t.date, c.name AS category_name, c.icon AS category_icon, c.color AS category_color
      FROM transactions t JOIN categories c ON c.id = t.category_id WHERE t.user_id = ? AND t.currency = ? ORDER BY t.date DESC, t.id DESC LIMIT 5`).all(uid, currency)
      .map(({ amount_minor, currency: transactionCurrency, ...t }) => ({
        ...t, currency: transactionCurrency, amount: F.fromMinorUnits(amount_minor, transactionCurrency),
      }));

    res.json({
      month,
      currency,
      income: F.fromMinorUnits(income, currency),
      expense: F.fromMinorUnits(expense, currency),
      net: F.fromMinorUnits(income - expense, currency),
      savings_rate: F.savingsRate(income, expense),
      balance: F.fromMinorUnits(balance, currency),
      by_category: byCategory,
      trend,
      projection: {
        days_elapsed: projection.days_elapsed,
        days_in_month: projection.days_in_month,
        daily_average: F.fromMinorUnits(projection.daily_average_minor, currency),
        projected_expense: F.fromMinorUnits(projection.projected_minor, currency),
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
