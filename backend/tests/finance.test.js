const { test } = require('node:test');
const assert = require('node:assert/strict');
const F = require('../src/finance');

test('minor units use each currency’s standard precision', () => {
  assert.equal(F.toMinorUnits('149.99', 'USD'), 14999);
  assert.equal(F.toMinorUnits(0.1 + 0.2, 'USD'), 30);
  assert.equal(F.toMinorUnits('1,250.50', 'USD'), 125050);
  assert.equal(F.toMinorUnits('1.234', 'KWD'), 1234);
  assert.equal(F.toMinorUnits('1250', 'JPY'), 1250);
  assert.equal(F.toMinorUnits('abc', 'USD'), null);
  assert.equal(F.fromMinorUnits(1234, 'KWD'), 1.234);
  assert.equal(F.currencyFractionDigits('JPY'), 0);
  assert.equal(F.currencyFractionDigits('BHD'), 3);
  assert.ok(F.listCurrencies().some((currency) => currency.code === 'ZWG' && currency.name.startsWith('ZiG')));
  assert.ok(F.listCurrencies().some((currency) => currency.code === 'BWP'));
  assert.throws(() => F.toMinorUnits(1, 'ZZZ'), /Unsupported currency/);
});

test('date and month helpers', () => {
  assert.equal(F.isValidDate('2026-02-29'), false);
  assert.equal(F.isValidDate('2028-02-29'), true);
  assert.equal(F.daysInMonth('2026-02'), 28);
  assert.deepEqual(F.monthRange('2026-04'), ['2026-04-01', '2026-04-30']);
  assert.deepEqual(F.previousMonths('2026-02', 3), ['2025-12', '2026-01', '2026-02']);
});

test('savings rate', () => {
  assert.equal(F.savingsRate(1000_00, 750_00), 25);
  assert.equal(F.savingsRate(1000_00, 1200_00), -20);
  assert.equal(F.savingsRate(0, 500), null);
});

test('budget status thresholds', () => {
  assert.equal(F.budgetStatus(500, 1000).status, 'ok');
  assert.equal(F.budgetStatus(800, 1000).status, 'warning');
  assert.equal(F.budgetStatus(1001, 1000).status, 'over');
  assert.equal(F.budgetStatus(1200, 1000).remaining_minor, -200);
});

test('spending projection for current, past and future months', () => {
  const today = new Date(Date.UTC(2026, 3, 10)); // 10 April 2026
  const p = F.spendingProjection(3000_00, '2026-04', today);
  assert.equal(p.daily_average_minor, 300_00);
  assert.equal(p.projected_minor, 9000_00);
  assert.equal(F.spendingProjection(3100_00, '2026-03', today).projected_minor, 3100_00);
  assert.equal(F.spendingProjection(0, '2026-05', today).projected_minor, 0);
});

test('goal plan: monthly contribution needed', () => {
  const today = new Date(Date.UTC(2026, 0, 1));
  const plan = F.goalPlan({ target_minor: 12000_00, saved_minor: 6000_00, deadline: '2026-07-01' }, today);
  assert.equal(plan.percent, 50);
  assert.equal(plan.months_left, 6);
  assert.equal(plan.monthly_needed_minor, 1000_00);
  assert.equal(F.monthsUntil('2027-03-28', new Date(Date.UTC(2026, 10, 23))), 4);
  assert.equal(F.monthsUntil('2027-03-20', new Date(Date.UTC(2026, 10, 23))), 3);
  assert.equal(F.monthsUntil('2026-11-30', new Date(Date.UTC(2026, 10, 23))), 1);
  assert.equal(F.goalPlan({ target_minor: 100, saved_minor: 150, deadline: null }).achieved, true);
  assert.equal(F.goalPlan({ target_minor: 100, saved_minor: 10, deadline: '2025-01-01' }, today).overdue, true);
});
