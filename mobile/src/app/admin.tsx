import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Button, Card, ErrorBanner, Loading, SectionTitle } from '@/components/ui';
import { colors } from '@/constants/theme';
import { api } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { confirm, useFocusData } from '@/lib/hooks';
import type { AdminUser } from '@/lib/types';

export default function Admin() {
  const { user: currentUser } = useAuth();
  const { data, error, loading, reload } = useFocusData(() => api.adminUsers());
  const [actionError, setActionError] = useState<string | null>(null);
  const [busy, setBusy] = useState<number | null>(null);

  async function changeRole(account: AdminUser) {
    const nextRole = account.role === 'admin' ? 'user' : 'admin';
    if (!(await confirm(`${nextRole === 'admin' ? 'Make' : 'Remove'} admin role?`, `${account.name} will ${nextRole === 'admin' ? 'gain' : 'lose'} account-management access.`))) return;
    setBusy(account.id); setActionError(null);
    try { await api.setAdminRole(account.id, nextRole); await reload(); } catch (e: any) { setActionError(e.message); } finally { setBusy(null); }
  }

  async function remove(account: AdminUser) {
    if (!(await confirm(`Delete ${account.name}?`, 'This permanently deletes the account and all financial records owned by it.', 'Delete account'))) return;
    setBusy(account.id); setActionError(null);
    try { await api.deleteUser(account.id); await reload(); } catch (e: any) { setActionError(e.message); } finally { setBusy(null); }
  }

  return (
    <ScrollView contentContainerStyle={st.content}>
      <SectionTitle>Account management</SectionTitle>
      {actionError ? <ErrorBanner message={actionError} /> : null}
      {error ? <ErrorBanner message={error} onRetry={() => reload()} /> : null}
      {loading && !data ? <Loading /> : (
        <Card style={{ paddingVertical: 4 }}>
          {(data?.users || []).map((account, index) => (
            <View key={account.id} style={[st.row, index > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}>
              <View style={st.avatar}><Ionicons name={account.role === 'admin' ? 'shield-checkmark' : 'person'} size={20} color={colors.primary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={st.name}>{account.name}</Text>
                <Text style={st.detail}>{account.email}</Text>
                <Text style={st.detail}>{account.role} · {account.transaction_count} transactions · {account.budget_count} budgets · {account.goal_count} goals</Text>
              </View>
              {account.id !== currentUser?.id ? (
                <View style={st.actions}>
                  <Pressable onPress={() => void changeRole(account)} style={st.action} accessibilityLabel={`Change role for ${account.name}`}>
                    <Ionicons name="swap-horizontal" size={20} color={colors.primary} />
                  </Pressable>
                  <Pressable onPress={() => void remove(account)} style={st.action} accessibilityLabel={`Delete ${account.name}`}>
                    <Ionicons name="trash-outline" size={20} color={colors.expense} />
                  </Pressable>
                </View>
              ) : <Text style={st.you}>You</Text>}
            </View>
          ))}
        </Card>
      )}
      <View style={{ marginTop: 16 }}>
        <Button title="Refresh accounts" variant="secondary" onPress={() => void reload()} loading={loading} />
      </View>
    </ScrollView>
  );
}

const st = StyleSheet.create({
  content: { padding: 20, paddingBottom: 60, maxWidth: 640, width: '100%', alignSelf: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12 },
  avatar: { width: 38, height: 38, borderRadius: 19, backgroundColor: '#E8EDF5', alignItems: 'center', justifyContent: 'center' },
  name: { color: colors.text, fontWeight: '700', fontSize: 15 },
  detail: { color: colors.muted, fontSize: 12, marginTop: 2 },
  actions: { flexDirection: 'row', gap: 4 },
  action: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  you: { color: colors.primary, fontWeight: '700', fontSize: 12 },
});
