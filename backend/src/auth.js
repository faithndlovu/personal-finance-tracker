const jwt = require('jsonwebtoken');

const configuredSecret = process.env.JWT_SECRET;
if (process.env.NODE_ENV === 'production' && (!configuredSecret || configuredSecret.length < 32)) {
  throw new Error('JWT_SECRET must be set to at least 32 characters in production');
}
const JWT_SECRET = configuredSecret || 'dev-only-secret-change-me';
const TOKEN_TTL = process.env.TOKEN_TTL || '30d';

const signToken = (user, tokenVersion = 0) => jwt.sign({ sub: user.id, ver: tokenVersion }, JWT_SECRET, { expiresIn: TOKEN_TTL });

/** Verifies the Bearer token and attaches the user to req.user. */
function authenticate(db) {
  const findUser = db.prepare('SELECT id, name, email, currency, role, token_version, created_at FROM users WHERE id = ?');
  return (req, res, next) => {
    const [scheme, token] = (req.headers.authorization || '').split(' ');
    if (scheme !== 'Bearer' || !token) return res.status(401).json({ error: 'Authentication required' });
    try {
      const payload = jwt.verify(token, JWT_SECRET);
      const row = findUser.get(payload.sub);
      const user = row && row.token_version === (payload.ver || 0)
        ? (({ token_version, ...publicUser }) => publicUser)(row)
        : null;
      if (!user) return res.status(401).json({ error: 'User no longer exists' });
      req.user = user;
      next();
    } catch {
      res.status(401).json({ error: 'Invalid or expired token' });
    }
  };
}

module.exports = { signToken, authenticate };
