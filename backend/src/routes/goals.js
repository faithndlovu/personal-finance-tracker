const express = require('express');
const { normalizeCurrency, toMinorUnits, fromMinorUnits, isValidDate, goalPlan } = require('../finance');

module.exports = function goalRoutes(db) {
  const router = express.Router();
  const getGoal = (id, userId) => db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(id, userId);

  function serialize(g) {
    const plan = goalPlan(g);
    return {
      id: g.id, name: g.name, icon: g.icon, deadline: g.deadline, created_at: g.created_at, currency: g.currency,
      target: fromMinorUnits(g.target_minor, g.currency), saved: fromMinorUnits(g.saved_minor, g.currency),
      remaining: fromMinorUnits(plan.remaining_minor, g.currency), percent: plan.percent, achieved: plan.achieved,
      overdue: plan.overdue, months_left: plan.months_left,
      monthly_needed: plan.monthly_needed_minor === null ? null : fromMinorUnits(plan.monthly_needed_minor, g.currency),
    };
  }

  function validate(body, defaultCurrency, existing = {}) {
    const merged = { ...existing, ...body };
    if (!merged.name || !String(merged.name).trim()) return { error: 'Goal name is required' };
    const currency = normalizeCurrency(merged.currency || defaultCurrency);
    if (!currency) return { error: 'Choose a supported ISO 4217 currency' };
    const target = toMinorUnits(merged.target, currency);
    if (target === null || target <= 0) return { error: 'Target must be greater than 0' };
    if (merged.deadline && !isValidDate(merged.deadline)) return { error: 'Deadline must be a valid YYYY-MM-DD date' };
    return { fields: { name: String(merged.name).trim(), target_minor: target, currency, deadline: merged.deadline || null, icon: String(merged.icon || 'flag') } };
  }

  router.get('/', (req, res) => {
    const currency = normalizeCurrency(req.query.currency || req.user.currency);
    if (!currency) return res.status(400).json({ error: 'Choose a supported ISO 4217 currency' });
    const rows = db.prepare(`SELECT * FROM goals WHERE user_id = ? AND currency = ?
      ORDER BY (saved_minor >= target_minor), deadline IS NULL, deadline, id`).all(req.user.id, currency);
    const goals = rows.map(serialize);
    const target = rows.reduce((a, g) => a + g.target_minor, 0);
    const saved = rows.reduce((a, g) => a + g.saved_minor, 0);
    res.json({
      currency,
      goals,
      totals: {
        target: fromMinorUnits(target, currency),
        saved: fromMinorUnits(saved, currency),
        percent: target ? Math.round((saved / target) * 100) : 0,
      },
    });
  });

  router.post('/', (req, res) => {
    const { error, fields } = validate(req.body || {}, req.user.currency);
    if (error) return res.status(400).json({ error });
    const initial = req.body.saved !== undefined ? toMinorUnits(req.body.saved, fields.currency) : 0;
    if (initial === null || initial < 0) return res.status(400).json({ error: 'Starting amount cannot be negative' });
    const info = db.prepare('INSERT INTO goals (user_id, name, target_minor, saved_minor, currency, deadline, icon) VALUES (?, ?, ?, ?, ?, ?, ?)')
      .run(req.user.id, fields.name, fields.target_minor, initial, fields.currency, fields.deadline, fields.icon);
    if (initial > 0) db.prepare('INSERT INTO goal_contributions (goal_id, amount_minor) VALUES (?, ?)').run(info.lastInsertRowid, initial);
    res.status(201).json({ goal: serialize(getGoal(info.lastInsertRowid, req.user.id)) });
  });

  router.get('/:id', (req, res) => {
    const g = getGoal(Number(req.params.id), req.user.id);
    if (!g) return res.status(404).json({ error: 'Goal not found' });
    const contributions = db.prepare('SELECT id, amount_minor, created_at FROM goal_contributions WHERE goal_id = ? ORDER BY id DESC').all(g.id)
      .map((c) => ({ id: c.id, amount: fromMinorUnits(c.amount_minor, g.currency), created_at: c.created_at }));
    res.json({ goal: serialize(g), contributions });
  });

  router.put('/:id', (req, res) => {
    const g = getGoal(Number(req.params.id), req.user.id);
    if (!g) return res.status(404).json({ error: 'Goal not found' });
    if (req.body?.currency && normalizeCurrency(req.body.currency) !== g.currency) {
      return res.status(400).json({ error: 'A goal currency cannot be changed after it is created' });
    }
    const { error, fields } = validate(req.body || {}, g.currency, {
      name: g.name, target: fromMinorUnits(g.target_minor, g.currency), currency: g.currency, deadline: g.deadline, icon: g.icon,
    });
    if (error) return res.status(400).json({ error });
    db.prepare('UPDATE goals SET name = ?, target_minor = ?, deadline = ?, icon = ? WHERE id = ?')
      .run(fields.name, fields.target_minor, fields.deadline, fields.icon, g.id);
    res.json({ goal: serialize(getGoal(g.id, req.user.id)) });
  });

  /** Add money to (positive) or withdraw from (negative) a goal. */
  router.post('/:id/contribute', (req, res) => {
    const g = getGoal(Number(req.params.id), req.user.id);
    if (!g) return res.status(404).json({ error: 'Goal not found' });
    const minor = toMinorUnits(req.body?.amount, g.currency);
    if (minor === null || minor === 0) return res.status(400).json({ error: 'Amount must be a non-zero number' });
    if (g.saved_minor + minor < 0) return res.status(400).json({ error: 'You cannot withdraw more than has been saved' });
    db.transaction(() => {
      db.prepare('UPDATE goals SET saved_minor = saved_minor + ? WHERE id = ?').run(minor, g.id);
      db.prepare('INSERT INTO goal_contributions (goal_id, amount_minor) VALUES (?, ?)').run(g.id, minor);
    })();
    res.json({ goal: serialize(getGoal(g.id, req.user.id)) });
  });

  router.delete('/:id', (req, res) => {
    const info = db.prepare('DELETE FROM goals WHERE id = ? AND user_id = ?').run(Number(req.params.id), req.user.id);
    if (!info.changes) return res.status(404).json({ error: 'Goal not found' });
    res.status(204).end();
  });

  return router;
};
