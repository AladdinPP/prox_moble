import React, { useMemo, useState } from "react";
import { useForm, Controller, FieldErrors } from "react-hook-form";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import { Eye, EyeOff, Calendar as CalendarIcon } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import type { WaitlistCheckResult } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  ProxCard,
  ProxCardHeader,
  ProxCardTitle,
  ProxCardContent,
} from "@/components/ProxCard";

import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";

// -----------------------------
// Constants
// -----------------------------

const GROCERY_STORES = [
  "Albertsons",
  "Aldi",
  "Amazon Fresh",
  "Food Lion",
  "H-E-B",
  "Kroger",
  "Meijer",
  "Northgate",
  "Publix",
  "Ralphs",
  "Safeway",
  "El Super",
  "Superior Grocers",
  "Smart & Final",
  "Sprouts Market",
  "Target",
  "Trader Joe's",
  "Vallarta",
  "Vons",
  "Wegmans",
  "Walmart",
  "Whole Foods",
  "Other",
] as const;

const GENDER_OPTIONS = ["male", "female", "non-binary", "prefer-not-to-say"] as const;

const stepTitle = {
  1: "Welcome to smarter grocery shopping",
  2: "Help us personalize your savings",
  3: "Help us personalize your savings",
} as const;

const stepSubtitle = {
  1: "Create your account",
  2: "This helps us better predict grocery need and surface relevant deals",
  3: "This helps us better predict grocery need and surface relevant deals",
} as const;



// -----------------------------
// Helpers
// -----------------------------

/**
 * ✅ IMPORTANT CHANGE:
 * We format from a "digits-only" string (MMDDYYYY), NOT from the input's displayed text.
 * This prevents the "01/01/0100" shifting problem.
 */
const formatBirthdayFromDigits = (digitsRaw: string): string => {
  const digits = digitsRaw.replace(/\D/g, "").slice(0, 8); // MMDDYYYY
  const len = digits.length;

  // Month
  let mm = "MM";
  if (len === 1) mm = `0${digits[0]}`; // 1 -> 01
  if (len >= 2) mm = digits.slice(0, 2); // 10 -> 10

  // Day
  const dayDigits = digits.slice(2, 4);
  let dd = "DD";
  if (len === 3) dd = `0${digits[2]}`; // ...2 -> 02
  if (len >= 4) dd = dayDigits; // ...28 -> 28

  // Year
  const yearDigits = digits.slice(4, 8);
  let yyyy = "YYYY";
  if (yearDigits.length > 0) {
    yyyy = ("0000" + yearDigits).slice(-4); // 1 -> 0001, 19 -> 0019, ...
  }

  return `${mm}/${dd}/${yyyy}`;
};

