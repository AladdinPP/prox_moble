// app/auth/login.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  onboardingStyles as s,
  PrimaryButton,
  LinkButton,
} from '../components/OnboardingUI';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const canLogin = !!email && !!password;

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
          title="Log In"
          disabled={!canLogin}
          onPress={() => router.replace('/dashboard')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
