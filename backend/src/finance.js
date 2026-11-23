/**
 * Pure financial calculation helpers (no database access) so they are easy to unit-test.
 * Money is stored in each currency's smallest unit.
 */

const MONTH_RE = /^\d{4}-(0[1-9]|1[0-2])$/;
const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const CURRENCY_CODES = new Set(Intl.supportedValuesOf('currency'));
const CURRENCY_NAMES = new Intl.DisplayNames(['en'], { type: 'currency' });

function normalizeCurrency(value) {
  if (typeof value !== 'string') return null;
  const code = value.trim().toUpperCase();
  return CURRENCY_CODES.has(code) ? code : null;
}

function currencyFractionDigits(currency) {
  const code = normalizeCurrency(currency);
  if (!code) throw new RangeError(`Unsupported currency: ${currency}`);
  return new Intl.NumberFormat('en', { style: 'currency', currency: code }).resolvedOptions().maximumFractionDigits;
}

function listCurrencies() {
  return [...CURRENCY_CODES].sort().map((code) => ({
    code,
    name: code === 'ZWG' ? 'ZiG (Zimbabwe Gold)' : CURRENCY_NAMES.of(code) || code,
    fraction_digits: currencyFractionDigits(code),
  }));
}

/** Converts a user-entered amount into the currency's smallest unit, or null if invalid. */
function toMinorUnits(value, currency) {
  const n = typeof value === 'string' ? Number(value.replace(/[,\s]/g, '')) : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.round(n * (10 ** currencyFractionDigits(currency)));
}
const fromMinorUnits = (amount, currency) => amount / (10 ** currencyFractionDigits(currency));

function isValidDate(s) {
  if (!DATE_RE.test(s || '')) return false;
  const d = new Date(`${s}T00:00:00Z`);
  return d.toISOString().slice(0, 10) === s;
}

const currentMonth = (now = new Date()) => now.toISOString().slice(0, 7);
const daysInMonth = (month) => {
  const [y, m] = month.split('-').map(Number);
  return new Date(Date.UTC(y, m, 0)).getUTCDate();
};
/** Returns [firstDay, lastDay] (inclusive) of a YYYY-MM month. */
const monthRange = (month) => [`${month}-01`, `${month}-${String(daysInMonth(month)).padStart(2, '0')}`];

/** Returns the n months ending with `month`, oldest first. */
function previousMonths(month, n) {
  const [y, m] = month.split('-').map(Number);
  const out = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(y, m - 1 - i, 1));
    out.push(d.toISOString().slice(0, 7));
  }
  return out;
}

/** Share of income kept, as a whole percentage (can be negative). Null when there is no income. */
function savingsRate(incomeMinor, expenseMinor) {
  if (incomeMinor <= 0) return null;
  return Math.round(((incomeMinor - expenseMinor) / incomeMinor) * 100);
}

/** Budget usage and status. Warning at 80% or more, over when spending exceeds the limit. */
function budgetStatus(spentMinor, limitMinor) {
  const percent = limitMinor > 0 ? Math.round((spentMinor / limitMinor) * 100) : 0;
  return {
    spent_minor: spentMinor,
    remaining_minor: limitMinor - spentMinor,
    percent,
    status: spentMinor > limitMinor ? 'over' : percent >= 80 ? 'warning' : 'ok',
  };
}

/**
 * Spending pace for a month: average per elapsed day and projected month-end total.
 * For past months the projection equals actual spending.
 */
function spendingProjection(expenseMinor, month, today = new Date()) {
  const total = daysInMonth(month);
  const nowMonth = currentMonth(today);
  let elapsed;
  if (month < nowMonth) elapsed = total;
  else if (month > nowMonth) elapsed = 0;
  else elapsed = today.getUTCDate();
  const dailyAverage = elapsed ? Math.round(expenseMinor / elapsed) : 0;
  return {
    days_elapsed: elapsed,
    days_in_month: total,
    daily_average_minor: dailyAverage,
    projected_minor: elapsed ? Math.round(dailyAverage * total) : 0,
  };
}

/**
 * Whole calendar months from `from` until `deadline` (e.g. 23 Nov → 28 Mar = 4).
 * Returns 0 if the deadline has passed, and at least 1 if it is still in the future.
 */
function monthsUntil(deadline, from = new Date()) {
  const [y, m, d] = deadline.split('-').map(Number);
  const fy = from.getUTCFullYear(), fm = from.getUTCMonth() + 1, fd = from.getUTCDate();
  const deadlineKey = y * 10000 + m * 100 + d;
  const todayKey = fy * 10000 + fm * 100 + fd;
  if (deadlineKey <= todayKey) return 0;
  let months = (y - fy) * 12 + (m - fm);
  if (d < fd) months -= 1;
  return Math.max(1, months);
}

/** Progress and required monthly contribution for a savings goal. */
function goalPlan(goal, today = new Date()) {
  const remaining = Math.max(0, goal.target_minor - goal.saved_minor);
  const percent = Math.min(100, Math.round((goal.saved_minor / goal.target_minor) * 100));
  const plan = { remaining_minor: remaining, percent, achieved: remaining === 0, months_left: null, monthly_needed_minor: null, overdue: false };
  if (goal.deadline && remaining > 0) {
    const months = monthsUntil(goal.deadline, today);
    plan.months_left = months;
    if (months === 0) plan.overdue = true;
    else plan.monthly_needed_minor = Math.ceil(remaining / months);
  }
  return plan;
}

module.exports = {
  MONTH_RE, normalizeCurrency, currencyFractionDigits, listCurrencies, toMinorUnits, fromMinorUnits,
  isValidDate, currentMonth, daysInMonth, monthRange, previousMonths,
  savingsRate, budgetStatus, spendingProjection, monthsUntil, goalPlan,
};
