// app/onboarding/choose-stores.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  View,
  Text,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  onboardingStyles as s,
  PrimaryButton,
  LinkButton,
} from '../components/OnboardingUI';
import { Image } from 'react-native';
import Constants from 'expo-constants';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../../lib/supabase';
import walmartLogo from '../../assets/images/logo-walmart.png';
import targetLogo from '../../assets/images/logo-target.png';
import ralphsLogo from '../../assets/images/logo-ralphs.png';
import vonsLogo from '../../assets/images/logo-vons.png';
import costcoLogo from '../../assets/images/logo-costco.png';
import samsLogo from '../../assets/images/logo-sams.png';


const STORE_OPTIONS = [
  { id: 'walmart', label: 'Walmart', image: walmartLogo },
  { id: 'target', label: 'Target', image: targetLogo },
  { id: 'ralphs', label: 'Ralphs', image: ralphsLogo },
  { id: 'vons', label: 'Vons', image: vonsLogo },
  { id: 'costco', label: 'Costco', image: costcoLogo },
  { id: 'sams', label: "Sam's Club", image: samsLogo },
];

export default function ChooseStoresScreen() {
  const router = useRouter();
  const [selected, setSelected] = useState<string[]>([]);

  const toggleStore = (id: string) => {
    setSelected((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const selectedCount = selected.length;

  return (
    <SafeAreaView style={s.fullScreen}>
      <ScrollView contentContainerStyle={s.screenContent}>
        <LinkButton title="← Back" onPress={() => router.back()} />

        <Text style={s.title}>Choose your stores</Text>
        <Text style={s.bodyText}>
          Select one or more stores to start comparing prices.
        </Text>

        <View style={s.storeGrid}>
          {STORE_OPTIONS.map((store) => {
            const isSelected = selected.includes(store.id);
            return (
              <TouchableOpacity
                key={store.id}
                style={[
                  s.storeTile,
                  isSelected && s.storeTileSelected,
                ]}
                onPress={() => toggleStore(store.id)}
              >
                <Image
                  source={store.image}
                  style={{ width: 40, height: 40, borderRadius: 8 }}
                  resizeMode="contain"
                />
                <Text style={s.storeLabel}>{store.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {selectedCount === 0 && (
          <Text style={s.helperText}>
            Choose at least one store to continue.
          </Text>
        )}

        <PrimaryButton
          title={
            selectedCount > 0
              ? `Continue with ${selectedCount} store${
                  selectedCount > 1 ? 's' : ''
                }`
              : 'Continue'
          }
          disabled={selectedCount === 0}
          onPress={async () => {
            // Save preferred stores directly to waitlist table
            try {
              const { data: userData } = await supabase.auth.getUser();
              let email = userData?.user?.email;

              if (!email) {
                try {
                  const stored = await AsyncStorage.getItem('signup_email');
                  if (stored) email = stored;
                } catch (e) {
                  console.warn('Failed to read stored signup email', e);
                }
              }

              if (email) {
                // Try to get stored name for insert fallback
                let storedName: string | null = null;
                try {
                  const s = await AsyncStorage.getItem('signup_name');
                  if (s !== null) storedName = s;
                } catch (e) {
                  console.warn('Failed to read stored signup name', e);
                }

                const derivedName = email.split('@')[0];
                const nameToUse = (storedName && storedName.length > 0) ? storedName : derivedName;

                // Use upsert so we create the row if it doesn't exist yet
                const { data, error } = await supabase
                  .from('waitlist')
                  .upsert({ email: email.toLowerCase(), preferred_retailers: selected, name: nameToUse }, { onConflict: 'email' })
                  .select();

                if (error) {
                  console.warn('Failed to save preferred stores:', error);
                } else {
                  console.log('Saved preferred stores to waitlist (rows returned):', Array.isArray(data) ? data.length : data, data);
                  // Clear persisted signup email and name now that onboarding has progressed
                  try {
                    await AsyncStorage.removeItem('signup_email');
                    await AsyncStorage.removeItem('signup_name');
                  } catch (e) {
                    console.warn('Failed to clear stored signup data', e);
                  }
                }
              }
            } catch (err: any) {
              console.warn('Error saving preferred stores:', err);
              // Continue anyway
            }
            
            router.push('/onboarding/savings-preview');
          }}
        /> 
      </ScrollView>
    </SafeAreaView>
  );
}
