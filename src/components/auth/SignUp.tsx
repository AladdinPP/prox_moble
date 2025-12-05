import React, { useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Eye, EyeOff } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  ProxCard,
  ProxCardHeader,
  ProxCardTitle,
  ProxCardContent,
} from '@/components/ProxCard';
import { useToast } from '@/hooks/use-toast';

// -----------------------------
// Constants
// -----------------------------

const GROCERY_STORES = [
  'Albertsons',
  'Aldi',
  'Amazon Fresh',
  'Food Lion',
  'H-E-B',
  'Kroger',
  'Meijer',
  'Northgate',
  'Publix',
  'Ralphs',
  'Safeway',
  'El Super',
  'Superior Grocers',
  'Smart & Final',
  'Sprouts Market',
  'Target',
  "Trader Joe's",
  'Vallarta',
  'Vons',
  'Wegmans',
  'Walmart',
  'Whole Foods',
  'Other',
] as const;

const GENDER_OPTIONS = ['male', 'female', 'non-binary'] as const;

// -----------------------------
// Validation schema
// -----------------------------

const signUpSchema = z
  .object({
    email: z.string().email('Please enter a valid email address'),
    password: z.string().min(8, 'Password must be at least 8 characters'),
    confirmPassword: z.string(),
    firstName: z.string().min(1, 'First name is required'),
    lastName: z.string().min(1, 'Last name is required'),

    phoneNumber: z
      .string()
      .min(10, 'Phone number must be at least 10 characters'),

    zipCode: z.string().regex(/^\d{5}$/, 'Zip code must be 5 digits'),

    birthday: z
      .string()
      .regex(/^\d{2}\/\d{2}\/\d{4}$/, 'Birthday must be in MM/DD/YYYY format')
      .refine((value) => {
        const [monthStr, dayStr, yearStr] = value.split('/');
        const month = Number(monthStr);
        const day = Number(dayStr);
        const year = Number(yearStr);

        if (
          Number.isNaN(month) ||
          Number.isNaN(day) ||
          Number.isNaN(year) ||
          month < 1 ||
          month > 12 ||
          day < 1 ||
          day > 31
        ) {
          return false;
        }

        const date = new Date(year, month - 1, day);

        // Ensure date matches exactly
        if (
          date.getFullYear() !== year ||
          date.getMonth() !== month - 1 ||
          date.getDate() !== day
        ) {
          return false;
        }

        // Must be in the past
        const today = new Date();
        return date < today;
      }, 'Birthday must be a valid date in the past'),

    householdSize: z.number().min(1).max(12),

    genderIdentity: z.enum(GENDER_OPTIONS, {
      required_error: 'Gender identity is required',
    }),

    // we now track stores as an array of names chosen from GROCERY_STORES
    selectedGrocers: z
      .array(z.string())
      .min(2, 'Please select at least 2 stores')
      .max(3, 'You can select up to 3 stores'),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ['confirmPassword'],
  });

type SignUpForm = z.infer<typeof signUpSchema>;

interface SignUpProps {
  onSuccess: () => void;
  onSwitchToSignIn: () => void;
}

