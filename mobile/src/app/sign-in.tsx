import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Button, ErrorBanner, Field, PasswordField } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { api, getApiUrl, setApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { APP_NAME, CREATOR_NAME } from '@/lib/brand';

export default function SignIn() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showServer, setShowServer] = useState(false);
  const [server, setServer] = useState('');
  const [serverStatus, setServerStatus] = useState<'unknown' | 'ok' | 'down'>('unknown');

  const checkServer = async () => {
    try { await api.health(); setServerStatus('ok'); } catch { setServerStatus('down'); }
  };
  useEffect(() => { setServer(getApiUrl()); void checkServer(); }, []);

  async function submit() {
    if (!email || !password) return setError('Enter your email and password');
    setBusy(true); setError(null);
    try { await signIn(email, password); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  async function saveServer() {
    await setApiUrl(server || null);
    setServer(getApiUrl());
    await checkServer();
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.navy }}>
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
            <View style={s.hero}>
              <Image
                source={require('../../assets/fayora-logo.png')}
                style={s.logo}
                resizeMode="contain"
                accessibilityLabel={APP_NAME}
              />
              <Text style={s.subtitle}>Track spending, stick to budgets and reach your savings goals.</Text>
            </View>
            <View style={s.card}>
              <Text style={s.heading}>Welcome back</Text>
              {error ? <ErrorBanner message={error} /> : null}
              <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" testID="email" />
              <PasswordField label="Password" value={password} onChangeText={setPassword} autoComplete="password" placeholder="••••••••" onSubmitEditing={submit} testID="password" />
              <Button title="Sign in" onPress={submit} loading={busy} testID="sign-in" />
              <View style={[s.rowCenter, { marginTop: 16 }]}>
                <Text style={{ color: colors.muted }}>New here? </Text>
                <Link href="/sign-up" style={{ color: colors.primary, fontWeight: '700' }}>Create an account</Link>
              </View>
              {__DEV__ ? (
                <Text style={s.hint}>Demo: demo@example.com / Password123! (run <Text style={{ fontFamily: Platform.select({ ios: 'Menlo', default: 'monospace' }) }}>npm run seed</Text> in the backend)</Text>
              ) : null}
            </View>

            <Pressable onPress={() => setShowServer((v) => !v)} style={[s.rowCenter, { marginTop: 18 }]}>
              <View style={[s.dot, { backgroundColor: serverStatus === 'ok' ? '#4ADE80' : serverStatus === 'down' ? '#F87171' : '#94A3B8' }]} />
              <Text style={{ color: '#CBD5E1', fontSize: 13 }}>
                {serverStatus === 'ok' ? 'Connected to server' : serverStatus === 'down' ? 'Server not reachable' : 'Checking server…'} · Server settings
              </Text>
            </Pressable>
            {showServer && (
              <View style={[s.card, { marginTop: 12 }]}>
                <Field label="API URL" value={server} onChangeText={setServer} autoCapitalize="none" autoCorrect={false} placeholder="http://192.168.1.20:4000" />
                <Text style={[s.hint, { marginTop: 0, marginBottom: 12 }]}>On a real phone use your computer’s LAN IP (shown when the backend starts). Leave empty to auto-detect.</Text>
                <Button title="Save & test connection" variant="secondary" onPress={saveServer} />
              </View>
            )}
            <Text style={s.credit}>Created by {CREATOR_NAME}</Text>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const s = StyleSheet.create({
  scroll: { padding: 20, flexGrow: 1, justifyContent: 'center', maxWidth: 520, width: '100%', alignSelf: 'center' },
  hero: { alignItems: 'center', marginBottom: 24 },
  logo: { width: 300, height: 200, marginBottom: 2 },
  subtitle: { color: '#CBD5E1', fontSize: 15, textAlign: 'center', marginTop: 6, maxWidth: 300 },
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 20 },
  heading: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
  rowCenter: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center' },
  hint: { fontSize: 12, color: colors.muted, textAlign: 'center', marginTop: 16 },
  dot: { width: 8, height: 8, borderRadius: 4, marginRight: 8 },
  credit: { color: '#CBD5E1', fontSize: 12, textAlign: 'center', marginTop: 18 },
});
