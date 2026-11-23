export type User = { id: number; name: string; email: string; currency: string; created_at: string };

export type Category = {
  id: number; name: string; type: 'income' | 'expense'; icon: string; color: string; usage?: number;
};

export type Transaction = {
  id: number; type: 'income' | 'expense'; amount: number; description: string; date: string;
  category_id: number; category_name: string; category_icon: string; category_color: string;
};
export type TransactionsResponse = { transactions: Transaction[]; totals: { income: number; expense: number; net: number } };

export type Budget = {
  id: number; category_id: number; category_name: string; category_icon: string; category_color: string;
  limit: number; spent: number; remaining: number; percent: number; status: 'ok' | 'warning' | 'over';
};
export type BudgetsResponse = { month: string; budgets: Budget[]; totals: { limit: number; spent: number; remaining: number; percent: number } };

export type Goal = {
  id: number; name: string; icon: string; deadline: string | null; target: number; saved: number; remaining: number;
  percent: number; achieved: boolean; overdue: boolean; months_left: number | null; monthly_needed: number | null;
};
export type GoalsResponse = { goals: Goal[]; totals: { target: number; saved: number; percent: number } };

export type Summary = {
  month: string; currency: string; income: number; expense: number; net: number; savings_rate: number | null; balance: number;
  by_category: { id: number; name: string; icon: string; color: string; total: number; count: number; percent: number }[];
  trend: { month: string; income: number; expense: number }[];
  projection: { days_elapsed: number; days_in_month: number; daily_average: number; projected_expense: number };
  budgets: { count: number; over: number; warning: number };
  recent: (Omit<Transaction, 'category_id'>)[];
};
