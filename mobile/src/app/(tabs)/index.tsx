import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { DonutChart, TrendChart } from '@/components/charts';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { TransactionRow } from '@/components/TransactionRow';
import { Card, EmptyState, ErrorBanner, Loading, MonthSwitcher, SectionTitle } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentMonth, money } from '@/lib/format';
import { useFocusData } from '@/lib/hooks';

export default function Overview() {
  const { user } = useAuth();
  const router = useRouter();
  const [month, setMonth] = useState(currentMonth());
  const [currency, setCurrency] = useState(user?.currency || 'ZAR');
  const { data, error, loading, refreshing, refresh, reload } = useFocusData(() => api.summary(month, currency), [month, currency]);
  const { width } = useWindowDimensions();
  const contentWidth = Math.min(width, 640) - 40 - 32;
  const cur = currency;

  return (
    <View style={{ flex: 1 }}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={st.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
        <Text style={st.greeting}>Hi {user?.name.split(' ')[0]} 👋</Text>
        <CurrencyPicker value={currency} onChange={setCurrency} />
        <MonthSwitcher month={month} onChange={setMonth} />
        {error ? <View style={{ marginTop: 12 }}><ErrorBanner message={error} onRetry={() => reload()} /></View> : null}
        {loading && !data ? <Loading /> : data && (
          <>
            <View style={st.hero}>
              <Text style={st.heroLabel}>Balance</Text>
              <Text style={st.heroValue} testID="balance">{money(data.balance, cur)}</Text>
              <View style={st.heroRow}>
                <View style={st.heroStat}>
                  <View style={[st.badge, { backgroundColor: '#14532D' }]}><Ionicons name="arrow-down" size={14} color="#4ADE80" /></View>
                  <View><Text style={st.heroSmall}>Income</Text><Text style={st.heroStatValue}>{money(data.income, cur)}</Text></View>
                </View>
                <View style={st.heroStat}>
                  <View style={[st.badge, { backgroundColor: '#7F1D1D' }]}><Ionicons name="arrow-up" size={14} color="#F87171" /></View>
                  <View><Text style={st.heroSmall}>Expenses</Text><Text style={st.heroStatValue}>{money(data.expense, cur)}</Text></View>
                </View>
              </View>
            </View>

            <View style={st.kpis}>
              <Card style={st.kpi}>
                <Text style={st.kpiLabel}>Net this month</Text>
                <Text style={[st.kpiValue, { color: data.net >= 0 ? colors.income : colors.expense }]}>{money(data.net, cur, { sign: true })}</Text>
              </Card>
              <Card style={st.kpi}>
                <Text style={st.kpiLabel}>Savings rate</Text>
                <Text style={[st.kpiValue, { color: (data.savings_rate ?? 0) >= 0 ? colors.text : colors.expense }]}>{data.savings_rate === null ? '—' : `${data.savings_rate}%`}</Text>
              </Card>
              <Card style={st.kpi}>
                <Text style={st.kpiLabel}>Daily average</Text>
                <Text style={st.kpiValue}>{money(data.projection.daily_average, cur, { compact: true })}</Text>
              </Card>
              <Card style={st.kpi}>
                <Text style={st.kpiLabel}>{data.projection.days_elapsed < data.projection.days_in_month ? 'Projected spend' : 'Total spend'}</Text>
                <Text style={st.kpiValue}>{money(data.projection.projected_expense, cur, { compact: true })}</Text>
              </Card>
            </View>

            {data.budgets.over + data.budgets.warning > 0 && (
              <Pressable onPress={() => router.push({ pathname: '/budgets', params: { currency } })} style={[st.alert, { backgroundColor: data.budgets.over ? colors.expenseSoft : colors.warningSoft }]}>
                <Ionicons name="warning" size={20} color={data.budgets.over ? colors.expense : colors.warning} />
                <Text style={{ flex: 1, color: colors.text }}>
                  {data.budgets.over ? `${data.budgets.over} budget${data.budgets.over > 1 ? 's' : ''} over the limit` : ''}
                  {data.budgets.over && data.budgets.warning ? ' · ' : ''}
                  {data.budgets.warning ? `${data.budgets.warning} close to the limit` : ''}
                </Text>
                <Ionicons name="chevron-forward" size={18} color={colors.muted} />
              </Pressable>
            )}

            <SectionTitle>Spending by category</SectionTitle>
            <Card>
              {data.by_category.length === 0 ? (
                <EmptyState icon="pie-chart-outline" title="No spending yet" text="Expenses you add this month will appear here." />
              ) : (
                <View style={{ alignItems: 'center' }}>
                  <DonutChart data={data.by_category} total={data.expense} currency={cur} />
                  <View style={{ width: '100%', marginTop: 16 }}>
                    {data.by_category.slice(0, 6).map((c) => (
                      <View key={c.id} style={st.legendRow}>
                        <View style={[st.legendDot, { backgroundColor: c.color }]} />
                        <Text style={{ flex: 1, color: colors.text }}>{c.name}</Text>
                        <Text style={{ color: colors.muted, marginRight: 10 }}>{c.percent}%</Text>
                        <Text style={{ fontWeight: '600', color: colors.text }}>{money(c.total, cur)}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}
            </Card>

            <SectionTitle right={<View style={{ flexDirection: 'row', gap: 12 }}><Legend color={colors.income} label="Income" /><Legend color={colors.expense} label="Expenses" /></View>}>
              6-month trend
            </SectionTitle>
            <Card><TrendChart data={data.trend} width={contentWidth} /></Card>

            <SectionTitle right={<Pressable onPress={() => router.push({ pathname: '/transactions', params: { currency } })}><Text style={{ color: colors.primary, fontWeight: '600' }}>See all</Text></Pressable>}>
              Recent transactions
            </SectionTitle>
            <Card style={{ paddingVertical: 4 }}>
              {data.recent.length === 0
                ? <EmptyState icon="receipt-outline" title="No transactions yet" text="Tap + to record your first income or expense." />
                : data.recent.map((t) => <TransactionRow key={t.id} t={t} onPress={() => router.push({ pathname: '/transaction', params: { id: String(t.id) } })} />)}
            </Card>
          </>
        )}
      </ScrollView>
      <Pressable accessibilityLabel="Add transaction" testID="fab" style={st.fab} onPress={() => router.push('/transaction')}>
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const Legend = ({ color, label }: { color: string; label: string }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: color, marginRight: 5 }} />
    <Text style={{ fontSize: 12, color: colors.muted }}>{label}</Text>
  </View>
);

const st = StyleSheet.create({
  content: { padding: 20, paddingBottom: 100, maxWidth: 640, width: '100%', alignSelf: 'center' },
  greeting: { fontSize: 15, color: colors.muted, marginBottom: 12 },
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 20, marginTop: 16 },
  heroLabel: { color: '#94A3B8', fontSize: 14 },
  heroValue: { color: '#fff', fontSize: 32, fontWeight: '800', marginTop: 4 },
  heroRow: { flexDirection: 'row', marginTop: 18, gap: 12 },
  heroStat: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#13265A', padding: 12, borderRadius: radius.md },
  badge: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  heroSmall: { color: '#94A3B8', fontSize: 12 },
  heroStatValue: { color: '#fff', fontWeight: '700', fontSize: 15 },
  kpis: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginTop: 12 },
  kpi: { flexBasis: '47%', flexGrow: 1, padding: 14 },
  kpiLabel: { color: colors.muted, fontSize: 12 },
  kpiValue: { fontSize: 18, fontWeight: '700', marginTop: 4, color: colors.text },
  alert: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 14, borderRadius: radius.md, marginTop: 12 },
  legendRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 7 },
  legendDot: { width: 10, height: 10, borderRadius: 5, marginRight: 10 },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 }, elevation: 6 },
});