const formatDateMMDDYYYY = (date: Date) => {
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const dd = String(date.getDate()).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${mm}/${dd}/${yyyy}`;
};

const parseMMDDYYYY = (value?: string) => {
  if (!value) return undefined;
  const m = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return undefined;

  const mm = Number(m[1]);
  const dd = Number(m[2]);
  const yyyy = Number(m[3]);

  const d = new Date(yyyy, mm - 1, dd);
  if (Number.isNaN(d.getTime())) return undefined;

  if (d.getFullYear() !== yyyy || d.getMonth() !== mm - 1 || d.getDate() !== dd) {
    return undefined;
  }

  return d;
};

// Convert Zod issues -> RHF errors
function zodToRHFErrors<T>(issues: z.ZodIssue[]): FieldErrors<T> {
  const fieldErrors: any = {};
  for (const issue of issues) {
    const path = issue.path?.[0];
    if (!path) continue;
    fieldErrors[path] = { type: issue.code, message: issue.message };
  }
  return fieldErrors as FieldErrors<T>;
}

function ProgressDots({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="flex justify-center gap-2 mt-2">
      {[1, 2, 3].map((dot) => (
        <span
          key={dot}
          className={[
            "h-2.5 w-2.5 rounded-full transition-colors",
            step >= dot ? "bg-prox" : "bg-gray-300",
          ].join(" ")}
        />
      ))}
    </div>
  );
}

// Auto-format raw input into (XXX) XXX-XXXX as the user types
const formatPhoneInput = (value: string): string => {
  const digits = value.replace(/\D/g, "").slice(0, 10); // max 10 digits
  const len = digits.length;

  if (len === 0) return "";
  if (len < 4) return `(${digits}${" ".repeat(3 - len)})`; // "(7  )", "(75 )", "(757)"
  if (len < 7) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`; // "(757) 3", "(757) 35", "(757) 353"
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`; // "(757) 353-7..."
};

// Count how many digits exist in a string before a given index
const countDigitsBeforeIndex = (str: string, index: number) => {
  let count = 0;
  for (let i = 0; i < Math.min(index, str.length); i++) {
    if (/\d/.test(str[i])) count++;
  }
  return count;
};

// Find the cursor position in the formatted string that corresponds to "digitIndex" digits
const findCursorPosFromDigitIndex = (formatted: string, digitIndex: number) => {
  if (digitIndex <= 0) return 0;
  let digitsSeen = 0;

  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      digitsSeen++;
      if (digitsSeen === digitIndex) {
        return i + 1; // place caret after that digit
      }
    }
  }

  // If we ran out of digits, put caret at end
  return formatted.length;
};

// Auto-format raw digits into (XXX) XXX-XXXX
const formatPhoneDigits = (digits: string): string => {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  const len = d.length;

  if (len === 0) return "";
  if (len < 4) return `(${d}${" ".repeat(3 - len)})`; // optional "blanks" behavior
  if (len < 7) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
};



// -----------------------------
// Validation schema
// -----------------------------

const baseSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string(),
  firstName: z.string().min(1, "First name is required"),
  lastName: z.string().min(1, "Last name is required"),
  phoneNumber: z.string().min(10, "Phone number must be at least 10 characters"),

  zipCode: z.string().regex(/^\d{5}$/, "Zip code must be 5 digits"),

  birthday: z
    .string()
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Birthday must be in MM/DD/YYYY format")
    .refine((value) => {
      const [monthStr, dayStr, yearStr] = value.split("/");
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

      if (
        date.getFullYear() !== year ||
        date.getMonth() !== month - 1 ||
        date.getDate() !== day
      ) {
        return false;
      }

      const today = new Date();
      return date < today;
    }, "Birthday must be a valid date in the past"),

  householdSize: z.number().min(1).max(12),

  genderIdentity: z.enum(GENDER_OPTIONS, {
    required_error: "Gender identity is required",
  }),

  selectedGrocers: z
    .array(z.string())
    .min(2, "Please select at least 2 stores")
    .max(3, "You can select up to 3 stores"),
});

const step1Schema = baseSchema
  .pick({
    firstName: true,
    lastName: true,
    phoneNumber: true,
    email: true,
    password: true,
    confirmPassword: true,
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords don't match",
    path: ["confirmPassword"],
  });

const step2Schema = baseSchema.pick({
  zipCode: true,
  householdSize: true,
  birthday: true,
  genderIdentity: true,
});

const fullSchema = baseSchema.refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SignUpForm = z.infer<typeof fullSchema>;

interface SignUpProps {
  onSuccess: () => void;
  onSwitchToSignIn: (email?: string) => void;
}

export function SignUp({ onSuccess, onSwitchToSignIn }: SignUpProps) {
  const { signUp, checkWaitlistEmail } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Track legacy waitlist user status
  const [isLegacyUser, setIsLegacyUser] = useState(false);
  const [legacyData, setLegacyData] = useState<WaitlistCheckResult['existing_data'] | null>(null);

  // Show confirmation screen after successful signup
  const [signUpComplete, setSignUpComplete] = useState(false);
  const [signUpEmail, setSignUpEmail] = useState("");

  // ✅ NEW: raw digits state for birthday (MMDDYYYY)
  const [birthdayDigits, setBirthdayDigits] = useState<string>("");

  // ✅ Step-aware resolver: validates only the current step
  const resolver: Resolver<SignUpForm> = useMemo(() => {
    return async (values) => {
      const schema =
        step === 1 ? step1Schema : step === 2 ? step2Schema : fullSchema;

      const parsed = schema.safeParse(values);
      if (parsed.success) {
        return { values, errors: {} };
      }

      return {
        values: {},
        errors: zodToRHFErrors<SignUpForm>(parsed.error.issues),
      };
    };
  }, [step]);

  const {
    register,
    handleSubmit,
    control,
    formState: { errors },
    reset,
    trigger,
  } = useForm<SignUpForm>({
    resolver,
    defaultValues: {
      firstName: "",
      lastName: "",
      phoneNumber: "",
      email: "",
      password: "",
      confirmPassword: "",
      zipCode: "",
      householdSize: 1,
      // NOTE: stored value will be set from birthdayDigits via Controller
      birthday: "MM/DD/YYYY",
      genderIdentity: undefined as any, // user must select
      selectedGrocers: [],
    },
  });

  const handleNext = async () => {
    const ok = await trigger();
    if (!ok) return;

    // When leaving step 1, check if this email is a legacy waitlist user
    if (step === 1) {
      const emailValue = (document.getElementById('email') as HTMLInputElement)?.value;
      if (emailValue) {
        try {
          const result = await checkWaitlistEmail(emailValue);

          if (result.status === 'has_account') {
            toast({
              title: "Account found",
              description: 'This email already has an account. Please sign in, or use "Forgot Password" to reset your password.',
            });
            onSwitchToSignIn(emailValue);
            return;
          }

          if (result.status === 'legacy_waitlist') {
            setIsLegacyUser(true);
            setLegacyData(result.existing_data ?? null);
            toast({
              title: "Welcome back! 👋",
              description: "We found your waitlist info. Just set a password and confirm your details to activate your account.",
            });
          }
        } catch (e) {
          console.error("Waitlist check error:", e);
        }
      }
    }

    setStep((s) => (s === 1 ? 2 : 3));
  };

  const handleBack = () => {
    setStep((s) => (s === 3 ? 2 : 1));
  };

  const onSubmit = async (data: SignUpForm) => {
    setIsLoading(true);

    try {
      const [monthStr, dayStr, yearStr] = data.birthday.split("/");
      const month = Number(monthStr);
      const day = Number(dayStr);
      const year = Number(yearStr);
      const birthdayDate = new Date(year, month - 1, day);
      const birthdayISO = birthdayDate.toISOString().split("T")[0];

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
          title: "Sign up failed",
          description: error.message,
          variant: "destructive",
        });
      } else {
        // Show the confirmation screen instead of navigating away
        setSignUpEmail(data.email);
        setSignUpComplete(true);
      }
    } catch (e) {
      toast({
        title: "Error",
        description: "An unexpected error occurred",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // ── Confirmation screen (shown after successful signup) ──
  if (signUpComplete) {
    return (
      <ProxCard className="w-full max-w-md mx-auto">
        <ProxCardHeader>
          <ProxCardTitle className="text-center text-2xl font-primary font-semibold text-black">
            Check Your Email 📧
          </ProxCardTitle>
        </ProxCardHeader>
        <ProxCardContent className="text-center space-y-4">
          <div className="mx-auto w-16 h-16 rounded-full bg-accent/10 flex items-center justify-center mb-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="text-accent"
            >
              <rect width="20" height="16" x="2" y="4" rx="2" />
              <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
            </svg>
          </div>
          <p className="text-muted-foreground font-secondary">
            A confirmation email has been sent to:
          </p>
          <p className="font-semibold text-black font-secondary">
            {signUpEmail}
          </p>
          <p className="text-muted-foreground font-secondary text-sm">
            Please click the link in the email to verify your account before attempting to sign in.
          </p>
          <p className="text-muted-foreground font-secondary text-xs">
            Don't see it? Check your spam folder.
          </p>
          <Button
            type="button"
            className="w-full h-12 bg-prox hover:bg-prox-hover text-white font-secondary mt-4"
            onClick={() => onSwitchToSignIn(signUpEmail)}
          >
            Go to Sign In
          </Button>
        </ProxCardContent>
      </ProxCard>
    );
  }

  return (
    <ProxCard className="w-full max-w-md mx-auto">
      <ProxCardHeader>
        <ProgressDots step={step} />
        <ProxCardTitle className="text-center text-2xl font-primary font-semibold text-black">
          {stepTitle[step]}
        </ProxCardTitle>
        <p className="text-center text-sm text-muted-foreground font-secondary">
          {stepSubtitle[step]}
        </p>
      </ProxCardHeader>

      <ProxCardContent>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* ---------------- STEP 1 ---------------- */}
          {step === 1 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="font-secondary text-black">
                    First Name<span className="text-red-500"> *</span>
                  </Label>
                  <Input id="firstName" {...register("firstName")} className="h-12" />
                  {errors.firstName && (
                    <p className="text-sm text-destructive">{errors.firstName.message}</p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="lastName" className="font-secondary text-black">
                    Last Name<span className="text-red-500"> *</span>
                  </Label>
                  <Input id="lastName" {...register("lastName")} className="h-12" />
                  {errors.lastName && (
                    <p className="text-sm text-destructive">{errors.lastName.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="phoneNumber" className="font-secondary text-black">
                  Phone Number<span className="text-red-500"> *</span>
                </Label>

                <Controller
                  name="phoneNumber"
                  control={control}
                  render={({ field }) => (
                    <Input
                      id="phoneNumber"
                      className="h-12"
                      placeholder="(555) 123-4567"
                      inputMode="numeric"
                      autoComplete="tel"
                      value={formatPhoneDigits(field.value || "")}
                      onChange={(e) => {
                        const inputEl = e.currentTarget;

                        // 1) Where is the cursor right now (in the formatted string)?
                        const caretPos = inputEl.selectionStart ?? inputEl.value.length;

                        // 2) How many digits were to the left of the cursor?
                        const digitsBefore = countDigitsBeforeIndex(inputEl.value, caretPos);

                        // 3) New digits-only value from what user typed
                        const nextDigits = e.target.value.replace(/\D/g, "").slice(0, 10);

                        // 4) Update RHF (store digits only)
                        field.onChange(nextDigits);

                        // 5) After React re-renders with the formatted value, restore caret
                        requestAnimationFrame(() => {
                          const formatted = formatPhoneDigits(nextDigits);
                          const nextCaretPos = findCursorPosFromDigitIndex(formatted, digitsBefore);

                          try {
                            inputEl.setSelectionRange(nextCaretPos, nextCaretPos);
                          } catch {
                            // ignore
                          }
                        });
                      }}
                      onKeyDown={(e) => {
                        // Optional: make backspace feel more natural when cursor is on formatting chars
                        if (e.key !== "Backspace") return;

                        const inputEl = e.currentTarget;
                        const caretPos = inputEl.selectionStart ?? 0;

                        // If the cursor is just after a non-digit (space, ), -, etc), move left one more
                        // so backspace deletes the previous digit instead of "doing nothing".
                        if (caretPos > 0 && !/\d/.test(inputEl.value[caretPos - 1])) {
                          e.preventDefault();

                          // Move left until we find a digit position to delete
                          let newPos = caretPos - 1;
                          while (newPos > 0 && !/\d/.test(inputEl.value[newPos - 1])) {
                            newPos--;
                          }

                          // Simulate deleting one digit by removing the digit before cursor from digits-only
                          const digits = (field.value || "").replace(/\D/g, "");
                          const digitsBefore = countDigitsBeforeIndex(inputEl.value, newPos);

                          // remove the digit at digitsBefore-1
                          const removeIndex = Math.max(digitsBefore - 1, 0);
                          const nextDigits =
                            digits.slice(0, removeIndex) + digits.slice(removeIndex + 1);

                          field.onChange(nextDigits);

                          requestAnimationFrame(() => {
                            const formatted = formatPhoneDigits(nextDigits);
                            const nextCaretPos = findCursorPosFromDigitIndex(formatted, removeIndex);
                            try {
                              inputEl.setSelectionRange(nextCaretPos, nextCaretPos);
                            } catch {}
                          });
                        }
                      }}
                    />
                  )}
                />


                {errors.phoneNumber && (
                  <p className="text-sm text-destructive">{errors.phoneNumber.message}</p>
                )}
              </div>


              <div className="space-y-2">
                <Label htmlFor="email" className="font-secondary text-black">
                  Email<span className="text-red-500"> *</span>
                </Label>
                <Input id="email" type="email" {...register("email")} className="h-12" />
                {errors.email && (
                  <p className="text-sm text-destructive">{errors.email.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="font-secondary text-black">
                  Password<span className="text-red-500"> *</span>
                </Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    {...register("password")}
                    className="h-12 pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-sm text-destructive">{errors.password.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword" className="font-secondary text-black">
                  Confirm Password<span className="text-red-500"> *</span>
                </Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    {...register("confirmPassword")}
                    className="h-12 pr-10"
                  />
                  <button
                    type="button"
                    className="absolute inset-y-0 right-0 pr-3 flex items-center"
                    onClick={() => setShowConfirmPassword((v) => !v)}
                  >
                    {showConfirmPassword ? (
                      <EyeOff className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <Eye className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                </div>
                {errors.confirmPassword && (
                  <p className="text-sm text-destructive">{errors.confirmPassword.message}</p>
                )}
              </div>
            </>
          )}

          {/* ---------------- STEP 2 ---------------- */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="zipCode" className="font-secondary text-black">
                    Zip Code<span className="text-red-500"> *</span>
                  </Label>
                  <Input id="zipCode" {...register("zipCode")} className="h-12" placeholder="12345" />
                  {errors.zipCode && (
                    <p className="text-sm text-destructive">{errors.zipCode.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="householdSize" className="font-secondary text-black">
                    Household Size<span className="text-red-500"> *</span>
                  </Label>
                  <Input
                    id="householdSize"
                    type="number"
                    min="1"
                    max="12"
                    {...register("householdSize", { valueAsNumber: true })}
                    className="h-12"
                  />
                  {errors.householdSize && (
                    <p className="text-sm text-destructive">{errors.householdSize.message}</p>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="birthday" className="font-secondary text-black">
                  Birthday<span className="text-red-500"> *</span>
                </Label>

                <Controller
                  name="birthday"
                  control={control}
                  render={({ field }) => {
                    const displayValue = formatBirthdayFromDigits(birthdayDigits);

                    // selected date only when we have a full real date (8 digits)
                    const selectedDate =
                      birthdayDigits.length === 8 ? parseMMDDYYYY(formatBirthdayFromDigits(birthdayDigits)) : undefined;

                    return (
                      <div className="relative">
                        <Input
                          id="birthday"
                          className="h-12 pr-10"
                          value={displayValue}
                          // ✅ We do NOT use onChange to interpret the "display string".
                          // We capture digits via keydown/paste so formatting never shifts.
                          onChange={() => {}}
                          onKeyDown={(e) => {
                            const k = e.key;

                            // Allow navigation keys
                            if (
                              k === "Tab" ||
                              k === "ArrowLeft" ||
                              k === "ArrowRight" ||
                              k === "Home" ||
                              k === "End"
                            ) {
                              return;
                            }

                            // Backspace removes last digit
                            if (k === "Backspace") {
                              e.preventDefault();
                              setBirthdayDigits((prev) => {
                                const next = prev.slice(0, -1);
                                const nextDisplay = formatBirthdayFromDigits(next);
                                field.onChange(nextDisplay);
                                return next;
                              });
                              return;
                            }

                            // Delete clears all
                            if (k === "Delete") {
                              e.preventDefault();
                              setBirthdayDigits(() => {
                                const next = "";
                                field.onChange(formatBirthdayFromDigits(next));
                                return next;
                              });
                              return;
                            }

                            // Digits add
                            if (/^\d$/.test(k)) {
                              e.preventDefault();
                              setBirthdayDigits((prev) => {
                                if (prev.length >= 8) return prev;
                                const next = prev + k;
                                const nextDisplay = formatBirthdayFromDigits(next);
                                field.onChange(nextDisplay);
                                return next;
                              });
                              return;
                            }

                            // Block other keys (so user can't type letters into the template)
                            e.preventDefault();
                          }}
                          onPaste={(e) => {
                            e.preventDefault();
                            const pasted = e.clipboardData.getData("text") || "";
                            const digits = pasted.replace(/\D/g, "");
                            if (!digits) return;

                            setBirthdayDigits((prev) => {
                              const combined = (prev + digits).slice(0, 8);
                              const nextDisplay = formatBirthdayFromDigits(combined);
                              field.onChange(nextDisplay);
                              return combined;
                            });
                          }}
                        />

                        {/* Calendar button (UNCHANGED) */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <button
                              type="button"
                              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md hover:bg-accent/10"
                              aria-label="Pick a date"
                            >
                              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                            </button>
                          </PopoverTrigger>

                          <PopoverContent className="w-auto p-0" align="end">
                            <Calendar
                              mode="single"
                              selected={selectedDate}
                              onSelect={(date) => {
                                if (!date) return;

                                const mm = String(date.getMonth() + 1).padStart(2, "0");
                                const dd = String(date.getDate()).padStart(2, "0");
                                const yyyy = String(date.getFullYear());
                                const nextDigits = `${mm}${dd}${yyyy}`.slice(0, 8);

                                setBirthdayDigits(nextDigits);
                                field.onChange(formatDateMMDDYYYY(date));
                              }}
                              captionLayout="dropdown"
                              fromYear={1900}
                              toYear={new Date().getFullYear()}
                              initialFocus
                              classNames={{
                                caption_label: "hidden",
                                dropdowns: "flex items-center gap-2",
                                dropdown: "w-auto",
                                caption: "flex items-center justify-center gap-2 relative pt-1",
                                caption_dropdowns: "flex items-center gap-2",
                              }}
                            />
                          </PopoverContent>
                        </Popover>
                      </div>
                    );
                  }}
                />

                {errors.birthday && (
                  <p className="text-sm text-destructive">{errors.birthday.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="font-secondary text-black">
                  Gender Identity<span className="text-red-500"> *</span>
                </Label>

                <Controller
                  name="genderIdentity"
                  control={control}
                  render={({ field }) => (
                    <div className="grid grid-cols-2 gap-2">
                      {GENDER_OPTIONS.map((option) => {
                        const isSelected = field.value === option;

                        const label =
                          option === "male"
                            ? "Male"
                            : option === "female"
                            ? "Female"
                            : option === "non-binary"
                            ? "Non-Binary"
                            : "Prefer not to say";

                        return (
                          <button
                            key={option}
                            type="button"
                            onClick={() => field.onChange(option)}
                            className={[
                              "rounded-xl border px-3 py-3 text-center text-sm transition-all",
                              isSelected
                                ? "border-accent bg-accent/10 shadow-sm"
                                : "border-border hover:border-accent/70 bg-background",
                            ].join(" ")}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                />

                {errors.genderIdentity && (
                  <p className="text-sm text-destructive">{errors.genderIdentity.message}</p>
                )}
              </div>
            </>
          )}

          {/* ---------------- STEP 3 ---------------- */}
          {step === 3 && (
            <div className="space-y-2">
              <Label className="font-secondary text-black">
                Top 3 Grocery Stores (2 required)<span className="text-red-500"> *</span>
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
                      if (selected.length >= 3) return;
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
                                "rounded-xl border px-3 h-12 flex items-center justify-center text-center text-xs sm:text-sm transition-all",
                                isSelected
                                  ? "border-accent bg-accent/10 shadow-sm"
                                  : "border-border hover:border-accent/70 bg-background",
                              ].join(" ")}
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
                <p className="text-sm text-destructive">{errors.selectedGrocers.message}</p>
              )}
            </div>
          )}

          {/* Navigation buttons */}
          <div className="flex gap-2">
            {step !== 1 && (
              <Button
                type="button"
                variant="outline"
                className="w-full h-12 font-primary font-medium text-black hover:bg-prox hover:text-white transition-colors"
                onClick={handleBack}
                disabled={isLoading}
              >
                Back
              </Button>
            )}

            {step !== 3 ? (
              <Button
                type="button"
                className="w-full h-12 bg-prox hover:bg-prox-hover text-white font-secondary"

                // className="w-full h-12 bg-prox hover:bg-prox-hover text-white font-secondary"
                onClick={handleNext}
                disabled={isLoading}
              >
                Next
              </Button>
            ) : (
              <Button
                type="submit"
                className="w-full h-12 bg-prox hover:bg-prox-hover text-white font-secondary"
                disabled={isLoading}
              >
                {isLoading ? "Creating Account..." : "Create Account"}
              </Button>
            )}
          </div>

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
