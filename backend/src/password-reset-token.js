const crypto = require('crypto');

function createPasswordResetToken() {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return { token, tokenHash, expiresAt };
}

function storePasswordResetToken(db, userId, { tokenHash, expiresAt }) {
  db.prepare('DELETE FROM password_reset_tokens WHERE user_id = ? OR expires_at <= ?')
    .run(userId, new Date().toISOString());
  db.prepare('INSERT INTO password_reset_tokens (token_hash, user_id, expires_at) VALUES (?, ?, ?)')
    .run(tokenHash, userId, expiresAt);
}

function deletePasswordResetToken(db, tokenHash) {
  db.prepare('DELETE FROM password_reset_tokens WHERE token_hash = ?').run(tokenHash);
}

module.exports = { createPasswordResetToken, storePasswordResetToken, deletePasswordResetToken };
