const nodemailer = require('nodemailer');

function isConfigured() {
  return Boolean(
    process.env.SMTP_HOST
    && process.env.SMTP_USER
    && process.env.SMTP_PASSWORD
    && process.env.PASSWORD_RESET_URL,
  );
}

function createPasswordResetUrl(token) {
  if (!process.env.PASSWORD_RESET_URL) throw new Error('PASSWORD_RESET_URL must be configured');
  let resetUrl;
  try {
    resetUrl = new URL(process.env.PASSWORD_RESET_URL);
  } catch {
    throw new Error('PASSWORD_RESET_URL must be a valid URL');
  }
  if (process.env.NODE_ENV === 'production' && resetUrl.protocol !== 'https:') {
    throw new Error('PASSWORD_RESET_URL must use HTTPS in production');
  }
  resetUrl.searchParams.set('token', token);
  return resetUrl.toString();
}

async function sendPasswordResetEmail({ email, name, token }) {
  if (!isConfigured()) throw new Error('SMTP_HOST, SMTP_USER, SMTP_PASSWORD and PASSWORD_RESET_URL must be configured');
  const port = Number(process.env.SMTP_PORT || 587);
  const link = createPasswordResetUrl(token);

  const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
  });
  const safeName = String(name).replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  })[char]);
  await transporter.sendMail({
    from: process.env.SMTP_FROM || process.env.SMTP_USER,
    to: email,
    subject: 'Reset your FAYORA password',
    text: `Hello ${name},\n\nUse this link within one hour to reset your FAYORA Finance Tracker password:\n${link}\n\nIf you did not request this, you can ignore this email.`,
    html: `<p>Hello ${safeName},</p><p>Use this link within one hour to reset your FAYORA Finance Tracker password:</p><p><a href="${link.replace(/&/g, '&amp;')}">Reset password</a></p><p>If you did not request this, you can ignore this email.</p>`,
  });
}

module.exports = { isConfigured, createPasswordResetUrl, sendPasswordResetEmail };
