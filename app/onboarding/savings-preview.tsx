// app/onboarding/savings-preview.tsx
import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  onboardingStyles as s,
  PrimaryButton,
  SecondaryButton,
} from '../components/OnboardingUI';

export default function SavingsPreviewScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.fullScreen}>
      <View style={s.screenContent}>
        <Text style={s.title}>You could save $2,500 this year!</Text>
        <Text style={s.bodyText}>
          Based on shoppers like you in your area who use Prox to compare
          baskets across their favorite stores.
        </Text>

        <View style={s.cardPlaceholder}>
          <Text style={s.imagePlaceholderText}>
            Savings chart placeholder
          </Text>
        </View>

        <PrimaryButton
          title="Start comparing prices"
          onPress={() => router.replace('/dashboard')}
        />

        <SecondaryButton
          title="Share with a friend"
          onPress={() => {
            // Wire native share here later
          }}
        />
      </View>
    </SafeAreaView>
  );
}
