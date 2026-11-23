import Ionicons from '@expo/vector-icons/Ionicons';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { CurrencyPicker } from '@/components/CurrencyPicker';
import { Button, Card, ErrorBanner, Field, SectionTitle } from '@/components/ui';
import { colors } from '@/constants/theme';
import { api, getApiUrl } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm, notify } from '@/lib/hooks';
import { CREATOR_NAME } from '@/lib/brand';

export default function Settings() {
  const router = useRouter();
  const { user, setUser, signOut } = useAuth();
  const [name, setName] = useState(user?.name || '');
  const [currency, setCurrency] = useState(user?.currency || 'ZAR');
  const [pw, setPw] = useState({ current: '', next: '' });
  const [delPw, setDelPw] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  async function saveProfile() {
    setBusy('profile'); setError(null);
    try { const r = await api.updateMe({ name, currency }); setUser(r.user); notify('Profile saved'); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }
  async function changePassword() {
    if (pw.next.length < 8) return setError('New password must be at least 8 characters');
    setBusy('pw'); setError(null);
    try { await api.updateMe({ current_password: pw.current, new_password: pw.next }); setPw({ current: '', next: '' }); notify('Password changed'); } catch (e: any) { setError(e.message); } finally { setBusy(null); }
  }
  async function deleteAccount() {
    if (!delPw) return setError('Enter your password to delete your account');
    if (!(await confirm('Delete account?', 'All your transactions, budgets and goals will be permanently deleted.', 'Delete everything'))) return;
    setBusy('delete');
    try { await api.deleteAccount(delPw); await signOut(); } catch (e: any) { setError(e.message); setBusy(null); }
  }

  return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" contentContainerStyle={st.content} keyboardShouldPersistTaps="handled">
      <Card style={st.profile}>
        <View style={st.avatar}><Text style={st.avatarText}>{user?.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase()}</Text></View>
        <View style={{ flex: 1 }}>
          <Text style={{ fontSize: 17, fontWeight: '700', color: colors.text }}>{user?.name}</Text>
          <Text style={{ color: colors.muted }}>{user?.email}</Text>
        </View>
      </Card>
      {error ? <View style={{ marginTop: 12 }}><ErrorBanner message={error} /></View> : null}

      <SectionTitle>Profile</SectionTitle>
      <Card>
        <Field label="Name" value={name} onChangeText={setName} />
        <CurrencyPicker value={currency} onChange={setCurrency} label="Default currency for new entries" />
        <View style={{ height: 16 }} />
        <Button title="Save profile" onPress={saveProfile} loading={busy === 'profile'} />
      </Card>

      <SectionTitle>Data</SectionTitle>
      {user?.role === 'admin' ? (
        <Pressable onPress={() => router.push('/admin')}>
          <Card style={st.link}>
            <Ionicons name="shield-checkmark-outline" size={22} color={colors.primary} />
            <Text style={st.linkText}>Admin: manage accounts</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.muted} />
          </Card>
        </Pressable>
      ) : null}
      <Pressable onPress={() => router.push('/categories')}>
        <Card style={st.link}>
          <Ionicons name="pricetags-outline" size={22} color={colors.primary} />
          <Text style={st.linkText}>Manage categories</Text>
          <Ionicons name="chevron-forward" size={20} color={colors.muted} />
        </Card>
      </Pressable>

      <SectionTitle>Security</SectionTitle>
      <Card>
        <Field label="Current password" value={pw.current} onChangeText={(v) => setPw((p) => ({ ...p, current: v }))} secureTextEntry />
        <Field label="New password" value={pw.next} onChangeText={(v) => setPw((p) => ({ ...p, next: v }))} secureTextEntry placeholder="At least 8 characters" />
        <Button title="Change password" variant="secondary" onPress={changePassword} loading={busy === 'pw'} />
      </Card>

      <View style={{ marginTop: 22 }}><Button title="Sign out" variant="secondary" icon="log-out-outline" onPress={signOut} testID="sign-out" /></View>

      <SectionTitle>Danger zone</SectionTitle>
      <Card>
        <Field label="Confirm with your password" value={delPw} onChangeText={setDelPw} secureTextEntry />
        <Button title="Delete my account" variant="danger" onPress={deleteAccount} loading={busy === 'delete'} />
      </Card>
      <Text style={st.footer}>Created by {CREATOR_NAME}</Text>
      <Text style={st.footer}>Connected to {getApiUrl()}</Text>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { padding: 20, paddingBottom: 60, maxWidth: 1100, width: '100%', alignSelf: 'center' },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  avatar: { width: 52, height: 52, borderRadius: 26, backgroundColor: colors.navy, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FACC15', fontWeight: '800', fontSize: 18 },
  label: { fontSize: 13, color: colors.muted, marginBottom: 6, fontWeight: '500' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  linkText: { flex: 1, fontSize: 16, color: colors.text, fontWeight: '500' },
  footer: { textAlign: 'center', color: colors.muted, fontSize: 12, marginTop: 24 },
});
