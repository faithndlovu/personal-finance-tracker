import { Pressable, Text, View } from 'react-native';
import { CategoryIcon } from '@/components/ui';
import { colors } from '@/constants/theme';
import { dateLabel, money } from '@/lib/format';

type Row = { id: number; type: 'income' | 'expense'; amount: number; description: string; date: string; category_name: string; category_icon: string; category_color: string };

export function TransactionRow({ t, currency, onPress, showDate = true }: { t: Row; currency: string; onPress?: () => void; showDate?: boolean }) {
  return (
    <Pressable onPress={onPress} testID={`tx-${t.id}`} style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', paddingVertical: 11, opacity: pressed ? 0.6 : 1 })}>
      <CategoryIcon icon={t.category_icon} color={t.category_color} />
      <View style={{ flex: 1, marginLeft: 12 }}>
        <Text style={{ fontSize: 15, fontWeight: '600', color: colors.text }} numberOfLines={1}>{t.description || t.category_name}</Text>
        <Text style={{ fontSize: 13, color: colors.muted, marginTop: 2 }} numberOfLines={1}>
          {t.description ? t.category_name : ''}{t.description && showDate ? ' · ' : ''}{showDate ? dateLabel(t.date) : ''}
        </Text>
      </View>
      <Text style={{ fontSize: 15, fontWeight: '700', color: t.type === 'income' ? colors.income : colors.text }}>
        {money(t.type === 'income' ? t.amount : -t.amount, currency, { sign: true })}
      </Text>
    </Pressable>
  );
}
