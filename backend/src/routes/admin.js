const express = require('express');
const passwordResetEmail = require('../password-reset-email');
const { createPasswordResetToken, storePasswordResetToken } = require('../password-reset-token');

module.exports = function adminRoutes(db) {
  const router = express.Router();

  function requireAdmin(req, res, next) {
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
    next();
  }

  router.use(requireAdmin);

  router.get('/users', (req, res) => {
    const users = db.prepare(`
      SELECT id, name, email, currency, role, created_at,
        (SELECT COUNT(*) FROM transactions WHERE transactions.user_id = users.id) AS transaction_count,
        (SELECT COUNT(*) FROM budgets WHERE budgets.user_id = users.id) AS budget_count,
        (SELECT COUNT(*) FROM goals WHERE goals.user_id = users.id) AS goal_count
      FROM users ORDER BY created_at DESC, id DESC
    `).all();
    res.json({ users });
  });

  router.put('/users/:id/role', (req, res) => {
    const id = Number(req.params.id);
    const role = req.body?.role;
    if (!['user', 'admin'].includes(role)) return res.status(400).json({ error: 'Role must be user or admin' });
    if (id === req.user.id && role !== 'admin') return res.status(400).json({ error: 'You cannot remove your own admin role' });
    const user = db.prepare('SELECT id, name, email, currency, role, created_at FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    db.prepare('UPDATE users SET role = ? WHERE id = ?').run(role, id);
    res.json({ user: db.prepare('SELECT id, name, email, currency, role, created_at FROM users WHERE id = ?').get(id) });
  });

  router.post('/users/:id/password-reset', (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isSafeInteger(id) || id < 1) return res.status(400).json({ error: 'User ID is invalid' });
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const reset = createPasswordResetToken();
    let resetUrl;
    try {
      resetUrl = passwordResetEmail.createPasswordResetUrl(reset.token);
    } catch (error) {
      return res.status(503).json({ error: error.message });
    }
    storePasswordResetToken(db, user.id, reset);
    res.json({ resetUrl, expiresAt: reset.expiresAt });
  });

  router.delete('/users/:id', (req, res) => {
    const id = Number(req.params.id);
    if (id === req.user.id) return res.status(400).json({ error: 'Use account settings to delete your own account' });
    const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    db.transaction(() => {
      db.prepare('DELETE FROM transactions WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM budgets WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM goals WHERE user_id = ?').run(id);
      db.prepare('DELETE FROM users WHERE id = ?').run(id);
    })();
    res.status(204).end();
  });

  return router;
};
