const { test } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const backendDir = path.join(__dirname, '..');
const appScript = "const { createApp } = require('./src/app'); const { createDb } = require('./src/db'); createApp({ db: createDb(':memory:') });";
const corsScript = `
const request = require('supertest');
const { createApp } = require('./src/app');
const { createDb } = require('./src/db');
(async () => {
  const app = createApp({ db: createDb(':memory:') });
  const allowed = await request(app).get('/api/health').set('Origin', 'https://app.example.com');
  if (allowed.headers['access-control-allow-origin'] !== 'https://app.example.com') throw new Error('Configured origin was not allowed');
  const denied = await request(app).get('/api/health').set('Origin', 'https://other.example.com');
  if (denied.headers['access-control-allow-origin']) throw new Error('Unconfigured origin was allowed');
})().catch((error) => { console.error(error); process.exitCode = 1; });
`;

function runNode(script, env) {
  return spawnSync(process.execPath, ['-e', script], {
    cwd: backendDir,
    env: { ...process.env, ...env },
    encoding: 'utf8',
  });
}

test('production refuses to start without a strong JWT secret', () => {
  const env = { NODE_ENV: 'production', JWT_SECRET: '' };
  const result = runNode("require('./src/auth')", env);
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /JWT_SECRET must be set/);
});

test('production refuses to start without an allowed web origin', () => {
  const result = runNode(appScript, {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(64),
    CORS_ORIGINS: '',
  });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /CORS_ORIGINS must contain/);
});

test('production starts with a strong secret and configured web origin', () => {
  const result = runNode(appScript, {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(64),
    CORS_ORIGINS: 'https://app.example.com',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('production CORS allows only configured web origins', () => {
  const result = runNode(corsScript, {
    NODE_ENV: 'production',
    JWT_SECRET: 'a'.repeat(64),
    CORS_ORIGINS: 'https://app.example.com',
  });
  assert.equal(result.status, 0, result.stderr);
});

test('demo seed refuses to run in production', () => {
  const result = runNode("require('./src/seed')", { NODE_ENV: 'production' });
  assert.notEqual(result.status, 0);
  assert.match(result.stderr, /Demo seeding is disabled in production/);
});