export function SignUp({ onSuccess, onSwitchToSignIn }: SignUpProps) {
  const { signUp } = useAuth();
  const { toast } = useToast();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
  } = useForm<SignUpForm>({
    resolver: zodResolver(signUpSchema),
    defaultValues: {
      householdSize: 1,
      selectedGrocers: [],
    },
  });

  const onSubmit = async (data: SignUpForm) => {
    setIsLoading(true);

    try {
      // Parse birthday string (MM/DD/YYYY) into ISO date
      const [monthStr, dayStr, yearStr] = data.birthday.split('/');
      const month = Number(monthStr);
      const day = Number(dayStr);
      const year = Number(yearStr);
      const birthdayDate = new Date(year, month - 1, day);
      const birthdayISO = birthdayDate.toISOString().split('T')[0];

      // Map selected grocers into grocer_1, grocer_2, grocer_3
      const grocer1 = data.selectedGrocers[0] ?? null;
      const grocer2 = data.selectedGrocers[1] ?? null;
      const grocer3 = data.selectedGrocers[2] ?? null;

      const { error } = await signUp(data.email, data.password, {
        first_name: data.firstName,
        last_name: data.lastName,
        phone_number: data.phoneNumber,
        zip_code: data.zipCode,
        birthday: birthdayISO,
        household_size: data.householdSize,
        gender_identity: data.genderIdentity,
        grocer_1: grocer1,
        grocer_2: grocer2,
        grocer_3: grocer3,
      });

      if (error) {
        toast({
          title: 'Sign up failed',
          description: error.message,
          variant: 'destructive',
        });
      } else {
        toast({
          title: 'Account created!',
          description: 'Please check your email to verify your account.',
        });
        reset();
        onSuccess();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'An unexpected error occurred',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <ProxCard className="w-full max-w-md mx-auto">
      <ProxCardHeader>
        <ProxCardTitle className="text-center text-2xl font-primary font-semibold text-black">
          Create Account
        </ProxCardTitle>
      </ProxCardHeader>
      <ProxCardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* First / Last name row */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label
                htmlFor="firstName"
                className="font-secondary text-black"
              >
                First Name
              </Label>
              <Input id="firstName" {...register('firstName')} className="h-12" />
              {errors.firstName && (
                <p className="text-sm text-destructive">
                  {errors.firstName.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="lastName" className="font-secondary text-black">
                Last Name
              </Label>
              <Input id="lastName" {...register('lastName')} className="h-12" />
              {errors.lastName && (
                <p className="text-sm text-destructive">
                  {errors.lastName.message}
                </p>
              )}
            </div>
          </div>

          {/* Phone number */}
          <div className="space-y-2">
            <Label htmlFor="phoneNumber" className="font-secondary text-black">
              Phone Number
            </Label>
            <Input
              id="phoneNumber"
              {...register('phoneNumber')}
              className="h-12"
              placeholder="e.g., (555) 123-4567"
            />
            {errors.phoneNumber && (
              <p className="text-sm text-destructive">
                {errors.phoneNumber.message}
              </p>
            )}
          </div>

          {/* Email */}
          <div className="space-y-2">
            <Label htmlFor="email" className="font-secondary text-black">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              {...register('email')}
              className="h-12"
            />
            {errors.email && (
              <p className="text-sm text-destructive">{errors.email.message}</p>
            )}
          </div>

          {/* Password */}
          <div className="space-y-2">
            <Label htmlFor="password" className="font-secondary text-black">
              Password
            </Label>
            <div className="relative">
              <Input
                id="password"
                type={showPassword ? 'text' : 'password'}
                {...register('password')}
                className="h-12 pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() => setShowPassword(!showPassword)}
              >
                {showPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            {errors.password && (
              <p className="text-sm text-destructive">
                {errors.password.message}
              </p>
            )}
          </div>

          {/* Confirm Password */}
          <div className="space-y-2">
            <Label
              htmlFor="confirmPassword"
              className="font-secondary text-black"
            >
              Confirm Password
            </Label>
            <div className="relative">
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? 'text' : 'password'}
                {...register('confirmPassword')}
                className="h-12 pr-10"
              />
              <button
                type="button"
                className="absolute inset-y-0 right-0 pr-3 flex items-center"
                onClick={() =>
                  setShowConfirmPassword(!showConfirmPassword)
                }
              >
                {showConfirmPassword ? (
                  <EyeOff className="h-4 w-4 text-muted-foreground" />
                ) : (
                  <Eye className="h-4 w-4 text-muted-foreground" />
                )}
              </button>
            </div>
            {errors.confirmPassword && (
              <p className="text-sm text-destructive">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>

          {/* Zip + Household Size */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="zipCode" className="font-secondary text-black">
                Zip Code
              </Label>
              <Input
                id="zipCode"
                {...register('zipCode')}
                className="h-12"
                placeholder="12345"
              />
              {errors.zipCode && (
                <p className="text-sm text-destructive">
                  {errors.zipCode.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label
                htmlFor="householdSize"
                className="font-secondary text-black"
              >
                Household Size
              </Label>
              <Input
                id="householdSize"
                type="number"
                min="1"
                max="12"
                {...register('householdSize', { valueAsNumber: true })}
                className="h-12"
              />
              {errors.householdSize && (
                <p className="text-sm text-destructive">
                  {errors.householdSize.message}
                </p>
              )}
            </div>
          </div>

          {/* Birthday */}
          <div className="space-y-2">
            <Label htmlFor="birthday" className="font-secondary text-black">
              Birthday
            </Label>
            <Input
              id="birthday"
              {...register('birthday')}
              className="h-12"
              placeholder="MM/DD/YYYY"
            />
            {errors.birthday && (
              <p className="text-sm text-destructive">
                {errors.birthday.message}
              </p>
            )}
          </div>

          {/* Gender identity buttons */}
          <div className="space-y-2">
            <Label className="font-secondary text-black">
              Gender Identity<span className="text-red-500"> *</span>
            </Label>
            <Controller
              name="genderIdentity"
              control={control}
              render={({ field }) => (
                <div className="grid grid-cols-3 gap-2">
                  {GENDER_OPTIONS.map((option) => {
                    const isSelected = field.value === option;
                    const label =
                      option === 'male'
                        ? 'Male'
                        : option === 'female'
                        ? 'Female'
                        : 'Non-Binary';
                    return (
                      <button
                        key={option}
                        type="button"
                        onClick={() => field.onChange(option)}
                        className={[
                          'rounded-xl border px-3 py-3 text-center text-sm transition-all',
                          isSelected
                            ? 'border-accent bg-accent/10 shadow-sm'
                            : 'border-border hover:border-accent/70 bg-background',
                        ].join(' ')}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              )}
            />
            {errors.genderIdentity && (
              <p className="text-sm text-destructive">
                {errors.genderIdentity.message}
              </p>
            )}
          </div>

          {/* Grocery store selection */}
          <div className="space-y-2">
            <Label className="font-secondary text-black">
              Top 3 Grocery Stores (2 required)<span className="text-red-500">
                {' '}
                *
              </span>
            </Label>
            <Controller
              name="selectedGrocers"
              control={control}
              render={({ field }) => {
                const selected = field.value || [];
                const toggleStore = (store: string) => {
                  const isSelected = selected.includes(store);
                  let next: string[];

                  if (isSelected) {
                    next = selected.filter((s) => s !== store);
                  } else {
                    // Add new one (max 3)
                    if (selected.length >= 3) {
                      return; // don't add more than 3
                    }
                    next = [...selected, store];
                  }

                  field.onChange(next);
                };

                return (
                  <div className="border rounded-2xl max-h-64 overflow-y-auto p-2">
                    <div className="grid grid-cols-3 gap-2">
                      {GROCERY_STORES.map((store) => {
                        const isSelected = selected.includes(store);
                        return (
                          <button
                            key={store}
                            type="button"
                            onClick={() => toggleStore(store)}
                            className={[
                              'rounded-xl border px-3 h-12 flex items-center justify-center text-center text-xs sm:text-sm transition-all',
                              isSelected
                                ? 'border-accent bg-accent/10 shadow-sm'
                                : 'border-border hover:border-accent/70 bg-background',
                            ].join(' ')}
                          >
                            {store}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              }}
            />
            {errors.selectedGrocers && (
              <p className="text-sm text-destructive">
                {errors.selectedGrocers.message}
              </p>
            )}
          </div>

          {/* Submit button */}
          <Button
            type="submit"
            className="w-full h-12 bg-accent hover:bg-accent/90 text-white font-primary font-medium"
            disabled={isLoading}
          >
            {isLoading ? 'Creating Account...' : 'Create Account'}
          </Button>

          {/* Switch to sign in */}
          <div className="text-center">
            <button
              type="button"
              onClick={onSwitchToSignIn}
              className="text-sm text-accent hover:underline font-secondary"
            >
              Already have an account? Sign in
            </button>
          </div>
        </form>
      </ProxCardContent>
    </ProxCard>
  );
}
