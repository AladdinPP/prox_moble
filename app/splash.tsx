// app/splash.tsx
import React, { useEffect } from 'react';
import { ImageBackground, SafeAreaView, View, Text } from 'react-native';
import { useRouter } from 'expo-router';
import { onboardingStyles as s } from './components/OnboardingUI';

import splashBg from '../assets/images/splash-background.png';
import { Image } from 'react-native';
import proxLogoBig from '../assets/images/prox-logo-big.png';


export default function SplashScreen() {
  const router = useRouter();

  useEffect(() => {
    const timer = setTimeout(() => {
      router.replace('/');
    }, 1500);
    return () => clearTimeout(timer);
  }, [router]);

  return (
    <ImageBackground
      source={splashBg}
      style={s.fullScreen}
      resizeMode="cover"
    >
      <SafeAreaView style={s.fullScreen}>
        <View style={s.centerContent}>
          <Image
            source={proxLogoBig}
            style={{ width: 140, height: 140, marginBottom: 20 }}
            resizeMode="contain"
          />
          <Text style={s.splashSubtitle}>
            Save hundreds every month on groceries.
          </Text>
          <View style={s.splashBar} />
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}
