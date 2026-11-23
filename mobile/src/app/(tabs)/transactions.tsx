import Ionicons from '@expo/vector-icons/Ionicons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, RefreshControl, SectionList, StyleSheet, Text, TextInput, View } from 'react-native';
import { TransactionRow } from '@/components/TransactionRow';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { Button, EmptyState, ErrorBanner, Loading, MonthSwitcher, Segmented } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { currentMonth, dateLabel, money } from '@/lib/format';
import { useFocusData } from '@/lib/hooks';

type Filter = 'all' | 'income' | 'expense';

export default function Transactions() {
  const router = useRouter();
  const params = useLocalSearchParams<{ currency?: string }>();
  const { user } = useAuth();
  const [currency, setCurrency] = useState(params.currency || user?.currency || 'ZAR');
  const [month, setMonth] = useState(currentMonth());
  const [filter, setFilter] = useState<Filter>('all');
  const [query, setQuery] = useState('');
  const [debounced, setDebounced] = useState('');
  const [timer, setTimer] = useState<ReturnType<typeof setTimeout> | null>(null);
  const { data, error, loading, refreshing, refresh, reload } = useFocusData(
    () => api.transactions({ month, currency, type: filter === 'all' ? undefined : filter, q: debounced || undefined }),
    [month, currency, filter, debounced],
  );

  const onSearch = (text: string) => {
    setQuery(text);
    if (timer) clearTimeout(timer);
    setTimer(setTimeout(() => setDebounced(text), 350));
  };

  const sections = useMemo(() => {
    const groups = new Map<string, NonNullable<typeof data>['transactions']>();
    for (const t of data?.transactions || []) {
      if (!groups.has(t.date)) groups.set(t.date, []);
      groups.get(t.date)!.push(t);
    }
    return [...groups.entries()].map(([date, items]) => ({
      title: date,
      net: items.reduce((a, t) => a + (t.type === 'income' ? t.amount : -t.amount), 0),
      data: items,
    }));
  }, [data]);

  return (
    <View style={{ flex: 1 }}>
      <SectionList
        contentInsetAdjustmentBehavior="automatic"
        sections={sections}
        keyExtractor={(t) => String(t.id)}
        stickySectionHeadersEnabled={false}
        contentContainerStyle={st.content}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} />}
        ListHeaderComponent={
          <View>
            <CurrencyPicker value={currency} onChange={setCurrency} />
            <MonthSwitcher month={month} onChange={setMonth} />
            <View style={st.search}>
              <Ionicons name="search" size={18} color={colors.muted} />
              <TextInput value={query} onChangeText={onSearch} placeholder="Search description or category" placeholderTextColor="#94A3B8" style={st.searchInput} testID="search" />
              {query ? <Pressable onPress={() => onSearch('')}><Ionicons name="close-circle" size={18} color={colors.muted} /></Pressable> : null}
            </View>
            <Segmented<Filter> value={filter} onChange={setFilter} options={[{ value: 'all', label: 'All' }, { value: 'income', label: 'Income' }, { value: 'expense', label: 'Expenses' }]} />
            {data && (
              <View style={st.totals}>
                <View style={st.total}><Text style={st.totalLabel}>Income</Text><Text style={[st.totalValue, { color: colors.income }]}>{money(data.totals.income, currency)}</Text></View>
                <View style={st.total}><Text style={st.totalLabel}>Expenses</Text><Text style={[st.totalValue, { color: colors.expense }]}>{money(data.totals.expense, currency)}</Text></View>
                <View style={st.total}><Text style={st.totalLabel}>Net</Text><Text style={st.totalValue}>{money(data.totals.net, currency, { sign: true })}</Text></View>
              </View>
            )}
            {error ? <ErrorBanner message={error} onRetry={() => reload()} /> : null}
            {loading && !data ? <Loading /> : null}
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={st.sectionHeader}>
            <Text style={st.sectionTitle}>{dateLabel(section.title)}</Text>
            <Text style={st.sectionNet}>{money(section.net, currency, { sign: true })}</Text>
          </View>
        )}
        renderItem={({ item, index, section }) => (
          <View style={[st.item, index === 0 && st.first, index === section.data.length - 1 && st.last]}>
            <TransactionRow t={item} showDate={false} onPress={() => router.push({ pathname: '/transaction', params: { id: String(item.id) } })} />
          </View>
        )}
        ListEmptyComponent={!loading && !error ? (
          <EmptyState icon="receipt-outline" title={debounced ? 'No matches' : 'No transactions this month'}
            text={debounced ? 'Try a different search.' : 'Record income and expenses to see them here.'}
            action={!debounced ? <Button title="Add transaction" icon="add" onPress={() => router.push('/transaction')} /> : undefined} />
        ) : undefined}
      />
      <Pressable accessibilityLabel="Add transaction" style={st.fab} onPress={() => router.push('/transaction')}>
        <Ionicons name="add" size={30} color="#fff" />
      </Pressable>
    </View>
  );
}

const st = StyleSheet.create({
  content: { padding: 20, paddingBottom: 100, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  search: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.surface, borderRadius: radius.sm, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 12, marginVertical: 12 },
  searchInput: { flex: 1, paddingVertical: 10, fontSize: 15, color: colors.text },
  totals: { flexDirection: 'row', gap: 8, marginTop: 12 },
  total: { flex: 1, backgroundColor: colors.surface, borderRadius: radius.sm, padding: 10, borderWidth: 1, borderColor: colors.border },
  totalLabel: { fontSize: 12, color: colors.muted },
  totalValue: { fontSize: 14, fontWeight: '700', color: colors.text, marginTop: 2 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 18, marginBottom: 6 },
  sectionTitle: { fontWeight: '700', color: colors.muted, fontSize: 13, textTransform: 'uppercase' },
  sectionNet: { color: colors.muted, fontSize: 13 },
  item: { backgroundColor: colors.surface, paddingHorizontal: 14, borderLeftWidth: 1, borderRightWidth: 1, borderColor: colors.border },
  first: { borderTopWidth: 1, borderTopLeftRadius: radius.md, borderTopRightRadius: radius.md },
  last: { borderBottomWidth: 1, borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md },
  fab: { position: 'absolute', right: 20, bottom: 20, width: 58, height: 58, borderRadius: 29, backgroundColor: colors.primary, alignItems: 'center', justifyContent: 'center', elevation: 6, shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, shadowOffset: { width: 0, height: 4 } },
});
