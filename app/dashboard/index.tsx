// app/dashboard/index.tsx
import React from 'react';
import { SafeAreaView, View, Text } from 'react-native';
import { onboardingStyles as s } from '../components/OnboardingUI';

export default function DashboardScreen() {
  return (
    <SafeAreaView style={s.fullScreen}>
      <View style={s.screenContent}>
        <Text style={s.title}>My Savings Dashboard</Text>
        <View style={s.cardPlaceholder}>
          <Text style={s.imagePlaceholderText}>
            Dashboard card placeholder
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}
