import { Stack, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { Button, CategoryIcon, ErrorBanner, Field, Loading, Segmented } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { todayISO, parseAmount } from '@/lib/format';
import { confirm } from '@/lib/hooks';
import type { Category } from '@/lib/types';

/** Create (no id) or edit (?id=123) a transaction. */
export default function TransactionForm() {
  const router = useRouter();
  const { user } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const editing = !!id;
  const [categories, setCategories] = useState<Category[]>([]);
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(user?.currency || 'ZAR');
  const [categoryId, setCategoryId] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [date, setDate] = useState(todayISO());
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const [{ categories: cats }, existing] = await Promise.all([api.categories(), editing ? api.transaction(Number(id)) : Promise.resolve(null)]);
        setCategories(cats);
        if (existing) {
          const t = existing.transaction;
          setType(t.type); setAmount(String(t.amount)); setCurrency(t.currency);
          setCategoryId(t.category_id); setDescription(t.description); setDate(t.date);
        }
      } catch (e: any) { setError(e.message); } finally { setLoading(false); }
    })();
  }, [editing, id]);

  const visible = useMemo(() => categories.filter((c) => c.type === type), [categories, type]);
  useEffect(() => {
    if (!loading && !visible.some((c) => c.id === categoryId)) setCategoryId(visible[0]?.id ?? null);
  }, [visible, loading, categoryId]);

  async function save() {
    const value = parseAmount(amount);
    if (!Number.isFinite(value) || value <= 0) return setError('Enter an amount greater than 0');
    if (!categoryId) return setError('Choose a category');
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return setError('Date must be in YYYY-MM-DD format');
    setBusy(true); setError(null);
    try {
      const body = { amount: value, currency, category_id: categoryId, description, date };
      if (editing) await api.updateTransaction(Number(id), body); else await api.createTransaction(body);
      router.back();
    } catch (e: any) { setError(e.message); setBusy(false); }
  }

  async function remove() {
    if (!(await confirm('Delete transaction?', 'This cannot be undone.'))) return;
    try { await api.deleteTransaction(Number(id)); router.back(); } catch (e: any) { setError(e.message); }
  }

  const shiftDate = (days: number) => {
    const d = new Date(); d.setDate(d.getDate() + days);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  };

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <Stack.Screen options={{ title: editing ? 'Edit transaction' : 'New transaction' }} />
      {loading ? <Loading /> : (
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          {error ? <ErrorBanner message={error} /> : null}
          <Segmented value={type} onChange={setType} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
          <View style={{ height: 16 }} />
          <CurrencyPicker value={currency} onChange={setCurrency} />
          <Field label="Amount" value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="0.00" testID="amount"
            style={{ fontSize: 28, fontWeight: '700', color: type === 'income' ? colors.income : colors.text }} />
          <Text style={st.label}>Category</Text>
          <View style={st.grid}>
            {visible.map((c) => (
              <Pressable key={c.id} onPress={() => setCategoryId(c.id)} testID={`cat-${c.name}`}
                style={[st.cat, categoryId === c.id && { borderColor: c.color, backgroundColor: `${c.color}14` }]}>
                <CategoryIcon icon={c.icon} color={c.color} size={34} />
                <Text style={st.catText} numberOfLines={1}>{c.name}</Text>
              </Pressable>
            ))}
          </View>
          <Field label="Description (optional)" value={description} onChangeText={setDescription} placeholder="e.g. Weekly groceries" maxLength={200} testID="description" />
          <Field label="Date (YYYY-MM-DD)" value={date} onChangeText={setDate} placeholder="2026-01-31" autoCapitalize="none" testID="date" />
          <View style={st.quick}>
            {[['Today', 0], ['Yesterday', -1], ['2 days ago', -2]].map(([label, d]) => (
              <Pressable key={label} style={[st.chip, date === shiftDate(d as number) && st.chipActive]} onPress={() => setDate(shiftDate(d as number))}>
                <Text style={[st.chipText, date === shiftDate(d as number) && { color: colors.primary }]}>{label}</Text>
              </Pressable>
            ))}
          </View>
          <Button title={editing ? 'Save changes' : `Add ${type}`} onPress={save} loading={busy} testID="save" />
          {editing ? <View style={{ marginTop: 10 }}><Button title="Delete transaction" variant="danger" icon="trash-outline" onPress={remove} /></View> : null}
        </ScrollView>
      )}
    </KeyboardAvoidingView>
  );
}

const st = StyleSheet.create({
  content: { padding: 20, paddingBottom: 40, maxWidth: 640, width: '100%', alignSelf: 'center' },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: '500' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  cat: { width: '31%', flexGrow: 1, alignItems: 'center', paddingVertical: 10, paddingHorizontal: 4, borderRadius: radius.sm, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  catText: { fontSize: 12, marginTop: 6, color: colors.text, fontWeight: '500' },
  quick: { flexDirection: 'row', gap: 8, marginTop: -6, marginBottom: 20 },
  chip: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: radius.pill, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border },
  chipActive: { borderColor: colors.primary, backgroundColor: colors.primarySoft },
  chipText: { fontSize: 13, color: colors.muted, fontWeight: '500' },
});
