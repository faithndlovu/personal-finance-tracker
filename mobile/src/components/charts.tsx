import { Text, View } from 'react-native';
import Svg, { Circle, G, Rect, Text as SvgText } from 'react-native-svg';
import { colors } from '@/constants/theme';
import { money, monthLabel } from '@/lib/format';

/** Donut chart of spending by category. */
export function DonutChart({ data, total, currency, size = 180 }: {
  data: { name: string; color: string; total: number }[]; total: number; currency: string; size?: number;
}) {
  const stroke = 26;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size}>
        <G rotation={-90} origin={`${size / 2}, ${size / 2}`}>
          <Circle cx={size / 2} cy={size / 2} r={r} stroke="#E8EDF5" strokeWidth={stroke} fill="none" />
          {total > 0 && data.map((d) => {
            const len = (d.total / total) * c;
            const el = (
              <Circle key={d.name} cx={size / 2} cy={size / 2} r={r} stroke={d.color} strokeWidth={stroke} fill="none"
                strokeDasharray={`${Math.max(len - 2, 0.1)} ${c}`} strokeDashoffset={-offset} />
            );
            offset += len;
            return el;
          })}
        </G>
      </Svg>
      <View style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontSize: 12, color: colors.muted }}>Spent</Text>
        <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{money(total, currency, { compact: true })}</Text>
      </View>
    </View>
  );
}

/** Grouped bar chart of income vs expenses for recent months. */
export function TrendChart({ data, width, height = 170 }: { data: { month: string; income: number; expense: number }[]; width: number; height?: number }) {
  const max = Math.max(1, ...data.flatMap((d) => [d.income, d.expense]));
  const chartH = height - 22;
  const group = width / data.length;
  const bar = Math.min(14, group / 3.2);
  return (
    <Svg width={width} height={height}>
      {[0.25, 0.5, 0.75, 1].map((p) => (
        <Rect key={p} x={0} y={chartH - chartH * p} width={width} height={1} fill="#EEF2F7" />
      ))}
      {data.map((d, i) => {
        const x = i * group + group / 2;
        const ih = (d.income / max) * (chartH - 6);
        const eh = (d.expense / max) * (chartH - 6);
        return (
          <G key={d.month}>
            <Rect x={x - bar - 2} y={chartH - ih} width={bar} height={ih} rx={4} fill={colors.income} />
            <Rect x={x + 2} y={chartH - eh} width={bar} height={eh} rx={4} fill={colors.expense} />
            <SvgText x={x} y={height - 4} fontSize={11} fill={colors.muted} textAnchor="middle">{monthLabel(d.month, false)}</SvgText>
          </G>
        );
      })}
    </Svg>
  );
}
