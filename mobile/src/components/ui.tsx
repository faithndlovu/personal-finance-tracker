import Ionicons from '@expo/vector-icons/Ionicons';
import type { ComponentProps, ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View, type TextInputProps, type ViewStyle, type StyleProp } from 'react-native';
import { colors, radius } from '@/constants/theme';
import { monthLabel, shiftMonth, currentMonth } from '@/lib/format';

export type IconName = ComponentProps<typeof Ionicons>['name'];

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

export function Button({ title, onPress, variant = 'primary', loading, disabled, icon, small, testID }: {
  title: string; onPress: () => void; variant?: 'primary' | 'secondary' | 'danger' | 'ghost'; loading?: boolean; disabled?: boolean; icon?: IconName; small?: boolean; testID?: string;
}) {
  const v = buttonVariants[variant];
  return (
    <Pressable testID={testID} accessibilityRole="button" onPress={onPress} disabled={disabled || loading}
      style={({ pressed }) => [styles.button, small && styles.buttonSmall, { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}>
      {loading ? <ActivityIndicator color={v.fg} /> : (
        <View style={styles.row}>
          {icon && <Ionicons name={icon} size={small ? 16 : 18} color={v.fg} style={{ marginRight: 6 }} />}
          <Text style={[styles.buttonText, small && { fontSize: 14 }, { color: v.fg }]}>{title}</Text>
        </View>
      )}
    </Pressable>
  );
}
const buttonVariants = {
  primary: { bg: colors.primary, border: colors.primary, fg: '#fff' },
  secondary: { bg: colors.surface, border: colors.border, fg: colors.text },
  danger: { bg: colors.surface, border: '#FECACA', fg: colors.expense },
  ghost: { bg: 'transparent', border: 'transparent', fg: colors.primary },
};

export function Field({ label, error, ...props }: TextInputProps & { label: string; error?: string }) {
  return (
    <View style={{ marginBottom: 14 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput placeholderTextColor="#94A3B8" {...props} style={[styles.input, props.multiline && { minHeight: 70, textAlignVertical: 'top' }, props.style]} />
      {error ? <Text style={styles.fieldError}>{error}</Text> : null}
    </View>
  );
}

export function ProgressBar({ percent, color = colors.primary, height = 8 }: { percent: number; color?: string; height?: number }) {
  return (
    <View style={[styles.track, { height }]}>
      <View style={{ width: `${Math.max(0, Math.min(100, percent))}%`, height, backgroundColor: color, borderRadius: height }} />
    </View>
  );
}

export function CategoryIcon({ icon, color, size = 40 }: { icon: string; color: string; size?: number }) {
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: `${color}22`, alignItems: 'center', justifyContent: 'center' }}>
      <Ionicons name={icon as IconName} size={size * 0.5} color={color} />
    </View>
  );
}

export function EmptyState({ icon, title, text, action }: { icon: IconName; title: string; text?: string; action?: ReactNode }) {
  return (
    <View style={styles.empty}>
      <Ionicons name={icon} size={44} color="#CBD5E1" />
      <Text style={styles.emptyTitle}>{title}</Text>
      {text ? <Text style={styles.emptyText}>{text}</Text> : null}
      {action ? <View style={{ marginTop: 14 }}>{action}</View> : null}
    </View>
  );
}

export function ErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.errorBanner}>
      <Ionicons name="cloud-offline-outline" size={20} color={colors.expense} />
      <Text style={styles.errorText}>{message}</Text>
      {onRetry ? <Pressable onPress={onRetry}><Text style={{ color: colors.primary, fontWeight: '700' }}>Retry</Text></Pressable> : null}
    </View>
  );
}

export function Loading() {
  return <View style={{ padding: 40, alignItems: 'center' }}><ActivityIndicator size="large" color={colors.primary} /></View>;
}

export function MonthSwitcher({ month, onChange }: { month: string; onChange: (m: string) => void }) {
  const isCurrent = month >= currentMonth();
  return (
    <View style={styles.monthSwitcher}>
      <Pressable accessibilityLabel="Previous month" onPress={() => onChange(shiftMonth(month, -1))} hitSlop={10} style={styles.monthBtn}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
      </Pressable>
      <Text style={styles.monthText}>{monthLabel(month)}</Text>
      <Pressable accessibilityLabel="Next month" onPress={() => !isCurrent && onChange(shiftMonth(month, 1))} hitSlop={10} style={[styles.monthBtn, isCurrent && { opacity: 0.3 }]}>
        <Ionicons name="chevron-forward" size={20} color={colors.text} />
      </Pressable>
    </View>
  );
}

export function Segmented<T extends string>({ options, value, onChange }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void }) {
  return (
    <View style={styles.segmented}>
      {options.map((o) => (
        <Pressable key={o.value} onPress={() => onChange(o.value)} style={[styles.segment, value === o.value && styles.segmentActive]}>
          <Text style={[styles.segmentText, value === o.value && { color: colors.text }]}>{o.label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

export function SectionTitle({ children, right }: { children: ReactNode; right?: ReactNode }) {
  return (
    <View style={[styles.row, { justifyContent: 'space-between', marginTop: 22, marginBottom: 10 }]}>
      <Text style={styles.sectionTitle}>{children}</Text>
      {right}
    </View>
  );
}

export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: 16, borderWidth: 1, borderColor: colors.border },
  button: { borderRadius: radius.md, paddingVertical: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  buttonSmall: { paddingVertical: 7, paddingHorizontal: 12, borderRadius: radius.sm },
  buttonText: { fontSize: 16, fontWeight: '600' },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: '500' },
  input: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, paddingHorizontal: 12, paddingVertical: 11, fontSize: 16, color: colors.text },
  fieldError: { color: colors.expense, fontSize: 12, marginTop: 4 },
  track: { backgroundColor: '#E8EDF5', borderRadius: 99, overflow: 'hidden', width: '100%' },
  empty: { alignItems: 'center', paddingVertical: 40, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 17, fontWeight: '600', color: colors.text, marginTop: 10 },
  emptyText: { fontSize: 14, color: colors.muted, textAlign: 'center', marginTop: 4 },
  errorBanner: { flexDirection: 'row', gap: 10, alignItems: 'center', backgroundColor: colors.expenseSoft, padding: 12, borderRadius: radius.sm, marginBottom: 12 },
  errorText: { color: '#991B1B', flex: 1, fontSize: 14 },
  monthSwitcher: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, borderRadius: radius.pill, padding: 4, borderWidth: 1, borderColor: colors.border },
  monthBtn: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center' },
  monthText: { fontSize: 15, fontWeight: '600', color: colors.text },
  segmented: { flexDirection: 'row', backgroundColor: '#E8EDF5', borderRadius: radius.sm, padding: 3 },
  segment: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: 6 },
  segmentActive: { backgroundColor: colors.surface },
  segmentText: { fontWeight: '600', color: colors.muted, fontSize: 14 },
  sectionTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
});
