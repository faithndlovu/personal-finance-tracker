import { Link, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorBanner, PasswordField } from '@/components/ui';
import { colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { APP_NAME } from '@/lib/brand';

export default function ResetPassword() {
  const { token } = useLocalSearchParams<{ token?: string }>();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [busy, setBusy] = useState(false);

  async function submit() {
    if (!token || Array.isArray(token)) return setError('This reset link is invalid. Request a new one.');
    if (password.length < 8) return setError('Password must be at least 8 characters');
    if (password !== confirm) return setError('Passwords do not match');
    setBusy(true); setError(null);
    try { await api.resetPassword(token, password); setSuccess(true); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <View style={st.page}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
        <ScrollView contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
          <Card>
            <Text style={st.brand}>{APP_NAME}</Text>
            <Text style={st.title}>Choose a new password</Text>
            {error ? <ErrorBanner message={error} /> : null}
            {success ? (
              <>
                <Text style={st.description}>Your password has been updated. You can now sign in with it.</Text>
                <Link href="/sign-in" style={st.link}>Back to sign in</Link>
              </>
            ) : (
              <>
                <PasswordField label="New password" value={password} onChangeText={setPassword} placeholder="At least 8 characters" />
                <PasswordField label="Confirm new password" value={confirm} onChangeText={setConfirm} />
                <Button title="Reset password" onPress={submit} loading={busy} />
              </>
            )}
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
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: 18 },
  description: { color: colors.muted, fontSize: 14, lineHeight: 20, marginBottom: 20 },
  link: { color: colors.primary, fontWeight: '700', alignSelf: 'center' },
});
