const formatters = new Map<string, Intl.NumberFormat>();

/** Formats an amount in the user's currency, e.g. R 1 250,00 or $1,250.00. */
export function money(amount: number, currency = 'ZAR', opts: { compact?: boolean; sign?: boolean } = {}) {
  const key = `${currency}-${opts.compact}`;
  let f = formatters.get(key);
  if (!f) {
    try {
      f = new Intl.NumberFormat(currency === 'ZAR' ? 'en-ZA' : 'en-US', {
        style: 'currency', currency, maximumFractionDigits: opts.compact ? 0 : 2, minimumFractionDigits: opts.compact ? 0 : 2,
      });
    } catch {
      f = new Intl.NumberFormat('en-US', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
    }
    formatters.set(key, f);
  }
  const text = f.format(Math.abs(amount));
  if (opts.sign) return `${amount < 0 ? '−' : '+'}${text}`;
  return amount < 0 ? `−${text}` : text;
}

export const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
export const currentMonth = () => todayISO().slice(0, 7);

export function shiftMonth(month: string, delta: number) {
  const [y, m] = month.split('-').map(Number);
  const d = new Date(y, m - 1 + delta, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
export const monthLabel = (month: string, long = true) => {
  const [y, m] = month.split('-').map(Number);
  return long ? `${MONTHS[m - 1]} ${y}` : MONTHS[m - 1];
};
export const dateLabel = (iso: string) => {
  const [y, m, d] = iso.split('-').map(Number);
  const t = todayISO();
  if (iso === t) return 'Today';
  const yest = new Date(); yest.setDate(yest.getDate() - 1);
  if (iso === `${yest.getFullYear()}-${String(yest.getMonth() + 1).padStart(2, '0')}-${String(yest.getDate()).padStart(2, '0')}`) return 'Yesterday';
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

/** Accepts "1 250,50", "1,250.50" or "1250.5" and returns a number, or NaN. */
export function parseAmount(text: string): number {
  let t = text.trim().replace(/\s/g, '');
  if (/,\d{1,2}$/.test(t) && !t.includes('.')) t = t.replace(',', '.');
  return Number(t.replace(/,/g, ''));
}
