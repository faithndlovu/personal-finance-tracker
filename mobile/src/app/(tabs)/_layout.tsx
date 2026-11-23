import Ionicons from '@expo/vector-icons/Ionicons';
import type { ColorValue } from 'react-native';
import { Tabs } from 'expo-router/tabs';
import { colors } from '@/constants/theme';
import type { IconName } from '@/components/ui';

const tabIcon = (name: IconName) => ({ color, size }: { color: ColorValue; size: number }) => <Ionicons name={name} color={color as string} size={size} />;

export default function TabLayout() {
  return (
    <Tabs screenOptions={{
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: '#94A3B8',
      headerStyle: { backgroundColor: colors.bg },
      headerShadowVisible: false,
      headerTitleStyle: { fontWeight: '800', fontSize: 20, color: colors.text },
      sceneStyle: { backgroundColor: colors.bg },
    }}>
      <Tabs.Screen name="index" options={{ title: 'Overview', tabBarIcon: tabIcon('pie-chart') }} />
      <Tabs.Screen name="transactions" options={{ title: 'Transactions', tabBarIcon: tabIcon('swap-vertical') }} />
      <Tabs.Screen name="budgets" options={{ title: 'Budgets', tabBarIcon: tabIcon('speedometer') }} />
      <Tabs.Screen name="goals" options={{ title: 'Goals', tabBarIcon: tabIcon('trophy') }} />
      <Tabs.Screen name="settings" options={{ title: 'Settings', tabBarIcon: tabIcon('settings') }} />
    </Tabs>
  );
}
