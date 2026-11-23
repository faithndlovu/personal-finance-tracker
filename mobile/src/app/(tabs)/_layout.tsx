import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';
import { Platform, useWindowDimensions } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { colors } from '@/constants/theme';
import type { IconName } from '@/components/ui';

const tabIcon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabLayout() {
  const { width } = useWindowDimensions();
  const desktop = Platform.OS === 'web' && width >= 900;
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: '#94A3B8',
      headerStyle: { backgroundColor: colors.bg },
      headerShadowVisible: false,
      headerTitleStyle: { fontWeight: '800', fontSize: 20, color: colors.text },
      sceneStyle: { backgroundColor: colors.bg },
      tabBarPosition: desktop ? 'left' : 'bottom',
      tabBarLabelPosition: desktop ? 'beside-icon' : 'below-icon',
      tabBarStyle: desktop
        ? { width: 220, borderRightWidth: 1, borderRightColor: '#E2E8F0', paddingTop: 16 }
        : undefined,
      tabBarItemStyle: desktop ? { height: 64, flexDirection: 'row' } : undefined,
    }}>
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: tabIcon('pie-chart') }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions', tabBarIcon: tabIcon('swap-vertical') }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets', tabBarIcon: tabIcon('speedometer') }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals', tabBarIcon: tabIcon('trophy') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings') }} />
    </Tabs>
  );
}
