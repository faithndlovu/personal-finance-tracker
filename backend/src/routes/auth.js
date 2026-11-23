const express = require('express');
const bcrypt = require('bcryptjs');
const { signToken, authenticate } = require('../auth');
const { addDefaultCategories } = require('../db');

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const CURRENCY_RE = /^[A-Z]{3}$/;

module.exports = function authRoutes(db) {
  const router = express.Router();
  const getUser = db.prepare('SELECT id, name, email, currency, created_at FROM users WHERE id = ?');

  router.post('/register', (req, res) => {
    const { name, email, password, currency = 'ZAR' } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Name is required' });
    if (!EMAIL_RE.test(email || '')) return res.status(400).json({ error: 'A valid email is required' });
    if (!password || password.length < 8) return res.status(400).json({ error: 'Password must be at least 8 characters' });
    if (!CURRENCY_RE.test(currency)) return res.status(400).json({ error: 'Currency must be a 3-letter code, e.g. ZAR' });
    if (db.prepare('SELECT 1 FROM users WHERE email = ?').get(email)) return res.status(409).json({ error: 'Email is already registered' });
    const id = db.transaction(() => {
      const info = db.prepare('INSERT INTO users (name, email, password_hash, currency) VALUES (?, ?, ?, ?)')
        .run(String(name).trim(), email.toLowerCase(), bcrypt.hashSync(password, 10), currency);
      addDefaultCategories(db, info.lastInsertRowid);
      return info.lastInsertRowid;
    })();
    const user = getUser.get(id);
    res.status(201).json({ token: signToken(user), user });
  });

  router.post('/login', (req, res) => {
    const { email, password } = req.body || {};
    const row = db.prepare('SELECT id, password_hash FROM users WHERE email = ?').get(email || '');
    if (!row || !bcrypt.compareSync(password || '', row.password_hash)) return res.status(401).json({ error: 'Invalid email or password' });
    const user = getUser.get(row.id);
    res.json({ token: signToken(user), user });
  });

  router.get('/me', authenticate(db), (req, res) => res.json({ user: req.user }));

  router.put('/me', authenticate(db), (req, res) => {
    const { name, currency, current_password, new_password } = req.body || {};
    const row = db.prepare('SELECT * FROM users WHERE id = ?').get(req.user.id);
    const nextName = name !== undefined ? String(name).trim() : row.name;
    const nextCurrency = currency !== undefined ? String(currency).toUpperCase() : row.currency;
    if (!nextName) return res.status(400).json({ error: 'Name is required' });
    if (!CURRENCY_RE.test(nextCurrency)) return res.status(400).json({ error: 'Currency must be a 3-letter code, e.g. ZAR' });
    let hash = row.password_hash;
    if (new_password) {
      if (!bcrypt.compareSync(current_password || '', row.password_hash)) return res.status(400).json({ error: 'Current password is incorrect' });
      if (new_password.length < 8) return res.status(400).json({ error: 'New password must be at least 8 characters' });
      hash = bcrypt.hashSync(new_password, 10);
    }
    db.prepare('UPDATE users SET name = ?, currency = ?, password_hash = ? WHERE id = ?').run(nextName, nextCurrency, hash, req.user.id);
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
