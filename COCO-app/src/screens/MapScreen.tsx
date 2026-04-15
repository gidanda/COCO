import React, { useCallback, useEffect, useState } from 'react';
import { Alert, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import MapView, { Circle, MapPressEvent, Marker, Region } from 'react-native-maps';
import * as Location from 'expo-location';
import { areaApi, groupApi, mapApi } from '../services/api';
import { AreaWithUsers, Group, MapArea, MapData } from '../types';

const DEFAULT_REGION: Region = {
  latitude: 35.681236,
  longitude: 139.767125,
  latitudeDelta: 0.04,
  longitudeDelta: 0.04,
};

export default function MapScreen({ route }: { route?: { params?: { groupId?: string } } }) {
  const [groups, setGroups] = useState<Group[]>([]);
  const [selectedGroupId, setSelectedGroupId] = useState<string | null>(route?.params?.groupId || null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [region, setRegion] = useState<Region>(DEFAULT_REGION);
  const [creatingArea, setCreatingArea] = useState(false);
  const [pendingCenter, setPendingCenter] = useState<{ latitude: number; longitude: number } | null>(null);
  const [areaName, setAreaName] = useState('');
  const [areaRadius, setAreaRadius] = useState('300');
  const [groupName, setGroupName] = useState('');
  const [groupModalVisible, setGroupModalVisible] = useState(false);
  const [detailArea, setDetailArea] = useState<AreaWithUsers | null>(null);
  const [editingAreaName, setEditingAreaName] = useState('');

  useEffect(() => {
    if (route?.params?.groupId) {
      setSelectedGroupId(route.params.groupId);
    }
  }, [route?.params?.groupId]);

  const loadGroups = useCallback(async () => {
    try {
      const nextGroups = await groupApi.getAll();
      setGroups(nextGroups);
      const nextSelectedId = selectedGroupId || nextGroups[0]?.id || null;
      setSelectedGroupId(nextSelectedId);
      if (nextSelectedId) {
        const data = await mapApi.getData(nextSelectedId);
        setMapData(data);
        if (data.areas[0]) {
          setRegion({
            latitude: data.areas[0].centerLatitude,
            longitude: data.areas[0].centerLongitude,
            latitudeDelta: 0.04,
            longitudeDelta: 0.04,
          });
        }
      } else {
        setMapData(null);
      }
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : '地図データの取得に失敗しました');
    }
  }, [selectedGroupId]);

  useFocusEffect(
    useCallback(() => {
      loadGroups();
    }, [loadGroups])
  );

  const loadSelectedMap = async (groupId: string) => {
    setSelectedGroupId(groupId);
    try {
      setMapData(await mapApi.getData(groupId));
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : '地図データの取得に失敗しました');
    }
  };

  const moveToCurrentLocation = async () => {
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') {
        Alert.alert('エラー', '位置情報の利用が許可されていません');
        return;
      }
      const current = await Location.getCurrentPositionAsync({});
      setRegion({
        latitude: current.coords.latitude,
        longitude: current.coords.longitude,
        latitudeDelta: 0.02,
        longitudeDelta: 0.02,
      });
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : '現在地を取得できませんでした');
    }
  };

  const createGroup = async () => {
    if (!groupName.trim()) {
      Alert.alert('エラー', 'グループ名を入力してください');
      return;
    }

    try {
      const group = await groupApi.create(groupName.trim(), '');
      setGroupName('');
      setGroupModalVisible(false);
      setSelectedGroupId(group.id);
      await loadSelectedMap(group.id);
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'グループ作成に失敗しました');
    }
  };

  const onMapPress = (event: MapPressEvent) => {
    if (!creatingArea) return;
    setPendingCenter(event.nativeEvent.coordinate);
  };

  const saveArea = async () => {
    if (!selectedGroupId || !pendingCenter) return;
    const radius = Number(areaRadius);
    if (!areaName.trim() || !Number.isFinite(radius) || radius <= 0) {
      Alert.alert('エラー', 'エリア名と正しい半径を入力してください');
      return;
    }

    try {
      await areaApi.create(selectedGroupId, areaName.trim(), pendingCenter.latitude, pendingCenter.longitude, radius);
      setAreaName('');
      setAreaRadius('300');
      setPendingCenter(null);
      setCreatingArea(false);
      await loadSelectedMap(selectedGroupId);
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'エリア作成に失敗しました');
    }
  };

  const openArea = async (area: MapArea) => {
    try {
      const detail = await areaApi.getDetail(area.id);
      setDetailArea(detail);
      setEditingAreaName(detail.name);
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'エリア詳細の取得に失敗しました');
    }
  };

  const updateArea = async () => {
    if (!detailArea || !editingAreaName.trim()) return;

    try {
      const updated = await areaApi.update(detailArea.id, editingAreaName.trim());
      const nextDetail = await areaApi.getDetail(updated.id);
      setDetailArea(nextDetail);
      setEditingAreaName(nextDetail.name);
      if (selectedGroupId) await loadSelectedMap(selectedGroupId);
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'エリア名の更新に失敗しました');
    }
  };

  const deleteArea = async () => {
    if (!detailArea) return;

    try {
      await areaApi.delete(detailArea.id);
      setDetailArea(null);
      if (selectedGroupId) await loadSelectedMap(selectedGroupId);
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'エリア削除に失敗しました');
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.topBar}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.groupList}>
          {groups.map(group => (
            <TouchableOpacity
              key={group.id}
              style={[styles.groupChip, group.id === selectedGroupId && styles.groupChipActive]}
              onPress={() => loadSelectedMap(group.id)}
            >
              <Text style={[styles.groupChipText, group.id === selectedGroupId && styles.groupChipTextActive]}>{group.name}</Text>
            </TouchableOpacity>
          ))}
        </ScrollView>
        <TouchableOpacity style={styles.iconButton} onPress={() => setGroupModalVisible(true)}>
          <Text style={styles.iconButtonText}>+</Text>
        </TouchableOpacity>
      </View>

      <MapView style={styles.map} region={region} onRegionChangeComplete={setRegion} onPress={onMapPress}>
        {mapData?.areas.map(area => (
          <Circle
            key={area.id}
            center={{ latitude: area.centerLatitude, longitude: area.centerLongitude }}
            radius={area.radiusMeters}
            strokeColor={area.hasUsersInside ? '#1C7C54' : '#5B7C99'}
            fillColor={area.hasUsersInside ? 'rgba(28, 124, 84, 0.18)' : 'rgba(91, 124, 153, 0.16)'}
          />
        ))}
        {mapData?.areas.map(area => (
          <Marker
            key={`${area.id}-marker`}
            coordinate={{ latitude: area.centerLatitude, longitude: area.centerLongitude }}
            title={area.name}
            description={area.hasUsersInside ? 'ユーザーがいます' : 'ユーザーはいません'}
            onPress={() => openArea(area)}
          />
        ))}
        {pendingCenter && (
          <Circle
            center={pendingCenter}
            radius={Number(areaRadius) || 300}
            strokeColor="#2F6F73"
            fillColor="rgba(47, 111, 115, 0.18)"
          />
        )}
      </MapView>

      <View style={styles.actionBar}>
        <TouchableOpacity style={styles.secondaryButton} onPress={moveToCurrentLocation}>
          <Text style={styles.secondaryButtonText}>現在地</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.primaryButton, creatingArea && styles.primaryButtonActive]}
          onPress={() => setCreatingArea(value => !value)}
          disabled={!selectedGroupId}
        >
          <Text style={styles.primaryButtonText}>{creatingArea ? 'エリア指定中' : 'エリア作成'}</Text>
        </TouchableOpacity>
      </View>

      {creatingArea && (
        <View style={styles.createPanel}>
          <Text style={styles.panelTitle}>地図をタップして中心を指定</Text>
          <TextInput style={styles.input} placeholder="エリア名" value={areaName} onChangeText={setAreaName} />
          <TextInput style={styles.input} placeholder="半径（m）" value={areaRadius} onChangeText={setAreaRadius} keyboardType="numeric" />
          <TouchableOpacity style={styles.primaryButton} onPress={saveArea} disabled={!pendingCenter}>
            <Text style={styles.primaryButtonText}>保存</Text>
          </TouchableOpacity>
        </View>
      )}

      {!selectedGroupId && (
        <View style={styles.emptyPanel}>
          <Text style={styles.emptyTitle}>グループがありません</Text>
          <Text style={styles.emptyText}>先に共有グループを作成してください</Text>
        </View>
      )}

      <Modal visible={groupModalVisible} transparent animationType="fade" onRequestClose={() => setGroupModalVisible(false)}>
        <View style={styles.overlay}>
          <View style={styles.dialog}>
            <Text style={styles.dialogTitle}>グループ作成</Text>
            <TextInput style={styles.input} placeholder="グループ名" value={groupName} onChangeText={setGroupName} />
            <TouchableOpacity style={styles.primaryButton} onPress={createGroup}>
              <Text style={styles.primaryButtonText}>作成</Text>
            </TouchableOpacity>
            <TouchableOpacity style={styles.textButton} onPress={() => setGroupModalVisible(false)}>
              <Text style={styles.textButtonText}>キャンセル</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      <Modal visible={Boolean(detailArea)} animationType="slide" onRequestClose={() => setDetailArea(null)}>
        <ScrollView style={styles.detail}>
          {detailArea && (
            <>
              <Text style={styles.detailTitle}>{detailArea.name}</Text>
              <Text style={styles.detailSub}>半径 {Math.round(detailArea.radiusMeters)}m</Text>
              <TextInput style={styles.input} value={editingAreaName} onChangeText={setEditingAreaName} />
              <TouchableOpacity style={styles.primaryButton} onPress={updateArea}>
                <Text style={styles.primaryButtonText}>名前を保存</Text>
              </TouchableOpacity>

              <Text style={styles.sectionTitle}>エリア内ユーザー</Text>
              {detailArea.users.length === 0 ? (
                <Text style={styles.emptyText}>現在このエリアにいるユーザーはいません</Text>
              ) : (
                detailArea.users.map(user => (
                  <View key={user.userId} style={styles.userRow}>
                    <Text style={styles.userName}>{user.displayName}</Text>
                    <Text style={styles.userMeta}>{new Date(user.recordedAt).toLocaleString('ja-JP')}</Text>
                  </View>
                ))
              )}

              <TouchableOpacity style={styles.deleteButton} onPress={deleteArea}>
                <Text style={styles.deleteButtonText}>エリア削除</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.textButton} onPress={() => setDetailArea(null)}>
                <Text style={styles.textButtonText}>閉じる</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F7F7F4',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFFFFF',
  },
  groupList: {
    gap: 8,
    paddingRight: 8,
  },
  groupChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#ECEFED',
  },
  groupChipActive: {
    backgroundColor: '#2F6F73',
  },
  groupChipText: {
    color: '#2A2D30',
    fontWeight: '700',
  },
  groupChipTextActive: {
    color: '#FFFFFF',
  },
  iconButton: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F6F73',
  },
  iconButtonText: {
    color: '#FFFFFF',
    fontSize: 28,
    lineHeight: 30,
  },
  map: {
    flex: 1,
  },
  actionBar: {
    position: 'absolute',
    right: 14,
    bottom: 28,
    flexDirection: 'row',
    gap: 10,
  },
  primaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#2F6F73',
  },
  primaryButtonActive: {
    backgroundColor: '#1C7C54',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
  secondaryButton: {
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  secondaryButtonText: {
    color: '#2F6F73',
    fontWeight: '800',
  },
  createPanel: {
    position: 'absolute',
    left: 14,
    right: 14,
    bottom: 88,
    padding: 14,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  panelTitle: {
    marginBottom: 10,
    fontWeight: '800',
    color: '#202124',
  },
  input: {
    marginTop: 10,
    paddingHorizontal: 12,
    paddingVertical: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DADCE0',
    backgroundColor: '#FFFFFF',
  },
  emptyPanel: {
    position: 'absolute',
    left: 24,
    right: 24,
    top: 110,
    padding: 18,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#202124',
  },
  emptyText: {
    marginTop: 8,
    color: '#5F6368',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    padding: 24,
    backgroundColor: 'rgba(0,0,0,0.35)',
  },
  dialog: {
    padding: 18,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  dialogTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: '#202124',
  },
  textButton: {
    paddingVertical: 16,
    alignItems: 'center',
  },
  textButtonText: {
    color: '#2F6F73',
    fontWeight: '800',
  },
  detail: {
    flex: 1,
    padding: 20,
    backgroundColor: '#F7F7F4',
  },
  detailTitle: {
    marginTop: 34,
    fontSize: 28,
    fontWeight: '900',
    color: '#202124',
  },
  detailSub: {
    marginTop: 6,
    color: '#5F6368',
  },
  sectionTitle: {
    marginTop: 24,
    marginBottom: 8,
    fontSize: 18,
    fontWeight: '800',
    color: '#202124',
  },
  userRow: {
    paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: '#DADCE0',
  },
  userName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#202124',
  },
  userMeta: {
    marginTop: 4,
    color: '#6B6F73',
  },
  deleteButton: {
    marginTop: 24,
    paddingVertical: 14,
    borderRadius: 8,
    alignItems: 'center',
    backgroundColor: '#B3261E',
  },
  deleteButtonText: {
    color: '#FFFFFF',
    fontWeight: '800',
  },
});
