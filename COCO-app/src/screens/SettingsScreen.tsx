import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import { authApi } from '../services/api';

interface Props {
  navigation?: any;
}

export default function SettingsScreen({ navigation }: Props) {
  const handleLogout = async () => {
    try {
      await authApi.logout();
      const rootNavigation = navigation?.getParent?.() || navigation;
      rootNavigation?.reset?.({
        index: 0,
        routes: [{ name: 'Top' }],
      });
    } catch (error) {
      Alert.alert('エラー', error instanceof Error ? error.message : 'ログアウトに失敗しました');
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>設定</Text>

      <TouchableOpacity style={styles.button} onPress={handleLogout}>
        <Text style={styles.buttonText}>ログアウト</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 30,
    color: '#333',
  },
  button: {
    backgroundColor: '#FF3B30',
    paddingVertical: 15,
    borderRadius: 8,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});
