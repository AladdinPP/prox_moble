// app/auth/options.tsx
import React from 'react';
import {
  SafeAreaView,
  View,
  Text,
  ImageBackground,
  StyleSheet,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  onboardingStyles as s,
  PrimaryButton,
  LinkButton,
} from '../components/OnboardingUI';
import { Image } from 'react-native';
import proxLogoLight from '../../assets/images/prox-logo-light.png';

import authProduce from '../../assets/images/auth-produce.jpg';

export default function AuthOptionsScreen() {
  const router = useRouter();

  return (
    <ImageBackground
      source={authProduce}
      style={{ flex: 1 }}                       // <– no s.fullScreen here
      resizeMode="cover"
      imageStyle={{ transform: [{ scale: 1.2 }] }}
    >
      {/* Dark overlay */}
      <View style={styles.overlay} />

      <SafeAreaView style={{ flex: 1, backgroundColor: 'transparent' }}>
        <View style={styles.content}>
          {/* Center title + subtitle */}
          <View style={styles.hero}>
              <Image
                source={proxLogoLight}
                style={styles.heroLogo}
                resizeMode="contain"
              />
            {/*<Text style={styles.heroTitle}>Prox</Text>*/}
            <Text style={styles.heroSubtitle}>
              Find the cheapest groceries near you and save up to $2,500 per year!
            </Text>
          </View>

          {/* Bottom sheet */}
          <View style={styles.sheet}>
            <PrimaryButton
              title="Continue with Apple"
              onPress={() => Alert.alert('Not available', 'Apple sign-in is not enabled yet. Please use Email.')}
            />
            <PrimaryButton
              title="Continue with Google"
              onPress={() => Alert.alert('Not available', 'Google sign-in is not enabled yet. Please use Email.')}
            />
            <PrimaryButton
              title="Continue with Email"
              onPress={() => router.push('/auth/create-account')}
            />

            {/*<View style={{ marginTop: 16, alignItems: 'center' }}>
              <LinkButton
                title="Use email instead"
                onPress={() => router.push('/auth/create-account')}
              />
            </View>*/}
                    <View style={{ flexDirection: 'row', marginTop: 12 }}>
                      <Text style={s.bodyText}>Already have an account? </Text>
                      <LinkButton
                        title="Log In"
                        onPress={() => router.push('/auth/login')}
                      />
                    </View>
          </View>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.75)', // lighter overlay
  },
  content: {
    flex: 1,
  },
  hero: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
    heroLogo: {
    width: 160,
    height: 160,
    marginBottom: 12,
  },
  heroTitle: {
    fontSize: 32,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  heroSubtitle: {
    fontSize: 24,
    color: '#FFFFFF',
    textAlign: 'center',
  },
  sheet: {
  backgroundColor: '#FFFFFF',
  borderTopLeftRadius: 24,
  borderTopRightRadius: 24,
  borderBottomLeftRadius: 24,   // NEW
  borderBottomRightRadius: 24,  // NEW
  paddingHorizontal: 24,
  paddingTop: 24,
  paddingBottom: 32,
  marginTop: 'auto',
  marginBottom: 24,             // NEW: lifts card off bottom so you see the curve
  marginHorizontal: 16,         // OPTIONAL: gives side breathing room
  shadowColor: '#000',
  shadowOpacity: 0.12,
  shadowRadius: 16,
  shadowOffset: { width: 0, height: -2 },
  elevation: 8,
  },
});
