import React, { useMemo, useState } from "react";
import { useForm, Controller, FieldErrors } from "react-hook-form";
import { z } from "zod";
import type { Resolver } from "react-hook-form";
import { Eye, EyeOff, Calendar as CalendarIcon, ArrowLeft, Info, Check } from "lucide-react";

import { useAuth } from "@/contexts/AuthContext";
import type { WaitlistCheckResult } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { getErrorMessage } from "@/lib/error";

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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

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
  1: "Welcome to smarter grocery shopping.",
  2: "Help us personalize your savings",
  3: "Where do you usually shop?",
} as const;

const stepSubtitle = {
  1: "Create your account",
  2: "This helps us better predict grocery needs and surface relevant deals.",
  3: "Choose one or more retailers to start finding the cheapest basket.",
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
  const fieldErrors: Record<string, { type: string; message: string }> = {};
  for (const issue of issues) {
    const path = issue.path?.[0];
    if (!path) continue;
    fieldErrors[String(path)] = { type: issue.code, message: issue.message };
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

function InlineFieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p className="flex items-start gap-1.5 pt-0.5 text-[13px] leading-[1.2] text-[#E5484D] font-secondary">
      <span
        aria-hidden="true"
        className="mt-[1px] inline-flex h-4 w-4 flex-none items-center justify-center rounded-full bg-[#E5484D] text-[11px] font-semibold leading-none text-white"
      >
        !
      </span>
      <span>{message}</span>
    </p>
  );
}

const STORE_PLACEHOLDER_THEMES = [
  { tile: "bg-[#3B2A21]", text: "text-[#F3E5C5]" },
  { tile: "bg-[#2E5B3A]", text: "text-[#EAF4EA]" },
  { tile: "bg-[#1F4E4B]", text: "text-[#E7F7F6]" },
  { tile: "bg-[#2B6673]", text: "text-[#E5F4F8]" },
  { tile: "bg-[#AA2E25]", text: "text-[#FDE9E8]" },
  { tile: "bg-[#24597A]", text: "text-[#E6F2FA]" },
  { tile: "bg-[#4A6B2F]", text: "text-[#EEF8E9]" },
  { tile: "bg-[#4B4B4B]", text: "text-[#F3F4F6]" },
] as const;

const getStoreLogoText = (store: string): string => {
  const words = store
    .replace(/&/g, " ")
    .replace(/[^a-zA-Z ]/g, " ")
    .split(/\s+/)
    .filter(Boolean);

  if (words.length === 0) return "SHOP";
  if (words.length === 1) return words[0].slice(0, 8).toUpperCase();
  return words
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
};

const normalizeEmail = (value: string): string => value.trim().toLowerCase();

const sanitizeZipCode = (value: string): string => value.replace(/\D/g, "").slice(0, 5);

const toIsoDateFromMMDDYYYY = (value: string): string | null => {
  const match = value.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;

  const [, mm, dd, yyyy] = match;
  return `${yyyy}-${mm}-${dd}`;
};

const parseDateOfBirthForForm = (value?: string): string | null => {
  if (!value) return null;
  const trimmed = value.trim();

  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const [, yyyy, mm, dd] = isoMatch;
    return `${mm}/${dd}/${yyyy}`;
  }

  const usMatch = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (usMatch) {
    return trimmed;
  }

  return null;
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
  phoneNumber: z.string().optional(),

  zipCode: z
    .string()
    .trim()
    .min(1, "Please enter your ZIP code")
    .regex(/^\d{5}$/, "Please enter your ZIP code"),

  birthday: z
    .string()
    .trim()
    .min(1, "Please enter your birthday")
    .regex(/^\d{2}\/\d{2}\/\d{4}$/, "Please enter your birthday")
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
    }, "Please enter a valid birthday"),

  householdSize: z.preprocess(
    (value) => {
      if (typeof value === "number") {
        return Number.isNaN(value) ? undefined : value;
      }

      if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return undefined;
        const parsed = Number(trimmed);
        return Number.isNaN(parsed) ? undefined : parsed;
      }

      return value;
    },
    z
      .number({
        required_error: "Please enter your household size",
        invalid_type_error: "Please enter your household size",
      })
      .int("Please enter a valid household size")
      .min(1, "Please enter a valid household size")
      .max(12, "Please enter a valid household size")
  ),

  genderIdentity: z.enum(GENDER_OPTIONS, {
    message: "Please select an option",
  }),

  selectedGrocers: z
    .array(z.string())
    .min(2, "Please select at least 2 retailers")
    .max(3, "Please select no more than 3 retailers"),
});

