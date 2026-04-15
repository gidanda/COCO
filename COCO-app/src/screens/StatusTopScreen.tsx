import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import * as Location from 'expo-location';
import MapScreen from './MapScreen';
import SettingsScreen from './SettingsScreen';
import { authApi, groupApi, statusApi } from '../services/api';
import { GroupWithMembers, StatusGroup, StatusMe, User } from '../types';

type TabParamList = {
  Status: undefined;
  Map: { groupId?: string } | undefined;
  Settings: undefined;
};

const Tab = createBottomTabNavigator<TabParamList>();

const formatDateTime = (value: string): string => {
  if (!value) return '未更新';
  return new Date(value).toLocaleString('ja-JP');
};

function StatusScreen({ navigation }: { navigation: any }) {
  const [me, setMe] = useState<User | null>(null);
  const [groups, setGroups] = useState<StatusGroup[]>([]);
  const [myStatuses, setMyStatuses] = useState<StatusMe[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<GroupWithMembers | null>(null);
  const [loading, setLoading] = useState(false);
  const [updating, setUpdating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [user, statusGroups, selfStatuses] = await Promise.all([
        authApi.getMe(),
        statusApi.getGroups(),
        statusApi.getMe()
      ]);
      setMe(user);
      setGroups(statusGroups);
      setMyStatuses(selfStatuses);
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : '状態の取得に失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const openGroup = async (groupId: string) => {
    try {
      setSelectedGroup(await groupApi.getDetail(groupId));
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'グループ詳細の取得に失敗しました');
    }
  };

  const updateStatus = async () => {
    setUpdating(true);
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('エラー', '位置情報の利用が許可されていません');
        return;
      }

      const current = await Location.getCurrentPositionAsync({});
      await statusApi.update(current.coords.latitude, current.coords.longitude);
      await load();
      if (selectedGroup) {
        setSelectedGroup(await groupApi.getDetail(selectedGroup.id));
      }
      Alert.alert('更新完了', '現在地をもとに状態を更新しました');
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : '状態更新に失敗しました');
    } finally {
      setUpdating(false);
    }
  };

  const renderGroup = ({ item }: { item: StatusGroup }) => (
    <TouchableOpacity style={styles.row} onPress={() => openGroup(item.groupId)}>
      <View style={styles.avatar}>
        <Text style={styles.avatarText}>{item.groupName.slice(0, 1)}</Text>
      </View>
      <View style={styles.rowText}>
        <Text style={styles.rowTitle}>{item.groupName}</Text>
        <Text style={styles.rowSubtitle}>{item.hasOtherUsersInsideArea ? 'エリア内にメンバーがいます' : 'エリア内のメンバーはいません'}</Text>
      </View>
      <Text style={[styles.badge, item.hasOtherUsersInsideArea ? styles.badgeActive : styles.badgeMuted]}>
        {item.hasOtherUsersInsideArea ? 'いる' : 'いない'}
      </Text>
    </TouchableOpacity>
  );

  return (
    <View style={styles.container}>
      <FlatList
        data={groups}
        keyExtractor={item => item.groupId}
        renderItem={renderGroup}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={
          <View>
            <TouchableOpacity style={styles.profile} onPress={load}>
              <View style={styles.profileAvatar}>
                <Text style={styles.profileAvatarText}>{me?.displayName?.slice(0, 1) || '?'}</Text>
              </View>
              <View>
                <Text style={styles.profileName}>{me?.displayName || 'ユーザー'}</Text>
                <Text style={styles.profileSub}>自分の状態を確認</Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity style={[styles.primaryButton, updating && styles.disabledButton]} onPress={updateStatus} disabled={updating}>
              <Text style={styles.primaryButtonText}>{updating ? '更新中...' : '現在地で状態更新'}</Text>
            </TouchableOpacity>

            <Text style={styles.sectionTitle}>自分</Text>
            {myStatuses.length === 0 ? (
              <Text style={styles.emptyText}>所属グループがありません</Text>
            ) : (
              myStatuses.map(status => (
                <TouchableOpacity key={status.groupId} style={styles.compactRow} onPress={() => openGroup(status.groupId)}>
                  <Text style={styles.compactTitle}>{status.groupName}</Text>
                  <Text style={status.isInsideAnyArea ? styles.statusInside : styles.statusOutside}>
                    {status.isInsideAnyArea ? 'エリア内' : 'エリア外'}
                  </Text>
                </TouchableOpacity>
              ))
            )}

            <Text style={styles.sectionTitle}>グループ</Text>
          </View>
        }
        ListEmptyComponent={!loading ? <Text style={styles.emptyText}>表示できるグループがありません</Text> : null}
      />

      <Modal visible={Boolean(selectedGroup)} animationType="slide" onRequestClose={() => setSelectedGroup(null)}>
        <ScrollView style={styles.modalContainer}>
          {selectedGroup && (
            <>
              <Text style={styles.modalTitle}>{selectedGroup.name}</Text>
              <Text style={styles.modalSub}>招待URL: {selectedGroup.inviteLink?.url || '未発行'}</Text>

              <TouchableOpacity style={styles.secondaryButton} onPress={() => navigation.navigate('Map', { groupId: selectedGroup.id })}>
                <Text style={styles.secondaryButtonText}>地図で見る</Text>
              </TouchableOpacity>

              <TouchableOpacity style={styles.primaryButton} onPress={updateStatus}>
                <Text style={styles.primaryButtonText}>状態更新</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>メンバー</Text>
              {selectedGroup.members.map(member => (
                <View key={member.userId} style={styles.memberRow}>
                  <View style={styles.avatar}>
                    <Text style={styles.avatarText}>{member.displayName.slice(0, 1)}</Text>
                  </View>
                  <View style={styles.rowText}>
                    <Text style={styles.rowTitle}>{member.displayName}{member.isMe ? '（自分）' : ''}</Text>
                    <Text style={styles.rowSubtitle}>
                      {member.displayArea.type === 'area' ? member.displayArea.areaName : 'エリア外'}
                    </Text>
                    <Text style={styles.metaText}>{formatDateTime(member.recordedAt)}</Text>
                  </View>
                </View>
              ))}

              <TouchableOpacity style={styles.closeButton} onPress={() => setSelectedGroup(null)}>
                <Text style={styles.closeButtonText}>閉じる</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

export default function StatusTopScreen() {
  return (
    <Tab.Navigator>
      <Tab.Screen name="Status" component={StatusScreen} options={{ title: '状態' }} />
      <Tab.Screen name="Map" component={MapScreen} options={{ title: '地図' }} />
      <Tab.Screen name="Settings" component={SettingsScreen} options={{ title: '設定' }} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F4',
  },
  profile: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 20,
    gap: 14,
    backgroundColor: '#FFFFFF',
  },
  profileAvatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F6F73',
  },
  profileAvatarText: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '700',
  },
  profileName: {
    fontSize: 22,
    fontWeight: '700',
    color: '#202124',
  },
  profileSub: {
    marginTop: 4,
    color: '#6B6F73',
  },
  sectionTitle: {
    marginTop: 22,
    marginBottom: 10,
    paddingHorizontal: 20,
    fontSize: 18,
    fontWeight: '700',
    color: '#202124',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 14,
    marginBottom: 10,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  compactRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: 14,
    marginBottom: 8,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DADCE0',
  },
  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#5B7C99',
  },
  avatarText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  rowText: {
    flex: 1,
    marginLeft: 12,
  },
  rowTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202124',
  },
  compactTitle: {
    fontSize: 16,
    color: '#202124',
  },
  rowSubtitle: {
    marginTop: 4,
    color: '#5F6368',
  },
  metaText: {
    marginTop: 4,
    fontSize: 12,
    color: '#7A7F85',
  },
  badge: {
    overflow: 'hidden',
    minWidth: 54,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    textAlign: 'center',
    fontWeight: '700',
  },
  badgeActive: {
    color: '#0B3D2E',
    backgroundColor: '#BFE7D4',
  },
  badgeMuted: {
    color: '#53575C',
    backgroundColor: '#E6E7E8',
  },
  statusInside: {
    color: '#1C7C54',
    fontWeight: '700',
  },
  statusOutside: {
    color: '#6B6F73',
    fontWeight: '700',
  },
  emptyText: {
    marginHorizontal: 20,
    marginVertical: 12,
    color: '#6B6F73',
  },
  primaryButton: {
    marginHorizontal: 20,
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#2F6F73',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  },
  secondaryButton: {
    marginTop: 16,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#2F6F73',
  },
  secondaryButtonText: {
    color: '#2F6F73',
    fontWeight: '700',
  },
  disabledButton: {
    backgroundColor: '#AEB4B7',
  },
  modalContainer: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F7F7F4',
  },
  modalTitle: {
    marginTop: 32,
    fontSize: 28,
    fontWeight: '800',
    color: '#202124',
  },
  modalSub: {
    marginTop: 8,
    color: '#5F6368',
  },
  closeButton: {
    marginTop: 24,
    marginBottom: 40,
    paddingVertical: 14,
    alignItems: 'center',
  },
  closeButtonText: {
    color: '#2F6F73',
    fontWeight: '700',
  },
});
