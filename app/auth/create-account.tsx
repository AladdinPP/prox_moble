// app/auth/create-account.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  onboardingStyles as s,
  PrimaryButton,
  LinkButton,
} from '../components/OnboardingUI';
import { supabase } from '../../lib/supabase';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function CreateAccountScreen() {
  const router = useRouter();
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');  
  const [password, setPassword] = useState('');
  const [birthday, setBirthday] = useState('');
  const [showReferral, setShowReferral] = useState(false);
  const [referral, setReferral] = useState('');

  const canContinue = !!email && !!password;
  const [loading, setLoading] = useState(false);

  const handleSignUp = async () => {
    if (!canContinue) return;
    setLoading(true);
    try {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          Alert.alert('Sign up failed', error.message);
          return;
        }

        // If signUp didn't create an active session, sign in now to obtain an access token
        const sessionCheck = await supabase.auth.getSession();
        if (!sessionCheck.data.session) {
          // attempt password sign in to get session (non-blocking if fails)
          await supabase.auth.signInWithPassword({ email, password }).catch(() => null);
        }

      // After client sign-up, save profile metadata directly to waitlist table
      try {
        const fullName = `${firstName || ''}${firstName && lastName ? ' ' : ''}${lastName || ''}`.trim();
        // try to get the newly-created user's id (if session exists)
        const { data: userData } = await supabase.auth.getUser();
        const userId = userData?.user?.id ?? null;

        const upsertPayload: any = {
          email: email.toLowerCase(),
          name: fullName,
          first_name: firstName,
          last_name: lastName,
          phone_number: phone,
          date_of_birth: birthday,
        };
        if (userId) upsertPayload.user_id = userId;

        const { error: updateError } = await supabase
          .from('waitlist')
          .upsert(upsertPayload, { onConflict: 'email' });

        if (updateError) {
          console.warn('Failed to update waitlist:', updateError);
          // Don't block the user if metadata save fails
        }
      } catch (e: any) {
        console.warn('Failed to save profile metadata:', e);
        // Continue anyway—auth succeeded
      }

      // Persist the signup email so later onboarding steps can update the waitlist
      try {
        await AsyncStorage.setItem('signup_email', email.toLowerCase());
        // Persist the display name as well so later upserts can supply a non-null name
        try {
          const fullName = `${firstName || ''}${firstName && lastName ? ' ' : ''}${lastName || ''}`.trim();
          await AsyncStorage.setItem('signup_name', fullName || '');
        } catch (e) {
          console.warn('Failed to persist signup name locally', e);
        }
      } catch (e) {
        console.warn('Failed to persist signup email locally', e);
      }

      // Successful sign up -- continue onboarding
      router.push('/onboarding/zipcode');
    } catch (e: any) {
      Alert.alert('Error', String(e.message ?? e));
    } finally {
      setLoading(false);
    }
  };

  const handleBirthdayChange = (text: string) => {
  // Remove all non-digits
  let cleaned = text.replace(/\D/g, '');

  // Apply MM/DD/YYYY formatting
  if (cleaned.length >= 3 && cleaned.length <= 4) {
    cleaned = cleaned.replace(/(\d{2})(\d+)/, '$1/$2');
  } else if (cleaned.length >= 5) {
    cleaned = cleaned.replace(/(\d{2})(\d{2})(\d+)/, '$1/$2/$3');
  }

  // Limit to 10 chars (MM/DD/YYYY)
  if (cleaned.length > 10) cleaned = cleaned.slice(0, 10);

  setBirthday(cleaned);
};

  return (
    <SafeAreaView style={s.fullScreen}>
      <ScrollView contentContainerStyle={s.screenContent}>
        <LinkButton title="← Back" onPress={() => router.back()} />

        <Text style={s.title}>Create your account</Text>

        <TextInput
          style={s.input}
          placeholder="First Name"
          value={firstName}
          onChangeText={setFirstName}
        />
        
        <TextInput
          style={s.input}
          placeholder="Last Name"
          value={lastName}
          onChangeText={setLastName}
        />

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
          placeholder="Phone Number"
          value={phone}
          onChangeText={setPhone}
        />

        <TextInput
          style={s.input}
          placeholder="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
        />
        <TextInput
          style={s.input}
          placeholder="MM/DD/YYYY"
          value={birthday}
          onChangeText={handleBirthdayChange}
          keyboardType="number-pad"
        />

        {!showReferral && (
          <LinkButton
            title="Have a referral code?"
            onPress={() => setShowReferral(true)}
          />
        )}

        {showReferral && (
          <TextInput
            style={s.input}
            placeholder="Referral code"
            value={referral}
            onChangeText={setReferral}
          />
        )}

        <PrimaryButton
          title={loading ? 'Working...' : 'Continue'}
          disabled={!canContinue || loading}
          onPress={handleSignUp}
        />

        <Text style={s.legalText}>
          By continuing, you agree to our Terms of Service and Privacy Policy.
        </Text>

        <View style={{ flexDirection: 'row', marginTop: 12 }}>
          <Text style={s.bodyText}>Already have an account? </Text>
          <LinkButton
            title="Log In"
            onPress={() => router.push('/auth/login')}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
