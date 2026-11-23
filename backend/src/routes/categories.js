const express = require('express');

module.exports = function categoryRoutes(db) {
  const router = express.Router();

  router.get('/', (req, res) => {
    const categories = db.prepare(`SELECT c.*, (SELECT COUNT(*) FROM transactions t WHERE t.category_id = c.id) AS usage
      FROM categories c WHERE c.user_id = ? ORDER BY c.type DESC, c.name`).all(req.user.id);
    res.json({ categories });
  });

  router.post('/', (req, res) => {
    const { name, type, icon = 'pricetag', color = '#64748b' } = req.body || {};
    if (!name || !String(name).trim()) return res.status(400).json({ error: 'Category name is required' });
    if (!['income', 'expense'].includes(type)) return res.status(400).json({ error: 'Type must be income or expense' });
    if (!/^#[0-9a-fA-F]{6}$/.test(color)) return res.status(400).json({ error: 'Color must be a hex value like #22c55e' });
    if (db.prepare('SELECT 1 FROM categories WHERE user_id = ? AND name = ? AND type = ?').get(req.user.id, String(name).trim(), type)) {
      return res.status(409).json({ error: 'A category with this name already exists' });
    }
    const info = db.prepare('INSERT INTO categories (user_id, name, type, icon, color) VALUES (?, ?, ?, ?, ?)')
      .run(req.user.id, String(name).trim(), type, String(icon), color);
    res.status(201).json({ category: db.prepare('SELECT * FROM categories WHERE id = ?').get(info.lastInsertRowid) });
  });

  router.delete('/:id', (req, res) => {
    const cat = db.prepare('SELECT * FROM categories WHERE id = ? AND user_id = ?').get(Number(req.params.id), req.user.id);
    if (!cat) return res.status(404).json({ error: 'Category not found' });
    if (db.prepare('SELECT 1 FROM transactions WHERE category_id = ?').get(cat.id)) {
      return res.status(409).json({ error: 'This category has transactions. Move or delete them first.' });
    }
    db.prepare('DELETE FROM categories WHERE id = ?').run(cat.id);
    res.status(204).end();
  });

  return router;
};
