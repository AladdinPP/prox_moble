// app/onboarding/zipcode.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  onboardingStyles as s,
  PrimaryButton,
  LinkButton,
} from '../components/OnboardingUI';

export default function ZipCodeScreen() {
  const router = useRouter();
  const [zip, setZip] = useState('');

  const isValidZip = zip.length === 5;

  return (
    <SafeAreaView style={s.fullScreen}>
      <View style={s.screenContent}>
        <LinkButton title="← Back" onPress={() => router.back()} />

        <Text style={s.title}>Find Savings Near You</Text>
        <Text style={s.bodyText}>
          This powers the cheapest basket in your area.
        </Text>

        <TextInput
          style={s.input}
          placeholder="Enter your ZIP code"
          value={zip}
          onChangeText={setZip}
          keyboardType="number-pad"
          maxLength={5}
        />

        <PrimaryButton
          title="Continue"
          disabled={!isValidZip}
          onPress={() => router.push('/onboarding/choose-stores')}
        />
      </View>
    </SafeAreaView>
  );
}
