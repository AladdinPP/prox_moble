// app/onboarding/zipcode.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  View,
  Text,
  TextInput,
  Alert,
} from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
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
          onPress={async () => {
            // Save ZIP code directly to waitlist table
            try {
              const { data: userData } = await supabase.auth.getUser();
              let email = userData?.user?.email;

              if (!email) {
                // Fallback to locally persisted signup email
                try {
                  const stored = await AsyncStorage.getItem('signup_email');
                  if (stored) email = stored;
                } catch (e) {
                  console.warn('Failed to read stored signup email', e);
                }
              }

              // Attempt to get stored name for insert fallback
              let storedName: string | null = null;
              try {
                const s = await AsyncStorage.getItem('signup_name');
                if (s !== null) storedName = s;
              } catch (e) {
                console.warn('Failed to read stored signup name', e);
              }

              if (email) {
                // derive fallback name from email local-part if no storedName
                const derivedName = email.split('@')[0];
                const nameToUse = (storedName && storedName.length > 0) ? storedName : derivedName;

                // Use upsert so we create the row if it doesn't exist yet
                const { data, error } = await supabase
                  .from('waitlist')
                  .upsert({ email: email.toLowerCase(), zip_code: zip, name: nameToUse }, { onConflict: 'email' })
                  .select();

                if (error) {
                  console.warn('Failed to save ZIP:', error);
                } else {
                  console.log('Saved ZIP to waitlist (rows returned):', Array.isArray(data) ? data.length : data, data);
                }
              }
            } catch (err: any) {
              console.warn('Error saving ZIP:', err);
              // Continue anyway
            }
            
            router.push('/onboarding/choose-stores');
          }}
        />
      </View>
    </SafeAreaView>
  );
}
