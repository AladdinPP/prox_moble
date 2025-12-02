// app/_layout.tsx
import { Stack } from 'expo-router';

export default function RootLayout() {
  return (
    <Stack initialRouteName="splash">
      <Stack.Screen
        name="splash"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="index"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="auth/options"
        options={{ title: 'Sign up or log in' }}
      />
      <Stack.Screen
        name="auth/create-account"
        options={{ title: 'Create your account' }}
      />
      <Stack.Screen
        name="auth/login"
        options={{ title: 'Log in' }}
      />
      <Stack.Screen
        name="onboarding/zipcode"
        options={{ title: 'Your ZIP code' }}
      />
      <Stack.Screen
        name="onboarding/choose-stores"
        options={{ title: 'Choose your stores' }}
      />
      <Stack.Screen
        name="onboarding/savings-preview"
        options={{ title: 'Your savings' }}
      />
      <Stack.Screen
        name="dashboard/index"
        options={{ title: 'My Savings Dashboard' }}
      />

      {/* Keep existing tabs + modal support from template */}
      <Stack.Screen
        name="(tabs)"
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="modal"
        options={{ presentation: 'modal' }}
      />
    </Stack>
  );
}
