import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/Sheet';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { Button, Card, EmptyState, ErrorBanner, Field, Loading, ProgressBar, SectionTitle, Segmented, type IconName } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { dateLabel, money, parseAmount } from '@/lib/format';
import { useFocusData } from '@/lib/hooks';
import type { Goal } from '@/lib/types';

export default function Goals() {
  const router = useRouter();
  const { user } = useAuth();
  const [currency, setCurrency] = useState(user?.currency || 'ZAR');
  const { data, error, loading, refreshing, refresh, reload } = useFocusData(() => api.goals(currency), [currency]);
  const [contributeTo, setContributeTo] = useState<Goal | null>(null);

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={st.content} refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}>
      <CurrencyPicker value={currency} onChange={setCurrency} />
      {error ? <ErrorBanner message={error} onRetry={() => reload()} /> : null}
      {loading && !data ? <Loading /> : data && (
        <>
          <View style={st.hero}>
            <Text style={{ color: '#94A3B8' }}>Total saved</Text>
            <Text style={st.heroValue}>{money(data.totals.saved, currency)}</Text>
            <Text style={{ color: '#CBD5E1', marginBottom: 12 }}>of {money(data.totals.target, currency)} across {data.goals.length} goal{data.goals.length === 1 ? '' : 's'}</Text>
            <ProgressBar percent={data.totals.percent} color="#FACC15" height={10} />
          </View>
          <SectionTitle right={<Button small title="New goal" icon="add" onPress={() => router.push('/goal')} testID="new-goal" />}>Savings goals</SectionTitle>
          {data.goals.length === 0 ? (
            <Card><EmptyState icon="trophy-outline" title="No goals yet" text="Create a goal like an emergency fund or a new laptop, and we’ll work out how much to save each month." /></Card>
          ) : data.goals.map((g) => (
            <Card key={g.id} style={{ marginBottom: 12 }}>
              <Pressable onPress={() => router.push({ pathname: '/goal', params: { id: String(g.id) } })} testID={`goal-${g.name}`}>
                <View style={st.row}>
                  <View style={[st.icon, { backgroundColor: g.achieved ? colors.incomeSoft : colors.primarySoft }]}>
                    <Ionicons name={(g.achieved ? 'checkmark-circle' : g.icon) as IconName} size={22} color={g.achieved ? colors.income : colors.primary} />
                  </View>
                  <View style={{ flex: 1, marginLeft: 12 }}>
                    <Text style={st.name}>{g.name}</Text>
                    <Text style={st.muted}>{money(g.saved, g.currency)} of {money(g.target, g.currency)}</Text>
                  </View>
                  <Text style={[st.percent, g.achieved && { color: colors.income }]}>{g.percent}%</Text>
                </View>
                <View style={{ marginVertical: 12 }}><ProgressBar percent={g.percent} color={g.achieved ? colors.income : colors.primary} /></View>
                <Text style={[st.muted, g.overdue && { color: colors.expense }]}>
                  {g.achieved ? '🎉 Goal reached!'
                    : g.overdue ? `Deadline passed · ${money(g.remaining, g.currency)} still to go`
                    : g.monthly_needed !== null ? `Save ${money(g.monthly_needed, g.currency)}/month for ${g.months_left} month${g.months_left === 1 ? '' : 's'} · by ${dateLabel(g.deadline!)}`
                    : `${money(g.remaining, g.currency)} to go · no deadline`}
                </Text>
              </Pressable>
              {!g.achieved && (
                <View style={{ marginTop: 12 }}>
                  <Button small variant="secondary" icon="add-circle-outline" title="Add money" onPress={() => setContributeTo(g)} testID={`contribute-${g.name}`} />
                </View>
              )}
            </Card>
          ))}
        </>
      )}
      <ContributeSheet goal={contributeTo} onClose={() => setContributeTo(null)} onDone={() => { setContributeTo(null); void reload(); }} />
    </ScrollView>
  );
}

function ContributeSheet({ goal, onClose, onDone }: { goal: Goal | null; onClose: () => void; onDone: () => void }) {
  const [mode, setMode] = useState<'add' | 'withdraw'>('add');
  const [amount, setAmount] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (goal) { setAmount(''); setError(null); setMode('add'); } }, [goal]);

  async function submit() {
    const value = parseAmount(amount);
    if (!goal) return;
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than 0');
    setBusy(true);
    try { await api.contribute(goal.id, mode === 'add' ? value : -value); onDone(); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <Sheet visible={!!goal} title={goal ? goal.name : ''} onClose={onClose}>
      {error ? <ErrorBanner message={error} /> : null}
      <Segmented value={mode} onChange={setMode} options={[{ value: 'add', label: 'Add money' }, { value: 'withdraw', label: 'Withdraw' }]} />
      <View style={{ height: 14 }} />
      {goal && <Text style={[st.muted, { marginBottom: 12 }]}>Saved so far: {money(goal.saved, goal.currency)} · {money(goal.remaining, goal.currency)} to go</Text>}
      <Field label={`Amount (${goal?.currency || ''})`} value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" testID="contribute-amount" />
      {goal && goal.remaining > 0 && mode === 'add' && (
        <Pressable onPress={() => setAmount(String(goal.remaining))} style={{ marginTop: -6, marginBottom: 16 }}>
          <Text style={{ color: colors.primary, fontWeight: '600' }}>Fill remaining ({money(goal.remaining, goal.currency)})</Text>
        </Pressable>
      )}
      <Button title={mode === 'add' ? 'Add to goal' : 'Withdraw'} onPress={submit} loading={busy} testID="contribute-save" />
    </Sheet>
  );
}

const st = StyleSheet.create({
  content: { padding: 20, paddingBottom: 60, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  hero: { backgroundColor: colors.navy, borderRadius: radius.lg, padding: 20 },
  heroValue: { color: '#fff', fontSize: 30, fontWeight: '800', marginVertical: 4 },
  row: { flexDirection: 'row', alignItems: 'center' },
  icon: { width: 44, height: 44, borderRadius: 14, alignItems: 'center', justifyContent: 'center' },
  name: { fontSize: 16, fontWeight: '700', color: colors.text },
  muted: { color: colors.muted, fontSize: 13 },
  percent: { fontSize: 18, fontWeight: '800', color: colors.primary },
});
