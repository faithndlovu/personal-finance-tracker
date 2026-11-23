import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { Button, Card, CategoryIcon, EmptyState, ErrorBanner, Field, Loading, MonthSwitcher, ProgressBar, SectionTitle } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentMonth, money, parseAmount } from '@/lib/format';
import { confirm, useFocusData } from '@/lib/hooks';
import type { Budget, Category } from '@/lib/types';

const statusColor = { ok: colors.income, warning: colors.warning, over: colors.expense };

export default function Budgets() {
  const params = useLocalSearchParams<{ currency?: string }>();
  const { user } = useAuth();
  const [currency, setCurrency] = useState(params.currency || user?.currency || 'ZAR');
  const [month, setMonth] = useState(currentMonth());
  const { data, error, loading, refreshing, refresh, reload } = useFocusData(() => api.budgets(month, currency), [month, currency]);
  const [sheet, setSheet] = useState<{ budget?: Budget } | null>(null);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={st.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <CurrencyPicker value={currency} onChange={setCurrency} />
      <MonthSwitcher month={month} onChange={setMonth} />
      {error ? <View style={{ marginTop: 12 }}><ErrorBanner message={error} onRetry={() => reload()} /></View> : null}
      {loading && !data ? <Loading /> : data && (
        <>
          {data.budgets.length > 0 && (
            <Card style={{ marginTop: 16 }}>
              <Text style={st.muted}>Total budgeted</Text>
              <View style={st.rowBetween}>
                <Text style={st.big}>{money(data.totals.spent, currency)}</Text>
                <Text style={st.muted}>of {money(data.totals.limit, currency)}</Text>
              </View>
              <ProgressBar percent={data.totals.percent} height={10} color={data.totals.percent > 100 ? colors.expense : data.totals.percent >= 80 ? colors.warning : colors.primary} />
              <Text style={[st.muted, { marginTop: 8 }]}>
                {data.totals.remaining >= 0 ? `${money(data.totals.remaining, currency)} left to spend` : `${money(-data.totals.remaining, currency)} over budget`}
              </Text>
            </Card>
          )}
          <SectionTitle right={<Button small title="Set budget" icon="add" onPress={() => setSheet({})} testID="add-budget" />}>Monthly budgets</SectionTitle>
          {data.budgets.length === 0 ? (
            <Card><EmptyState icon="speedometer-outline" title="No budgets yet" text="Set monthly spending limits for categories like groceries or eating out, and we’ll warn you when you get close." /></Card>
          ) : data.budgets.map((b) => (
            <Pressable key={b.id} onPress={() => setSheet({ budget: b })} testID={`budget-${b.category_name}`}>
              <Card style={{ marginBottom: 10 }}>
                <View style={[st.rowBetween, { marginBottom: 10 }]}>
                  <View style={st.row}>
                    <CategoryIcon icon={b.category_icon} color={b.category_color} size={36} />
                    <View style={{ marginLeft: 10 }}>
                      <Text style={st.name}>{b.category_name}</Text>
                      <Text style={st.muted}>{money(b.spent, currency)} of {money(b.limit, currency)}</Text>
                    </View>
                  </View>
                  <View style={[st.pill, { backgroundColor: `${statusColor[b.status]}1A` }]}>
                    <Text style={{ color: statusColor[b.status], fontWeight: '700', fontSize: 12 }}>{b.percent}%</Text>
                  </View>
                </View>
                <ProgressBar percent={b.percent} color={statusColor[b.status]} />
                <Text style={[st.muted, { marginTop: 8, color: b.status === 'over' ? colors.expense : colors.muted }]}>
                  {b.status === 'over' ? `Over by ${money(-b.remaining, currency)}` : `${money(b.remaining, currency)} remaining`}
                  {b.status === 'warning' ? ' · getting close' : ''}
                </Text>
              </Card>
            </Pressable>
          ))}
        </>
      )}
      <BudgetSheet state={sheet} currency={currency} existing={data?.budgets || []} onClose={() => setSheet(null)} onSaved={() => { setSheet(null); void reload(); }} />
    </ScrollView>
  );
}

function BudgetSheet({ state, currency, existing, onClose, onSaved }: {
  state: { budget?: Budget } | null; currency: string; existing: Budget[]; onClose: () => void; onSaved: () => void;
}) {
  const [cats, setCats] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [limit, setLimit] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const existingRef = useRef(existing);
  existingRef.current = existing;

  // Reset the form each time the sheet opens.
  useEffect(() => {
    if (!state) return;
    let cancelled = false;
    setError(null);
    setCategoryId(state.budget?.category_id ?? null);
    setLimit(state.budget ? String(state.budget.limit) : '');
    api.categories().then((r) => {
      if (cancelled) return;
      const expense = r.categories.filter((c) => c.type === 'expense');
      setCats(expense);
      if (!state.budget) {
        const unused = expense.find((c) => !existingRef.current.some((b) => b.category_id === c.id));
        setCategoryId(unused?.id ?? expense[0]?.id ?? null);
      }
    }).catch((e) => !cancelled && setError(e.message));
    return () => { cancelled = true; };
  }, [state]);

  async function save() {
    const value = parseAmount(limit);
    if (!categoryId) return setError('Choose a category');
    if (!Number.isFinite(value) || value <= 0) return setError('Enter a monthly limit greater than 0');
    setBusy(true);
    try { await api.saveBudget({ category_id: categoryId, limit: value, currency }); onSaved(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }
  async function remove() {
    if (!state?.budget || !(await confirm('Remove budget?', `Stop tracking a limit for ${state.budget.category_name}?`, 'Remove'))) return;
    try { await api.deleteBudget(state.budget.id); onSaved(); } catch (e: any) { setError(e.message); }
  }

  return (
    <Sheet visible={!!state} title={state?.budget ? `Edit ${state.budget.category_name} budget` : 'Set a monthly budget'} onClose={onClose}>
      {error ? <ErrorBanner message={error} /> : null}
      {!state?.budget && (
        <>
          <Text style={st.label}>Category</Text>
          <View style={st.chips}>
            {cats.map((c) => {
              const has = existing.some((b) => b.category_id === c.id);
              return (
                <Pressable key={c.id} onPress={() => setCategoryId(c.id)} style={[st.chip, categoryId === c.id && { borderColor: c.color, backgroundColor: `${c.color}1A` }]}>
                  <Ionicons name={c.icon as any} size={14} color={c.color} />
                  <Text style={st.chipText}>{c.name}{has ? ' ✓' : ''}</Text>
                </Pressable>
              );
            })}
          </View>
        </>
      )}
      <Field label={`Monthly limit (${currency})`} value={limit} onChangeText={setLimit} keyboardType="decimal-pad" placeholder="0.00" testID="budget-limit" />
      <Button title="Save budget" onPress={save} loading={busy} testID="save-budget" />
      {state?.budget ? <View style={{ marginTop: 10 }}><Button title="Remove budget" variant="danger" onPress={remove} /></View> : null}
    </Sheet>
  );
}

const st = StyleSheet.create({
  content: { padding: 20, paddingBottom: 60, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center' },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  muted: { color: colors.muted, fontSize: 13 },
  big: { fontSize: 26, fontWeight: '800', color: colors.text, marginVertical: 6 },
  name: { fontSize: 16, fontWeight: '600', color: colors.text },
  pill: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.pill },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  chipText: { fontSize: 13, color: colors.text, fontWeight: '500' },
});
