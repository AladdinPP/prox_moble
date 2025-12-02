// app/auth/create-account.tsx
import React, { useState } from 'react';
import {
  SafeAreaView,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useRouter } from 'expo-router';
import {
  onboardingStyles as s,
  PrimaryButton,
  LinkButton,
} from '../components/OnboardingUI';

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
          title="Continue"
          disabled={!canContinue}
          onPress={() => router.push('/onboarding/zipcode')}
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
