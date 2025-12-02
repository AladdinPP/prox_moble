// app/index.tsx
import React from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  onboardingStyles as s,
  PrimaryButton,
  SecondaryButton,
} from './components/OnboardingUI';
import { Image } from 'react-native';
import proxLogoGreen from '../assets/images/prox-logo-green.png';

import heroImage from '../assets/images/onboarding-hero.jpg';

export default function WelcomeScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={s.fullScreen}>
      <ScrollView contentContainerStyle={s.screenContent}>
        {/* THIS IS TO USE THE GREEN LOGO INSTEAD OF HERO IMAGE OR ADD THE LOGO TO THE TOP
         <Image
          source={proxLogoGreen}
          style={{ width: 120, height: 120, alignSelf: 'center', marginBottom: 16 }}
          resizeMode="contain"
        /> */}

        <Image
          source={heroImage}
          style={{
            width: '100%',
            height: 220,
            borderRadius: 16,
            resizeMode: 'cover',
          }}
        />
        <Text style={s.title}>Stop Overpaying for Groceries</Text>
        <Text style={s.bodyText}>
          Compare real-time prices across your favorite stores and save up to
          $2,500 a year.
        </Text>

        <PrimaryButton
          title="Get Started"
          onPress={() => router.push('/auth/options')}
        />
        <SecondaryButton
          title="Log In"
          onPress={() => router.push('/auth/login')}
        />
      </ScrollView>
    </SafeAreaView>
  );
}
