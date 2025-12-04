// app/auth/login.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  onboardingStyles as s,
  PrimaryButton,
  LinkButton,
} from '../components/OnboardingUI';
import { supabase } from '../../lib/supabase';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canLogin = !!email && !!password;
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!canLogin) return;
    setLoading(true);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        Alert.alert('Login failed', error.message);
        return;
      }
      router.replace('/dashboard');
    } catch (e: any) {
      Alert.alert('Error', String(e.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={s.fullScreen}>
      <ScrollView contentContainerStyle={s.screenContent}>
        <LinkButton title="← Back" onPress={() => router.back()} />
        <Text style={s.title}>Log in to Prox</Text>

        <TextInput
          style={s.input}
          placeholder="Email address"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          style={s.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />

        <PrimaryButton
          title={loading ? 'Logging in...' : 'Log In'}
          disabled={!canLogin || loading}
          onPress={handleLogin}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