const step1Schema = baseSchema
  .pick({
    firstName: true,
    lastName: true,
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
  onBackToWelcome?: () => void;
}

export function SignUp({ onSuccess, onSwitchToSignIn, onBackToWelcome }: SignUpProps) {
  const { signUp, checkWaitlistEmail } = useAuth();
  const { toast } = useToast();

  const [step, setStep] = useState<1 | 2 | 3>(1);

  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingEmail, setIsCheckingEmail] = useState(false);

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
        values: {} as SignUpForm,
        errors: zodToRHFErrors<SignUpForm>(parsed.error.issues),
      };
    };
  }, [step]);

  const {
    register,
    handleSubmit,
    control,
    watch,
    formState: { errors },
    reset,
    trigger,
    getValues,
    setValue,
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
      householdSize: undefined as unknown as number,
      // NOTE: stored value will be set from birthdayDigits via Controller
      birthday: "MM/DD/YYYY",
      genderIdentity: undefined as SignUpForm["genderIdentity"] | undefined, // user must select
      selectedGrocers: [],
    },
  });

  const selectedGrocerCount = watch("selectedGrocers")?.length ?? 0;
  const retailerProgressPercent =
    selectedGrocerCount >= 3 ? 100 : selectedGrocerCount === 2 ? 66 : selectedGrocerCount === 1 ? 33 : 0;

  const handleNext = async () => {
    if (isCheckingEmail) return;

    const ok = await trigger();
    if (!ok) return;

    // When leaving step 1, check if this email is a legacy waitlist user
    if (step === 1) {
      const emailValue = normalizeEmail(getValues("email") || "");
      if (emailValue) {
        setValue("email", emailValue, { shouldDirty: true, shouldValidate: true });
        setIsCheckingEmail(true);

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

            const existingData = result.existing_data;
            if (existingData?.first_name) {
              setValue("firstName", existingData.first_name, { shouldDirty: true });
            }
            if (existingData?.last_name) {
              setValue("lastName", existingData.last_name, { shouldDirty: true });
            }
            if (existingData?.phone_number) {
              setValue("phoneNumber", existingData.phone_number.replace(/\D/g, "").slice(0, 10), {
                shouldDirty: true,
              });
            }
            if (existingData?.zip_code) {
              setValue("zipCode", sanitizeZipCode(existingData.zip_code), { shouldDirty: true });
            }
            if (existingData?.preferred_retailers?.length) {
              setValue("selectedGrocers", existingData.preferred_retailers.slice(0, 3), {
                shouldDirty: true,
              });
            }

            const parsedBirthday = parseDateOfBirthForForm(existingData?.date_of_birth);
            if (parsedBirthday) {
              const digits = parsedBirthday.replace(/\D/g, "").slice(0, 8);
              setBirthdayDigits(digits);
              setValue("birthday", parsedBirthday, { shouldDirty: true });
            }

            toast({
              title: "Welcome back! 👋",
              description: "We found your waitlist info. Just set a password and confirm your details to activate your account.",
            });
          }
        } catch (e) {
          console.error("Waitlist check error:", e);
        } finally {
          setIsCheckingEmail(false);
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
      const normalizedEmail = normalizeEmail(data.email);
      const birthdayISO = toIsoDateFromMMDDYYYY(data.birthday);
      if (!birthdayISO) {
        throw new Error("Birthday format is invalid.");
      }

      const grocer1 = data.selectedGrocers[0] ?? null;
      const grocer2 = data.selectedGrocers[1] ?? null;
      const grocer3 = data.selectedGrocers[2] ?? null;

      const sanitizedPhone = (data.phoneNumber ?? "").replace(/\D/g, "").slice(0, 10);

      const { error } = await signUp(normalizedEmail, data.password, {
        first_name: data.firstName,
        last_name: data.lastName,
        phone_number: sanitizedPhone.length === 10 ? sanitizedPhone : undefined,
        zip_code: sanitizeZipCode(data.zipCode),
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
          description: getErrorMessage(error, "Failed to create your account."),
          variant: "destructive",
        });
      } else {
      // Show the confirmation screen instead of navigating away
      setSignUpEmail(normalizedEmail);
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
    <ProxCard
      className={`w-full max-w-md mx-auto ${
        step === 1
          ? "bg-transparent border-0 shadow-none rounded-none p-0"
          : step >= 2
          ? "bg-[#F3F5F4] border-[#D0D5DD] rounded-[28px] shadow-[0_8px_24px_rgba(16,24,40,0.08)]"
          : ""
      }`}
    >
      <ProxCardHeader
        className={
          step === 1
            ? "px-4 sm:px-6 pt-4 pb-3"
            : step >= 2
            ? "px-6 pt-6 pb-2"
            : undefined
        }
      >
        {onBackToWelcome && step === 1 ? (
          <div className="mb-1">
            <button
              type="button"
              onClick={onBackToWelcome}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[#3A4A56] hover:text-[#122029] hover:bg-black/5 transition-colors"
              aria-label="Back to welcome"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        {step >= 2 ? (
          <div className="mb-1">
            <button
              type="button"
              onClick={handleBack}
              className="inline-flex items-center justify-center h-9 w-9 rounded-full text-[#3A4A56] hover:text-[#122029] hover:bg-black/5 transition-colors"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
          </div>
        ) : null}
        <ProgressDots step={step} />
        <ProxCardTitle
          className={
            step === 1
              ? "text-center text-[34px] leading-[1.15] tracking-[-0.01em] font-primary font-semibold text-[#122029] mt-2"
              : step === 2
              ? "text-center text-[30px] leading-[1.15] tracking-[-0.01em] font-primary font-semibold text-[#171B24] mt-2"
              : "text-center text-[30px] leading-[1.2] tracking-[-0.01em] font-primary font-semibold text-[#171B24] mt-2"
          }
        >
          {stepTitle[step]}
        </ProxCardTitle>
        {step !== 1 ? (
          <p
            className="text-center font-secondary text-[15px] leading-[1.5] text-[#667085]"
          >
            {stepSubtitle[step]}
          </p>
        ) : null}
      </ProxCardHeader>

      <ProxCardContent
        className={
          step === 1
            ? "px-4 sm:px-6 pb-5 pt-0"
            : step >= 2
            ? "px-6 pb-8 pt-2"
            : undefined
        }
      >
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          {/* ---------------- STEP 1 ---------------- */}
          {step === 1 && (
            <>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="firstName" className="font-secondary text-[15px] font-medium text-[#25313D]">
                    First Name
                  </Label>
                  <Input
                    id="firstName"
                    {...register("firstName")}
                    className={[
                      "h-12 rounded-full bg-transparent placeholder:text-[#98A2B3]",
                      errors.firstName
                        ? "border-[#E5484D] focus-visible:border-[#E5484D] focus-visible:ring-[#E5484D]/20"
                        : "border-[#D0D5DD] focus-visible:ring-[#0B3D2E]/25 focus-visible:border-[#0B3D2E]",
                    ].join(" ")}
                    placeholder="Enter your first name"
                  />
                  <InlineFieldError message={errors.firstName?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="lastName" className="font-secondary text-[15px] font-medium text-[#25313D]">
                    Last Name
                  </Label>
                  <Input
                    id="lastName"
                    {...register("lastName")}
                    className={[
                      "h-12 rounded-full bg-transparent placeholder:text-[#98A2B3]",
                      errors.lastName
                        ? "border-[#E5484D] focus-visible:border-[#E5484D] focus-visible:ring-[#E5484D]/20"
                        : "border-[#D0D5DD] focus-visible:ring-[#0B3D2E]/25 focus-visible:border-[#0B3D2E]",
                    ].join(" ")}
                    placeholder="Enter your last name"
                  />
                  <InlineFieldError message={errors.lastName?.message} />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="font-secondary text-[15px] font-medium text-[#25313D]">
                    Email
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    {...register("email")}
                    className={[
                      "h-12 rounded-full bg-transparent placeholder:text-[#98A2B3]",
                      errors.email
                        ? "border-[#E5484D] focus-visible:border-[#E5484D] focus-visible:ring-[#E5484D]/20"
                        : "border-[#D0D5DD] focus-visible:ring-[#0B3D2E]/25 focus-visible:border-[#0B3D2E]",
                    ].join(" ")}
                    placeholder="Enter your email address"
                  />
                  <InlineFieldError message={errors.email?.message} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="password" className="font-secondary text-[15px] font-medium text-[#25313D]">
                      Password
                    </Label>
                    <TooltipProvider delayDuration={120}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-[#25313D]"
                            aria-label="View password requirements"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs leading-5">
                          Use at least 8 characters.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      {...register("password")}
                      className={[
                        "h-12 rounded-full bg-transparent placeholder:text-[#98A2B3] pr-10",
                        errors.password
                          ? "border-[#E5484D] focus-visible:border-[#E5484D] focus-visible:ring-[#E5484D]/20"
                          : "border-[#D0D5DD] focus-visible:ring-[#0B3D2E]/25 focus-visible:border-[#0B3D2E]",
                      ].join(" ")}
                      placeholder="Enter your password"
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
                  <InlineFieldError message={errors.password?.message} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="confirmPassword" className="font-secondary text-[15px] font-medium text-[#25313D]">
                      Confirm Password
                    </Label>
                    <TooltipProvider delayDuration={120}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-[#25313D]"
                            aria-label="View password match requirement"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[240px] text-xs leading-5">
                          Must match your password exactly.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      {...register("confirmPassword")}
                      className={[
                        "h-12 rounded-full bg-transparent placeholder:text-[#98A2B3] pr-10",
                        errors.confirmPassword
                          ? "border-[#E5484D] focus-visible:border-[#E5484D] focus-visible:ring-[#E5484D]/20"
                          : "border-[#D0D5DD] focus-visible:ring-[#0B3D2E]/25 focus-visible:border-[#0B3D2E]",
                      ].join(" ")}
                      placeholder="Confirm your password"
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
                  <InlineFieldError message={errors.confirmPassword?.message} />
                </div>

                <button
                  type="button"
                  className="text-left text-[15px] font-medium text-[#0F4B3A] pt-1 hover:underline"
                >
                  Have a referral code?
                </button>
              </div>
            </>
          )}

          {/* ---------------- STEP 2 ---------------- */}
          {step === 2 && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="zipCode" className="font-secondary text-[15px] font-medium text-[#25313D]">
                      ZIP Code
                    </Label>
                    <TooltipProvider delayDuration={120}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-[#25313D]"
                            aria-label="Open field help"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-xs leading-5">
                          Helps us find savings closest to you.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="zipCode"
                    {...register("zipCode", {
                      setValueAs: (value) => sanitizeZipCode(String(value ?? "")),
                    })}
                    inputMode="numeric"
                    className={[
                      "h-12 rounded-full bg-transparent placeholder:text-[#98A2B3]",
                      errors.zipCode
                        ? "border-[#E5484D] focus-visible:border-[#E5484D] focus-visible:ring-[#E5484D]/20"
                        : "border-[#D0D5DD] focus-visible:ring-[#0B3D2E]/25 focus-visible:border-[#0B3D2E]",
                    ].join(" ")}
                    placeholder="Enter your ZIP code"
                  />
                  <InlineFieldError message={errors.zipCode?.message} />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-1.5">
                    <Label htmlFor="householdSize" className="font-secondary text-[15px] font-medium text-[#25313D]">
                      Household Size
                    </Label>
                    <TooltipProvider delayDuration={120}>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <button
                            type="button"
                            className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-[#25313D]"
                            aria-label="Open field help"
                          >
                            <Info className="h-3.5 w-3.5" />
                          </button>
                        </TooltipTrigger>
                        <TooltipContent side="top" className="max-w-[260px] text-xs leading-5">
                          Helps us predict how often you'll need to restock groceries.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>
                  <Input
                    id="householdSize"
                    type="text"
                    inputMode="numeric"
                    min="1"
                    max="12"
                    {...register("householdSize", {
                      setValueAs: (value) => {
                        const digits = String(value ?? "").replace(/\D/g, "").slice(0, 2);
                        if (!digits) return undefined;
                        return Number(digits);
                      },
                    })}
                    className={[
                      "h-12 rounded-full bg-transparent placeholder:text-[#98A2B3]",
                      errors.householdSize
                        ? "border-[#E5484D] focus-visible:border-[#E5484D] focus-visible:ring-[#E5484D]/20"
                        : "border-[#D0D5DD] focus-visible:ring-[#0B3D2E]/25 focus-visible:border-[#0B3D2E]",
                    ].join(" ")}
                    placeholder="Enter your household size"
                  />
                  <InlineFieldError message={errors.householdSize?.message} />
                </div>
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label htmlFor="birthday" className="font-secondary text-[15px] font-medium text-[#25313D]">
                    Birthday
                  </Label>
                  <TooltipProvider delayDuration={120}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-[#25313D]"
                          aria-label="Open field help"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] text-xs leading-5">
                        Helps us estimate grocery purchasing cycles.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <Controller
                  name="birthday"
                  control={control}
                  render={({ field }) => {
                    const displayValue =
                      birthdayDigits.length === 0 ? "" : formatBirthdayFromDigits(birthdayDigits);

                    // selected date only when we have a full real date (8 digits)
                    const selectedDate =
                      birthdayDigits.length === 8 ? parseMMDDYYYY(formatBirthdayFromDigits(birthdayDigits)) : undefined;

                    return (
                      <div className="relative">
                        <Input
                          id="birthday"
                          className={[
                            "h-12 rounded-full bg-transparent placeholder:text-[#98A2B3] pr-10",
                            errors.birthday
                              ? "border-[#E5484D] focus-visible:border-[#E5484D] focus-visible:ring-[#E5484D]/20"
                              : "border-[#D0D5DD] focus-visible:ring-[#0B3D2E]/25 focus-visible:border-[#0B3D2E]",
                          ].join(" ")}
                          value={displayValue}
                          placeholder="mm/dd/yyyy"
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
                              className="absolute right-2 top-1/2 -translate-y-1/2 inline-flex h-8 w-8 items-center justify-center rounded-md text-[#667085] hover:bg-accent/10"
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

                <InlineFieldError message={errors.birthday?.message} />
              </div>

              <div className="space-y-2">
                <div className="flex items-center gap-1.5">
                  <Label className="font-secondary text-[15px] font-medium text-[#25313D]">
                    How do you identify?
                  </Label>
                  <TooltipProvider delayDuration={120}>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <button
                          type="button"
                          className="inline-flex h-4 w-4 items-center justify-center rounded-full text-muted-foreground hover:text-[#25313D]"
                          aria-label="Open field help"
                        >
                          <Info className="h-3.5 w-3.5" />
                        </button>
                      </TooltipTrigger>
                      <TooltipContent side="top" className="max-w-[260px] text-xs leading-5">
                        Helps us provide a more personalized experience.
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                </div>

                <Controller
                  name="genderIdentity"
                  control={control}
                  render={({ field }) => (
                    <div className="flex flex-wrap gap-2">
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
                              "rounded-full border px-5 h-11 min-w-[102px] inline-flex items-center justify-center text-center text-[15px] font-medium transition-all",
                              isSelected
                                ? "bg-[#0B3D2E] text-white border-[#0B3D2E]"
                                : "border-[#D0D5DD] hover:border-[#0B3D2E]/50 bg-transparent text-[#2B3440]",
                            ].join(" ")}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                />

                <InlineFieldError message={errors.genderIdentity?.message} />
              </div>
            </>
          )}

          {/* ---------------- STEP 3 ---------------- */}
          {step === 3 && (
            <div className="space-y-3">
              <Label className="font-secondary text-[15px] font-medium text-[#25313D]">
                Select up to 3 retailers (2 required)
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
                    <div className="max-h-[430px] overflow-y-auto pr-1">
                      <div className="grid grid-cols-2 gap-4">
                        {GROCERY_STORES.map((store, index) => {
                          const isSelected = selected.includes(store);
                          const canSelectStore = isSelected || selected.length < 3;
                          const placeholderTheme =
                            STORE_PLACEHOLDER_THEMES[index % STORE_PLACEHOLDER_THEMES.length];

                          return (
                            <button
                              key={store}
                              type="button"
                              onClick={() => toggleStore(store)}
                              disabled={!canSelectStore}
                              aria-label={store}
                              aria-pressed={isSelected}
                              className={[
                                "relative h-[122px] rounded-[32px] border transition-all",
                                isSelected
                                  ? "border-[#0B4A39] bg-[#E7EEEB] shadow-[inset_0_0_0_1px_rgba(11,74,57,0.15)]"
                                  : "border-[#D8DBDF] bg-white shadow-[0_2px_8px_rgba(16,24,40,0.04)]",
                                !canSelectStore ? "opacity-60" : "",
                              ].join(" ")}
                            >
                              {isSelected ? (
                                <span className="absolute right-3 top-3 inline-flex h-8 w-8 items-center justify-center rounded-full bg-[#0B4A39] text-white">
                                  <Check className="h-5 w-5" />
                                </span>
                              ) : null}

                              <div className="flex h-full w-full items-center justify-center">
                                <div
                                  className={[
                                    "inline-flex h-16 w-16 items-center justify-center rounded-sm text-[10px] font-semibold tracking-[0.02em]",
                                    placeholderTheme.tile,
                                    placeholderTheme.text,
                                  ].join(" ")}
                                >
                                  {getStoreLogoText(store)}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                }}
              />

              <InlineFieldError message={errors.selectedGrocers?.message} />
            </div>
          )}

          {/* Navigation buttons */}
          {step === 1 ? (
            <div className="pt-6 space-y-3">
              <Button
                type="button"
                className="w-full h-12 min-h-[52px] rounded-full bg-[#0B3D2E] hover:bg-[#093426] text-white font-secondary text-[18px] shadow-[0_6px_14px_rgba(11,61,46,0.22)]"
                onClick={handleNext}
                disabled={isLoading || isCheckingEmail}
              >
                {isCheckingEmail ? "Checking..." : "Continue"}
              </Button>

              <p className="text-center text-sm text-[#667085] font-secondary pt-1">
                By continuing, you agree to our{" "}
                <span className="text-[#0F4B3A] underline font-semibold">Terms of Service</span>.
              </p>

              <p className="text-center text-[15px] text-[#667085] font-secondary">
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => onSwitchToSignIn()}
                  className="text-[#0F4B3A] font-semibold hover:underline"
                >
                  Log In
                </button>
              </p>
            </div>
          ) : step === 2 ? (
            <div className="pt-12 sm:pt-16">
              <Button
                type="button"
                className="w-full h-12 min-h-[52px] rounded-full bg-[#0B3D2E] hover:bg-[#093426] text-white font-secondary text-[18px] shadow-[0_6px_14px_rgba(11,61,46,0.22)]"
                onClick={handleNext}
                disabled={isLoading || isCheckingEmail}
              >
                {isCheckingEmail ? "Checking..." : "Continue"}
              </Button>
            </div>
          ) : step === 3 ? (
            <div className="space-y-5 pt-4">
              <div
                className="h-2 rounded-full bg-[#D9DEE2]"
                role="progressbar"
                aria-label="Retailer selection progress"
                aria-valuemin={0}
                aria-valuemax={100}
                aria-valuenow={retailerProgressPercent}
              >
                <div
                  className="h-full rounded-full bg-[#0B4A39] transition-all duration-200 ease-out"
                  style={{ width: `${retailerProgressPercent}%` }}
                />
              </div>

              <Button
                type="submit"
                className="w-full h-12 min-h-[52px] rounded-full bg-[#0B3D2E] hover:bg-[#093426] text-white font-secondary text-[18px] shadow-[0_6px_14px_rgba(11,61,46,0.22)]"
                disabled={isLoading || isCheckingEmail}
              >
                {isLoading ? "Creating Account..." : "Continue"}
              </Button>
            </div>
          ) : null}
        </form>
      </ProxCardContent>
    </ProxCard>
  );
}
