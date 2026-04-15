import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { StackNavigationProp } from '@react-navigation/stack';

type RootStackParamList = {
  Top: undefined;
  Signup: undefined;
  Login: undefined;
  StatusTop: undefined;
  Map: undefined;
  Settings: undefined;
};

type TopScreenNavigationProp = StackNavigationProp<RootStackParamList, 'Top'>;

interface Props {
  navigation: TopScreenNavigationProp;
}

export default function TopScreen({ navigation }: Props) {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>COCO</Text>
      <Text style={styles.subtitle}>位置情報共有サービス</Text>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Signup')}
      >
        <Text style={styles.buttonText}>新規登録</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={styles.button}
        onPress={() => navigation.navigate('Login')}
      >
        <Text style={styles.buttonText}>ログイン</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 48,
    fontWeight: 'bold',
    marginBottom: 10,
    color: '#333',
  },
  subtitle: {
    fontSize: 18,
    marginBottom: 40,
    color: '#666',
  },
  button: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 30,
    paddingVertical: 15,
    borderRadius: 8,
    marginVertical: 10,
    width: '80%',
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 18,
    fontWeight: '600',
  },
});