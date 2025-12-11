import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '@/integrations/supabase/client';
import { useGuestStore } from '@/stores/guestStore';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signUp: (email: string, password: string, userData: any) => Promise<{ error: any }>;
  signIn: (email: string, password: string) => Promise<{ error: any }>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const { setIsGuest } = useGuestStore();

  useEffect(() => {
    // Set up auth state listener first
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setUser(session?.user ?? null);

        // Clear guest mode when user becomes authenticated
        if (session?.user) {
          setIsGuest(false);
        }

        setLoading(false);
      }
    );

    // Then check for existing session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);

      // Clear guest mode if there's an existing authenticated session
      if (session?.user) {
        setIsGuest(false);
      }

      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [setIsGuest]);

  
  const signUp = async (email: string, password: string, userData: any) => {
    const redirectUrl =
      typeof window !== "undefined"
        ? `${window.location.origin}/confirm-email`
        : undefined;

    // Build preferred_retailers array from grocer_1/2/3
    const preferredRetailers = [
      userData.grocer_1,
      userData.grocer_2,
      userData.grocer_3,
    ].filter(Boolean) as string[];

    const displayName = `${userData.first_name ?? ""} ${
      userData.last_name ?? ""
    }`.trim();

    // This must match the web app's `finalData` shape so the DB trigger
    // can correctly populate public.profiles
    const finalMeta = {
      email,
      first_name: userData.first_name,
      last_name: userData.last_name,
      phone_number: userData.phone_number,
      date_of_birth: userData.birthday, // from SignUp.tsx (birthdayISO)
      gender_identity: userData.gender_identity,
      zip_code: userData.zip_code,
      preferred_retailers: preferredRetailers,
      app_preference: "mobile", // hard-code for the mobile app
      display_name: displayName,
    };

    try {
      // 1) Create auth user (this triggers the confirmation email via Resend)
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          ...(redirectUrl ? { emailRedirectTo: redirectUrl } : {}),
          data: finalMeta,
        },
      });

      if (error) {
        console.error("Auth signUp error:", error);
        return { error };
      }

      const userId = data.user?.id ?? null;

      // 2) Upsert into public.waitlist with full info
      try {
        const { error: waitlistError } = await supabase
          .from("waitlist")
          .upsert(
            {
              email,
              name: displayName || email,
              user_id: userId,
              zip_code: userData.zip_code ?? null,
              preferred_retailers:
                preferredRetailers.length > 0 ? preferredRetailers : null,
              device_preference: "mobile",
              date_of_birth: userData.birthday ?? null,
              first_name: userData.first_name ?? null,
              last_name: userData.last_name ?? null,
              phone_number: userData.phone_number ?? null,
              metadata: {
                source: "mobile-app",
                household_size: userData.household_size ?? null,
                created_from: "mobile-signup",
              },
            },
            { onConflict: "email" }
          );

        if (waitlistError) {
          console.error("Error upserting into waitlist:", waitlistError);
        }
      } catch (waitlistException) {
        console.error("Unexpected waitlist error:", waitlistException);
      }

      // 3) Try to hydrate public.profiles directly, including the new email column.
      //    If RLS blocks this, it will just log an error and continue.
      try {
        if (userId) {
          const { error: profileError } = await (supabase as any)
            .from("profiles")
            .update({
              first_name: finalMeta.first_name,
              last_name: finalMeta.last_name,
              display_name: finalMeta.display_name,
              date_of_birth: finalMeta.date_of_birth,
              gender_identity: finalMeta.gender_identity,
              zip_code: finalMeta.zip_code,
              preferred_retailers: finalMeta.preferred_retailers,
              app_preference: finalMeta.app_preference,
              phone_number: finalMeta.phone_number,
              email, // <— new column you added
            })
            .eq("user_id", userId);

          if (profileError) {
            console.error("Error updating profile:", profileError);
          }
        }
      } catch (profileException) {
        console.error("Unexpected profile update error:", profileException);
      }

      // 4) Fire the same Resend-powered emails as the web app
      try {
        // Welcome email to user
        await supabase.functions.invoke("send-welcome-email", {
          body: {
            name: displayName || userData.first_name || email,
            email,
          },
        });

        // Notification email to admin
        await supabase.functions.invoke("notify-admin-signup", {
          body: {
            firstName: userData.first_name,
            lastName: userData.last_name,
            email,
            dateOfBirth: finalMeta.date_of_birth,
            genderIdentity: finalMeta.gender_identity,
            zipCode: finalMeta.zip_code,
            preferredRetailers,
            appPreference: "mobile",
          },
        });
      } catch (emailError) {
        console.error("Failed to send signup-related emails:", emailError);
      }

      return { error: null };
    } catch (e: any) {
      console.error("Unexpected signup error:", e);
      return { error: e };
    }
  };

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    // Clear guest mode on successful sign in (auth state change will handle the actual clearing)
    if (!error) {
      setIsGuest(false);
    }

    return { error };
  };

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  const value = {
    user,
    session,
    loading,
    signUp,
    signIn,
    signOut
  };
  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}