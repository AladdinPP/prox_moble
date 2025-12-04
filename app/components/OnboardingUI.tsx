// app/components/OnboardingUI.tsx
import React from 'react';
import {
  StyleSheet,
  TouchableOpacity,
  Text,
  ViewStyle,
  TextStyle,
} from 'react-native';

type ButtonProps = {
  title: string;
  onPress?: () => void;
  disabled?: boolean;
  style?: ViewStyle;
};

export const PrimaryButton: React.FC<ButtonProps> = ({
  title,
  onPress,
  disabled,
  style,
}) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={disabled}
    style={[
      onboardingStyles.primaryButton,
      disabled && onboardingStyles.primaryButtonDisabled,
      style,
    ]}
  >
    <Text style={onboardingStyles.primaryButtonText}>{title}</Text>
  </TouchableOpacity>
);

export const SecondaryButton: React.FC<ButtonProps> = ({
  title,
  onPress,
  style,
}) => (
  <TouchableOpacity
    onPress={onPress}
    style={[onboardingStyles.secondaryButton, style]}
  >
    <Text style={onboardingStyles.secondaryButtonText}>{title}</Text>
  </TouchableOpacity>
);

type LinkButtonProps = {
  title: string;
  onPress?: () => void;
  style?: TextStyle;
};

export const LinkButton: React.FC<LinkButtonProps> = ({
  title,
  onPress,
  style,
}) => (
  <TouchableOpacity onPress={onPress}>
    <Text style={[onboardingStyles.linkText, style]}>{title}</Text>
  </TouchableOpacity>
);

export const onboardingStyles = StyleSheet.create({
  fullScreen: {
    flex: 1,
    backgroundColor: '#F7F8F7', /* Was #FFFFFF Can also try #F7F8F7 or #FAFAF8 or #082517*/
  },
  darkBg: {
    backgroundColor: '#082517',
  },
  centerContent: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  screenContent: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    justifyContent: 'flex-start',
  },
  splashLogo: {
    fontSize: 40,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 12,
  },
  splashSubtitle: {
    fontSize: 16,
    color: '#E5F3EC',
    textAlign: 'center',
    marginBottom: 40,
  },
  splashBar: {
    width: 160,
    height: 4,
    borderRadius: 999,
    backgroundColor: '#FFFFFF33',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 12,
    color: '#082517',
  },
  bodyText: {
    fontSize: 14,
    color: '#3F4A43',
    marginBottom: 16,
  },
  primaryButton: {
    backgroundColor: '#082517',
    paddingVertical: 14,
    borderRadius: 999,
    alignItems: 'center',
    marginTop: 12,
  },
  primaryButtonDisabled: {
    backgroundColor: '#A7B4AC',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontWeight: '600',
    fontSize: 16,
  },
  secondaryButton: {
    paddingVertical: 12,
    borderRadius: 999,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#082517',
    marginTop: 12,
  },
  secondaryButtonText: {
    color: '#082517',
    fontWeight: '500',
    fontSize: 16,
  },
  linkText: {
    color: '#082517',
    fontSize: 14,
    fontWeight: '500',
  },
  input: {
    borderWidth: 1,
    borderColor: '#D3D9D5',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
    marginBottom: 12,
  },
  legalText: {
    fontSize: 11,
    color: '#7A847E',
    marginTop: 12,
  },
  imagePlaceholder: {
    width: '100%',
    height: 200,
    borderRadius: 16,
    backgroundColor: '#E5E8E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  imagePlaceholderText: {
    fontSize: 12,
    color: '#6A726E',
  },
  cardPlaceholder: {
    width: '100%',
    height: 160,
    borderRadius: 16,
    backgroundColor: '#E5E8E6',
    justifyContent: 'center',
    alignItems: 'center',
    marginVertical: 24,
  },
  storeGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginTop: 16,
    marginBottom: 16,
  },
  storeTile: {
    width: '30%',
    minWidth: 100,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#D3D9D5',
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  storeTileSelected: {
    borderColor: '#082517',
    backgroundColor: '#E5F3EC',
  },
  storeLogoPlaceholder: {
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: '#CBD4CF',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 8,
  },
  storeLabel: {
    fontSize: 12,
    color: '#082517',
    textAlign: 'center',
  },
  helperText: {
    fontSize: 12,
    color: '#B0413E',
    marginBottom: 8,
  },
});

// Provide a harmless default export so Expo Router does not treat this file as a route.
// The file exports several named components (PrimaryButton, LinkButton, etc.) which
// the app imports by name. Expo Router expects a default React component when a
// file is located under `app/` and will warn if missing. Returning null is fine
// because this file is intended for shared UI helpers, not a route screen.
export default function OnboardingUI(): React.ReactElement | null {
  return null;
}
