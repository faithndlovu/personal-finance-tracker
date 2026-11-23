import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, CategoryIcon, ErrorBanner, Field, Loading, SectionTitle, Segmented, type IconName } from '@/components/ui';
import { CATEGORY_COLORS, CATEGORY_ICONS, colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { confirm, useFocusData } from '@/lib/hooks';
import type { Category } from '@/lib/types';

export default function Categories() {
  const { data, error, loading, reload } = useFocusData(() => api.categories());
  const [type, setType] = useState<'expense' | 'income'>('expense');
  const [name, setName] = useState('');
  const [color, setColor] = useState(CATEGORY_COLORS[0]);
  const [icon, setIcon] = useState<string>('pricetag');
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function add() {
    if (!name.trim()) return setFormError('Enter a category name');
    setBusy(true); setFormError(null);
    try { await api.createCategory({ name, type, color, icon }); setName(''); await reload(); } catch (e: any) { setFormError(e.message); } finally { setBusy(false); }
  }
  async function remove(c: Category) {
    if (!(await confirm(`Delete “${c.name}”?`, 'Categories with transactions cannot be deleted.'))) return;
    try { await api.deleteCategory(c.id); await reload(); } catch (e: any) { setFormError(e.message); }
  }

  const list = (data?.categories || []).filter((c) => c.type === type);
  return (
    <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
      <Segmented value={type} onChange={setType} options={[{ value: 'expense', label: 'Expense' }, { value: 'income', label: 'Income' }]} />
      {error ? <View style={{ marginTop: 12 }}><ErrorBanner message={error} onRetry={() => reload()} /></View> : null}
      {loading && !data ? <Loading /> : (
        <Card style={{ marginTop: 14, paddingVertical: 4 }}>
          {list.map((c, i) => (
            <View key={c.id} style={[st.row, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <CategoryIcon icon={c.icon} color={c.color} size={36} />
              <View style={{ flex: 1, marginLeft: 12 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }}>{c.name}</Text>
                <Text style={{ fontSize: 12, color: colors.muted }}>{c.usage || 0} transaction{c.usage === 1 ? '' : 's'}</Text>
              </View>
              {!c.usage ? <Pressable onPress={() => remove(c)} hitSlop={10} accessibilityLabel={`Delete ${c.name}`}><Ionicons name="trash-outline" size={20} color={colors.expense} /></Pressable> : null}
            </View>
          ))}
        </Card>
      )}
      <SectionTitle>Add {type} category</SectionTitle>
      <Card>
        {formError ? <ErrorBanner message={formError} /> : null}
        <Field label="Name" value={name} onChangeText={setName} placeholder="e.g. Pets" />
        <Text style={st.label}>Colour</Text>
        <View style={st.wrap}>
          {CATEGORY_COLORS.map((c) => (
            <Pressable key={c} onPress={() => setColor(c)} style={[st.swatch, { backgroundColor: c }, color === c && st.swatchActive]} accessibilityLabel={`Colour ${c}`} />
          ))}
        </View>
        <Text style={st.label}>Icon</Text>
        <View style={st.wrap}>
          {CATEGORY_ICONS.map((i) => (
            <Pressable key={i} onPress={() => setIcon(i)} style={[st.iconBtn, icon === i && { borderColor: color, backgroundColor: `${color}1A` }]}>
              <Ionicons name={i as IconName} size={20} color={icon === i ? color : colors.muted} />
            </Pressable>
          ))}
        </View>
        <Button title="Add category" icon="add" onPress={add} loading={busy} />
      </Card>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: 10 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 8, fontWeight: '500' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 },
  swatch: { width: 32, height: 32, borderRadius: 16 },
  swatchActive: { borderWidth: 3, borderColor: colors.text },
  iconBtn: { width: 42, height: 42, borderRadius: 10, alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
});
