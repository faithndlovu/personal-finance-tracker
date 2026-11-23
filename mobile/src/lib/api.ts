import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { prefs, secureStorage } from './storage';
import type {
  Budget, BudgetsResponse, Category, Goal, GoalsResponse, Summary, Transaction, TransactionsResponse, User,
} from './types';

const TOKEN_KEY = 'auth_token';
const API_URL_KEY = 'api_url';
const API_PORT = 4000;

/**
 * Works out where the API lives:
 * 1. A URL the user saved on the sign-in screen
 * 2. EXPO_PUBLIC_API_URL from .env
 * 3. The same machine that serves the Expo bundle (works automatically with Expo Go on your LAN)
 * 4. localhost (10.0.2.2 on the Android emulator)
 */
export function defaultApiUrl(): string {
  if (process.env.EXPO_PUBLIC_API_URL) return process.env.EXPO_PUBLIC_API_URL.replace(/\/$/, '');
  if (Platform.OS === 'web' && typeof window !== 'undefined') return `${window.location.protocol}//${window.location.hostname}:${API_PORT}`;
  const hostUri = Constants.expoConfig?.hostUri; // e.g. "192.168.1.20:8081"
  const host = hostUri?.split(':')[0];
  if (host && host !== 'localhost' && host !== '127.0.0.1') return `http://${host}:${API_PORT}`;
  return Platform.OS === 'android' ? `http://10.0.2.2:${API_PORT}` : `http://localhost:${API_PORT}`;
}

let baseUrl: string | null = null;
let token: string | null = null;
let onUnauthorized: (() => void) | null = null;

export async function initApi() {
  baseUrl = (await prefs.get(API_URL_KEY)) || defaultApiUrl();
  token = await secureStorage.get(TOKEN_KEY);
  return { baseUrl, token };
}
export const getApiUrl = () => baseUrl || defaultApiUrl();
export async function setApiUrl(url: string | null) {
  if (url) { baseUrl = url.trim().replace(/\/$/, ''); await prefs.set(API_URL_KEY, baseUrl); }
  else { baseUrl = defaultApiUrl(); await prefs.remove(API_URL_KEY); }
}
export async function setToken(value: string | null) {
  token = value;
  if (value) await secureStorage.set(TOKEN_KEY, value); else await secureStorage.remove(TOKEN_KEY);
}
export const setUnauthorizedHandler = (fn: () => void) => { onUnauthorized = fn; };

export class ApiError extends Error {
  constructor(message: string, public status: number) { super(message); }
}

async function request<T>(path: string, options: { method?: string; body?: unknown } = {}): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 15000);
  let res: Response;
  try {
    res = await fetch(`${getApiUrl()}/api${path}`, {
      method: options.method || 'GET',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
  } catch {
    throw new ApiError(`Can't reach the server at ${getApiUrl()}. Is the API running, and is your phone on the same Wi-Fi?`, 0);
  } finally {
    clearTimeout(timer);
  }
  if (res.status === 401 && token) onUnauthorized?.();
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(data.error || `Request failed (${res.status})`, res.status);
  return data as T;
}

const qs = (params: Record<string, string | number | undefined>) => {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  return entries.length ? `?${entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&')}` : '';
};

export const api = {
  health: () => request<{ status: string }>('/health'),
  register: (body: { name: string; email: string; password: string; currency?: string }) =>
    request<{ token: string; user: User }>('/auth/register', { method: 'POST', body }),
  login: (body: { email: string; password: string }) => request<{ token: string; user: User }>('/auth/login', { method: 'POST', body }),
  me: () => request<{ user: User }>('/auth/me'),
  updateMe: (body: Partial<{ name: string; currency: string; current_password: string; new_password: string }>) =>
    request<{ user: User }>('/auth/me', { method: 'PUT', body }),
  deleteAccount: (password: string) => request<void>('/auth/me', { method: 'DELETE', body: { password } }),

  summary: (month: string) => request<Summary>(`/summary${qs({ month })}`),
  categories: () => request<{ categories: Category[] }>('/categories'),
  createCategory: (body: { name: string; type: 'income' | 'expense'; color?: string; icon?: string }) =>
    request<{ category: Category }>('/categories', { method: 'POST', body }),
  deleteCategory: (id: number) => request<void>(`/categories/${id}`, { method: 'DELETE' }),

  transactions: (params: { month?: string; type?: string; q?: string; category_id?: number }) =>
    request<TransactionsResponse>(`/transactions${qs(params)}`),
  transaction: (id: number) => request<{ transaction: Transaction }>(`/transactions/${id}`),
  createTransaction: (body: TransactionInput) => request<{ transaction: Transaction }>('/transactions', { method: 'POST', body }),
  updateTransaction: (id: number, body: TransactionInput) => request<{ transaction: Transaction }>(`/transactions/${id}`, { method: 'PUT', body }),
  deleteTransaction: (id: number) => request<void>(`/transactions/${id}`, { method: 'DELETE' }),

  budgets: (month: string) => request<BudgetsResponse>(`/budgets${qs({ month })}`),
  saveBudget: (body: { category_id: number; limit: number | string }) => request<{ budget: Budget }>('/budgets', { method: 'POST', body }),
  deleteBudget: (id: number) => request<void>(`/budgets/${id}`, { method: 'DELETE' }),

  goals: () => request<GoalsResponse>('/goals'),
  createGoal: (body: GoalInput) => request<{ goal: Goal }>('/goals', { method: 'POST', body }),
  updateGoal: (id: number, body: GoalInput) => request<{ goal: Goal }>(`/goals/${id}`, { method: 'PUT', body }),
  contribute: (id: number, amount: number) => request<{ goal: Goal }>(`/goals/${id}/contribute`, { method: 'POST', body: { amount } }),
  deleteGoal: (id: number) => request<void>(`/goals/${id}`, { method: 'DELETE' }),
};

export type TransactionInput = { amount: number | string; date: string; category_id: number; description?: string };
export type GoalInput = { name: string; target: number | string; saved?: number | string; deadline?: string | null; icon?: string };
