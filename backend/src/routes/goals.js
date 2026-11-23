const express = require('express');
const { toCents, fromCents, isValidDate, goalPlan } = require('../finance');

module.exports = function goalRoutes(db) {
  const router = express.Router();
  const getGoal = (id, userId) => db.prepare('SELECT * FROM goals WHERE id = ? AND user_id = ?').get(id, userId);

  function serialize(g) {
    const plan = goalPlan(g);
    return {
      id: g.id, name: g.name, icon: g.icon, deadline: g.deadline, created_at: g.created_at,
      target: fromCents(g.target_cents), saved: fromCents(g.saved_cents), remaining: fromCents(plan.remaining_cents),
      percent: plan.percent, achieved: plan.achieved, overdue: plan.overdue, months_left: plan.months_left,
      monthly_needed: plan.monthly_needed_cents === null ? null : fromCents(plan.monthly_needed_cents),
    };
  }

  function validate(body, existing = {}) {
    const merged = { ...existing, ...body };
    if (!merged.name || !String(merged.name).trim()) return { error: 'Goal name is required' };
    const target = toCents(merged.target);
    if (target === null || target <= 0) return { error: 'Target must be greater than 0' };
    if (merged.deadline && !isValidDate(merged.deadline)) return { error: 'Deadline must be a valid YYYY-MM-DD date' };
    return { fields: { name: String(merged.name).trim(), target_cents: target, deadline: merged.deadline || null, icon: String(merged.icon || 'flag') } };
  }

  router.get('/', (req, res) => {
    const goals = db.prepare('SELECT * FROM goals WHERE user_id = ? ORDER BY (saved_cents >= target_cents), deadline IS NULL, deadline, id').all(req.user.id).map(serialize);
    const target = goals.reduce((a, g) => a + g.target, 0);
    const saved = goals.reduce((a, g) => a + g.saved, 0);
    const r2 = (n) => Math.round(n * 100) / 100;
    res.json({ goals, totals: { target: r2(target), saved: r2(saved), percent: target ? Math.round((saved / target) * 100) : 0 } });
  });

  router.post('/', (req, res) => {
    const { error, fields } = validate(req.body || {});
    if (error) return res.status(400).json({ error });
    const initial = req.body.saved !== undefined ? toCents(req.body.saved) : 0;
    if (initial === null || initial < 0) return res.status(400).json({ error: 'Starting amount cannot be negative' });
    const info = db.prepare('INSERT INTO goals (user_id, name, target_cents, saved_cents, deadline, icon) VALUES (?, ?, ?, ?, ?, ?)')
      .run(req.user.id, fields.name, fields.target_cents, initial, fields.deadline, fields.icon);
    if (initial > 0) db.prepare('INSERT INTO goal_contributions (goal_id, amount_cents) VALUES (?, ?)').run(info.lastInsertRowid, initial);
    res.status(201).json({ goal: serialize(getGoal(info.lastInsertRowid, req.user.id)) });
  });

  router.get('/:id', (req, res) => {
    const g = getGoal(Number(req.params.id), req.user.id);
    if (!g) return res.status(404).json({ error: 'Goal not found' });
    const contributions = db.prepare('SELECT id, amount_cents, created_at FROM goal_contributions WHERE goal_id = ? ORDER BY id DESC').all(g.id)
      .map((c) => ({ id: c.id, amount: fromCents(c.amount_cents), created_at: c.created_at }));
    res.json({ goal: serialize(g), contributions });
  });

  router.put('/:id', (req, res) => {
    const g = getGoal(Number(req.params.id), req.user.id);
    if (!g) return res.status(404).json({ error: 'Goal not found' });
    const { error, fields } = validate(req.body || {}, { name: g.name, target: fromCents(g.target_cents), deadline: g.deadline, icon: g.icon });
    if (error) return res.status(400).json({ error });
    db.prepare('UPDATE goals SET name = ?, target_cents = ?, deadline = ?, icon = ? WHERE id = ?').run(fields.name, fields.target_cents, fields.deadline, fields.icon, g.id);
    res.json({ goal: serialize(getGoal(g.id, req.user.id)) });
  });

  /** Add money to (positive) or withdraw from (negative) a goal. */
  router.post('/:id/contribute', (req, res) => {
    const g = getGoal(Number(req.params.id), req.user.id);
    if (!g) return res.status(404).json({ error: 'Goal not found' });
    const cents = toCents(req.body?.amount);
    if (cents === null || cents === 0) return res.status(400).json({ error: 'Amount must be a non-zero number' });
    if (g.saved_cents + cents < 0) return res.status(400).json({ error: 'You cannot withdraw more than has been saved' });
    db.transaction(() => {
      db.prepare('UPDATE goals SET saved_cents = saved_cents + ? WHERE id = ?').run(cents, g.id);
      db.prepare('INSERT INTO goal_contributions (goal_id, amount_cents) VALUES (?, ?)').run(g.id, cents);
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
