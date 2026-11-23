const express = require('express');
const bcrypt = require('bcryptjs');
const crypto = require('crypto');
const { signToken, authenticate } = require('../auth');
const { addDefaultCategories } = require('../db');
const { normalizeCurrency } = require('../finance');
const passwordResetEmail = require('../password-reset-email');
const {
  createPasswordResetToken,
  storePasswordResetToken,
  deletePasswordResetToken,
} = require('../password-reset-token');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const RESET_MESSAGE = 'If an account exists for that email, password reset instructions will be sent.';

module.exports = function authRoutes(db, { emailReset = passwordResetEmail } = {}) {
  const router = express.Router();
  const getUser = db.prepare('SELECT id, name, email, currency, role, created_at FROM users WHERE id = ?');

  router.post('/register', (req, res) => {
    const { name, email, password, currency = 'ZAR' } = req.body || {};
    const currencyCode = normalizeCurrency(currency);
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'A valid email is required' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!currencyCode) return res.status(400).json({ error: 'Choose a supported ISO 4217 currency' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Email is already registered' });
    const id = db.transaction(() => {
      const firstAccount = db.prepare('SELECT COUNT(*) AS count FROM users').get().count === 0;
      const info = db.prepare('INSERT INTO users (name, email, password_hash, currency, role) VALUES (?, ?, ?, ?, ?)')
        .run(String(name).trim(), email.toLowerCase(), bcrypt.hashSync(password, 10), currencyCode, firstAccount ? 'admin' : 'user');
      addDefaultCategories(db, info.lastInsertRowid);
      return info.lastInsertRowid;
    })();
    const user = getUser.get(id);
    res.status(201).json({ token: signToken(user), user });
  });

  router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    const normalizedEmail = String(email || '').trim().toLowerCase();
    const row = db.prepare('SELECT id, password_hash, token_version FROM users WHERE email = ? COLLATE NOCASE').get(normalizedEmail);
    if (!row || !bcrypt.compareSync(password || '', row.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
    const user = getUser.get(row.id);
    res.json({ token: signToken(user, row.token_version), user });
  });

  router.post('/forgot-password', async (req, res) => {
    const email = String(req.body?.email || '').trim().toLowerCase();
    if (!EMAIL_RE.test(email)) return res.status(400).json({ error: 'Enter a valid email address' });
    if (!emailReset.isConfigured()) return res.status(503).json({ error: 'Password reset email is not configured on the server yet' });

    const user = db.prepare('SELECT id, name, email FROM users WHERE email = ? COLLATE NOCASE').get(email);
    if (!user) return res.json({ message: RESET_MESSAGE });

    const coolingDown = db.prepare(`
      SELECT 1 FROM password_reset_tokens
      WHERE user_id = ? AND created_at >= datetime('now', '-60 seconds')
    `).get(user.id);
    if (coolingDown) return res.json({ message: RESET_MESSAGE });

    const reset = createPasswordResetToken();
    storePasswordResetToken(db, user.id, reset);
    try {
      await emailReset.sendPasswordResetEmail({ email: user.email, name: user.name, token: reset.token });
      return res.json({ message: RESET_MESSAGE });
    } catch (error) {
      console.error('Password reset email delivery failed:', error);
      deletePasswordResetToken(db, reset.tokenHash);
      return res.status(503).json({ error: 'Could not send the reset email. Please try again later.' });
    }
  });

  router.post('/reset-password', (req, res) => {
    const { token, new_password: newPassword } = req.body || {};
    if (typeof token !== 'string' || !/^[a-f0-9]{64}$/.test(token)) return res.status(400).json({ error: 'Reset link is invalid or expired' });
    if (typeof newPassword !== 'string' || newPassword.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    const reset = db.prepare('SELECT user_id, expires_at FROM password_reset_tokens WHERE token_hash = ?').get(tokenHash);
    if (!reset || new Date(reset.expires_at) <= new Date()) {
      if (reset) db.prepare('DELETE FROM password_reset_tokens WHERE token_hash = ?').run(tokenHash);
      return res.status(400).json({ error: 'Reset link is invalid or expired' });
    }

    db.transaction(() => {
      db.prepare('UPDATE users SET password_hash = ?, token_version = token_version + 1 WHERE id = ?')
        .run(bcrypt.hashSync(newPassword, 10), reset.user_id);
      db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ?').run(reset.user_id);
    })();
    res.json({ message: 'Password reset successfully. You can now sign in.' });
  });

  router.get('/me', authenticate(db), (req, res) => res.json({ user: req.user }));

  router.put('/me', authenticate(db), (req, res) => {
    const { name, currency, current_password, new_password } = req.body || {};
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const nextName = name !== undefined ? String(name).trim() : row.name;
    const nextCurrency = normalizeCurrency(currency !== undefined ? currency : row.currency);
    if (!nextName) return res.status(400).json({ error: 'Name is required' });
    if (!nextCurrency) return res.status(400).json({ error: 'Choose a supported ISO 4217 currency' });
    let hash = row.password_hash;
    if (new_password) {
      if (!bcrypt.compareSync(current_password || '', row.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });
      if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
      hash = bcrypt.hashSync(new_password, 10);
    }
    db.prepare('UPDATE users SET name = ?, currency = ?, password_hash = ?, token_version = token_version + ? WHERE id = ?')
      .run(nextName, nextCurrency, hash, new_password ? 1 : 0, req.user.id);
    res.json({ user: getUser.get(req.user.id) });
  });

  /** Permanently deletes the account and all its data. */
  router.delete('/me', authenticate(db), (req, res) => {
    const { password } = req.body || {};
    const row = db.prepare('SELECT password_hash FROM users WHERE id = ?').get(req.user.id);
    if (!bcrypt.compareSync(password || '', row.password_hash)) return res.status(400).json({ error: 'Password is incorrect' });
    db.transaction(() => {
      db.prepare('DELETE FROM transactions WHERE user_id = ?').run(req.user.id);
      db.prepare('DELETE FROM users WHERE id = ?').run(req.user.id);
    })();
    res.status(204).end();
  });

  return router;
};
