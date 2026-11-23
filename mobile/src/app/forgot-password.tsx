import { Link } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorBanner, Field } from '@/components/ui';
import { colors, radius } from '@/constants/theme';
import { api } from '@/lib/api';
import { APP_NAME } from '@/lib/brand';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!email.trim()) return setError('Enter your account email');
    setBusy(true); setError(null); setMessage(null);
    try { setMessage((await api.forgotPassword(email)).message); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <View style={st.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <Card>
            <Text style={st.brand}>{APP_NAME}</Text>
            <Text style={st.title}>Forgot your password?</Text>
            <Text style={st.description}>Enter the email address linked to your account. If it exists, we’ll email you a secure reset link.</Text>
            {error ? <ErrorBanner message={error} /> : null}
            {message ? <Text accessibilityRole="alert" style={st.success}>{message}</Text> : null}
            <Field label="Email" value={email} onChangeText={setEmail} autoCapitalize="none" keyboardType="email-address" autoComplete="email" placeholder="you@example.com" />
            <Button title="Send reset link" onPress={submit} loading={busy} />
            <View style={st.back}><Link href="/sign-in" style={st.link}>Back to sign in</Link></View>
          </Card>
        </ScrollView>
      </KeyboardAvoidingView>
    </View>
  );
}

const st = StyleSheet.create({
  page: { flex: 1, backgroundColor: colors.bg },
  content: { flexGrow: 1, justifyContent: 'center', padding: 20, width: '100%', maxWidth: 520, alignSelf: 'center' },
  brand: { color: colors.primary, fontSize: 13, fontWeight: '700', marginBottom: 10 },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 8 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  success: { color: '#166534', backgroundColor: '#DCFCE7', borderRadius: radius.sm, padding: 12, marginBottom: 14, fontSize: 14 },
  back: { alignItems: 'center', marginTop: 16 },
  link: { color: colors.primary, fontWeight: '700' },
});
