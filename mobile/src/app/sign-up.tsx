import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, Text, View } from 'react-native';
import { Button, Card, ErrorBanner, Field, Segmented } from '@/components/ui';
import { colors } from '@/constants/theme';
import { useAuth } from '@/lib/auth';

const CURRENCIES = [
  { value: 'ZAR', label: 'ZAR' }, { value: 'USD', label: 'USD' }, { value: 'EUR', label: 'EUR' }, { value: 'GBP', label: 'GBP' },
];

export default function SignUp() {
  const { signUp } = useAuth();
  const [form, setForm] = useState({ name: '', email: '', password: '', confirm: '' });
  const [currency, setCurrency] = useState('ZAR');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof typeof form) => (v: string) => setForm((f) => ({ ...f, [k]: v }));

  async function submit() {
    if (!form.name.trim()) return setError('Please enter your name');
    if (form.password.length < 8) return setError('Password must be at least 8 characters');
    if (form.password !== form.confirm) return setError('Passwords do not match');
    setBusy(true); setError(null);
    try { await signUp(form.name, form.email, form.password, currency); } catch (e: any) { setError(e.message); } finally { setBusy(false); }
  }

  return (
    <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
      <ScrollView contentContainerStyle={{ padding: 20, maxWidth: 520, width: '100%', alignSelf: 'center' }} keyboardShouldPersistTaps="handled">
        <Text style={{ color: colors.muted, marginBottom: 16, fontSize: 15 }}>Your account comes with ready-made income and expense categories so you can start tracking straight away.</Text>
        <Card>
          {error ? <ErrorBanner message={error} /> : null}
          <Field label="Full name" value={form.name} onChangeText={set('name')} autoComplete="name" testID="name" />
          <Field label="Email" value={form.email} onChangeText={set('email')} autoCapitalize="none" keyboardType="email-address" autoComplete="email" testID="email" />
          <Field label="Password" value={form.password} onChangeText={set('password')} secureTextEntry placeholder="At least 8 characters" testID="password" />
          <Field label="Confirm password" value={form.confirm} onChangeText={set('confirm')} secureTextEntry testID="confirm" />
          <Text style={{ fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: '500' }}>Currency</Text>
          <Segmented options={CURRENCIES} value={currency} onChange={setCurrency} />
          <View style={{ height: 18 }} />
          <Button title="Create account" onPress={submit} loading={busy} testID="create-account" />
        </Card>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
