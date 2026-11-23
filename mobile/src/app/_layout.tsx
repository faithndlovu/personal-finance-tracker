import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { colors } from '@/constants/theme';
import { AuthProvider, useAuth } from '@/lib/auth';

function RootNavigator() {
  const { user, loading } = useAuth();
  if (loading) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.navy }}>
        <ActivityIndicator size="large" color="#fff" />
      </View>
    );
  }
  const signedIn = !!user;
  return (
    <Stack screenOptions={{ headerTintColor: colors.text, contentStyle: { backgroundColor: colors.bg }, headerTitleStyle: { fontWeight: '700' } }}>
      <Stack.Protected guard={signedIn} redirectTo="/sign-in">
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="transaction" options={{ presentation: 'modal', title: 'Transaction', headerTransparent: false }} />
        <Stack.Screen name="goal" options={{ presentation: 'modal', title: 'Savings goal', headerTransparent: false }} />
        <Stack.Screen name="categories" options={{ title: 'Categories', headerTransparent: false }} />
      </Stack.Protected>
      <Stack.Protected guard={!signedIn} redirectTo="/">
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
        <Stack.Screen name="sign-up" options={{ title: 'Create account', headerTransparent: false }} />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <StatusBar style="dark" />
        <RootNavigator />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
