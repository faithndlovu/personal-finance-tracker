import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { colors, radius } from '@/constants/theme';
import { api } from '@/lib/api';
import type { CurrencyOption } from '@/lib/types';
import { Sheet } from './Sheet';
import { ErrorBanner, Field, Loading } from './ui';

let currencyCache: CurrencyOption[] | null = null;
const fallbackCurrencies: CurrencyOption[] = [
  { code: 'ZAR', name: 'South African Rand', fraction_digits: 2 },
  { code: 'ZWG', name: 'ZiG (Zimbabwe Gold)', fraction_digits: 2 },
  { code: 'USD', name: 'US Dollar', fraction_digits: 2 },
  { code: 'BWP', name: 'Botswanan Pula', fraction_digits: 2 },
  { code: 'EUR', name: 'Euro', fraction_digits: 2 },
  { code: 'GBP', name: 'British Pound', fraction_digits: 2 },
  { code: 'JPY', name: 'Japanese Yen', fraction_digits: 0 },
  { code: 'KWD', name: 'Kuwaiti Dinar', fraction_digits: 3 },
];

export function CurrencyPicker({ value, onChange, label = 'Currency' }: {
  value: string; onChange: (currency: string) => void; label?: string;
}) {
  const [visible, setVisible] = useState(false);
  const [query, setQuery] = useState('');
  const [currencies, setCurrencies] = useState(currencyCache || []);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!visible || currencyCache) return;
    let active = true;
    setLoading(true);
    setError(null);
    api.currencies().then(({ currencies: options }) => {
      currencyCache = options;
      if (active) setCurrencies(options);
    }).catch((e) => {
      if (active) {
        setCurrencies((current) => current.length ? current : fallbackCurrencies);
        setError(e.status === 404 ? 'Currency catalog unavailable from this API. Common currencies remain available.' : e.message);
      }
    }).finally(() => {
      if (active) setLoading(false);
    });
    return () => { active = false; };
  }, [visible]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return currencies.filter((item) => !needle || `${item.code} ${item.name}`.toLowerCase().includes(needle));
  }, [currencies, query]);
  const selected = currencies.find((item) => item.code === value);

  return (
    <View style={st.container}>
      <Text style={st.label}>{label}</Text>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${value}. Choose a currency`}
        onPress={() => setVisible(true)}
        style={st.value}
      >
        <Text style={st.valueText}>{value}{selected ? ` · ${selected.name}` : ''}</Text>
        <Ionicons name="chevron-down" size={18} color={colors.muted} />
      </Pressable>
      <Sheet visible={visible} title="Choose currency" onClose={() => { setVisible(false); setQuery(''); }}>
        <Field
          label="Search currencies"
          value={query}
          onChangeText={setQuery}
          autoCapitalize="characters"
          autoCorrect={false}
          placeholder="Code or name (e.g. ZWG, ZiG, USD)"
        />
        {error ? <ErrorBanner message={error} /> : null}
        {loading && currencies.length === 0 ? <Loading /> : filtered.map((item) => (
          <Pressable
            key={item.code}
            accessibilityRole="button"
            onPress={() => { onChange(item.code); setVisible(false); setQuery(''); }}
            style={st.option}
          >
            <Text style={st.code}>{item.code}</Text>
            <Text style={st.name}>{item.name}</Text>
            {item.code === value ? <Ionicons name="checkmark" size={20} color={colors.primary} /> : null}
          </Pressable>
        ))}
        {!loading && !error && filtered.length === 0 ? <Text style={st.empty}>No matching currencies.</Text> : null}
      </Sheet>
    </View>
  );
}

const st = StyleSheet.create({
  container: { marginBottom: 14 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: '500' },
  value: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 11 },
  valueText: { flex: 1, color: colors.text, fontSize: 16 },
  option: { flexDirection: 'row', alignItems: 'center', minHeight: 44, borderBottomWidth: 1, borderBottomColor: colors.border, gap: 12 },
  code: { width: 48, color: colors.text, fontWeight: '700' },
  name: { flex: 1, color: colors.muted },
  empty: { color: colors.muted, textAlign: 'center', paddingVertical: 24 },
});
