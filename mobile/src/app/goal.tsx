import Ionicons from '@expo/vector-icons/Ionicons';
import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, ErrorBanner, Field, Loading, type IconName } from '@/components/ui';
import { colors, GOAL_ICONS, radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { parseAmount } from '@/lib/format';
import { confirm } from '@/lib/hooks';

/** Create (no id) or edit (?id=) a savings goal. */
export default function GoalForm() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const [name, setName] = useState('');
  const [target, setTarget] = useState('');
  const [saved, setSaved] = useState('');
  const [deadline, setDeadline] = useState('');
  const [icon, setIcon] = useState<string>('flag');
  const [loading, setLoading] = useState(editing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!editing) return;
    api.goals().then(({ goals }) => {
      const g = goals.find((x) => x.id === Number(id));
      if (!g) { setError('Goal not found'); return; }
      setName(g.name); setTarget(String(g.target)); setDeadline(g.deadline || ''); setIcon(g.icon);
    }).catch((e) => setError(e.message)).finally(() => setLoading(false));
  }, [editing, id]);

  async function save() {
    const t = parseAmount(target);
    if (!name.trim()) return setError('Give your goal a name');
    if (!Number.isFinite(t) || t <= 0) return setError('Target must be greater than 0');
    if (deadline && !/^\d{4}-\d{2}-\d{2}$/.test(deadline)) return setError('Deadline must be YYYY-MM-DD (or leave it empty)');
    const s = saved ? parseAmount(saved) : 0;
    if (!editing && (!Number.isFinite(s) || s < 0)) return setError('Starting amount cannot be negative');
    setBusy(true); setError(null);
    try {
      const body = { name, target: t, deadline: deadline || null, icon };
      if (editing) await api.updateGoal(Number(id), body); else await api.createGoal({ ...body, saved: s });
      router.back();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  async function remove() {
    if (!(await confirm('Delete goal?', 'The goal and its contribution history will be removed.'))) return;
    try { await api.deleteGoal(Number(id)); router.back(); } catch (e: any) { setError(e.message); }
  }

  const presetDeadline = (months: number) => {
    const d = new Date(); d.setMonth(d.getMonth() + months);
    setDeadline(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`);
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: editing ? 'Edit goal' : 'New savings goal' }} />
      {loading ? <Loading /> : (
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          {error ? <ErrorBanner message={error} /> : null}
          <Field label="Goal name" value={name} onChangeText={setName} placeholder="e.g. Emergency fund" testID="goal-name" />
          <Field label="Target amount" value={target} onChangeText={setTarget} keyboardType="decimal-pad" placeholder="0.00" testID="goal-target" />
          {!editing && <Field label="Already saved (optional)" value={saved} onChangeText={setSaved} keyboardType="decimal-pad" placeholder="0.00" testID="goal-saved" />}
          <Field label="Deadline (optional, YYYY-MM-DD)" value={deadline} onChangeText={setDeadline} autoCapitalize="none" placeholder="2027-12-31" testID="goal-deadline" />
          <View style={st.chips}>
            {[3, 6, 12, 24].map((m) => (
              <Pressable key={m} style={st.chip} onPress={() => presetDeadline(m)}><Text style={st.chipText}>In {m < 12 ? `${m} months` : `${m / 12} year${m > 12 ? 's' : ''}`}</Text></Pressable>
            ))}
            {deadline ? <Pressable style={st.chip} onPress={() => setDeadline('')}><Text style={st.chipText}>No deadline</Text></Pressable> : null}
          </View>
          <Text style={st.label}>Icon</Text>
          <View style={st.icons}>
            {GOAL_ICONS.map((i) => (
              <Pressable key={i} onPress={() => setIcon(i)} style={[st.iconBtn, icon === i && { borderColor: colors.primary, backgroundColor: colors.primarySoft }]}>
                <Ionicons name={i as IconName} size={22} color={icon === i ? colors.primary : colors.muted} />
              </Pressable>
            ))}
          </View>
          <Button title={editing ? 'Save changes' : 'Create goal'} onPress={save} loading={busy} testID="goal-save" />
          {editing ? <View style={{ marginTop: 10 }}><Button title="Delete goal" variant="danger" icon="trash-outline" onPress={remove} /></View> : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: '500' },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: -6, marginBottom: 18 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '500' },
  icons: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 22 },
  iconBtn: { width: 48, height: 48, borderRadius: 12, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
});
