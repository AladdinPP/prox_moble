// scripts/complete-waitlist-signup.ts
// Deno server function to create/update a Supabase user and attach metadata
// Improved from provided implementation: validation, normalization, and safer metadata handling

import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.2";

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
// Accept either SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY because some CLIs
// (and supabase secrets) disallow env names starting with SUPABASE_.
const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? Deno.env.get("SERVICE_ROLE_KEY");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface CompleteSignupRequest {
  email: string;
  password: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string; // Expecting MM/DD/YYYY or ISO; we store as provided
  genderIdentity?: string;
  zipCode?: string;
  preferredRetailers?: string[] | string; // accept array or comma-separated string
  appPreference?: string;
}

const normalizeRetailers = (raw?: string[] | string) => {
  if (!raw) return [] as string[];
  let arr: string[] = [];
  if (Array.isArray(raw)) arr = raw.slice();
  else arr = String(raw).split(",").map((s) => s.trim()).filter(Boolean);
  // Limit to up to 3 preferences
  return arr.slice(0, 3);
};

const handler = async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => null);
    if (!body) {
      return new Response(JSON.stringify({ success: false, error: 'Invalid JSON' }), {
        status: 400,
        headers: { "Content-Type": "application/json", ...corsHeaders },
      });
    }

    const {
      email,
      password,
      firstName,
      lastName,
      dateOfBirth,
      genderIdentity,
      zipCode,
      preferredRetailers,
      appPreference,
    } = body as CompleteSignupRequest;

    // Basic validation: email is required; password only required when creating a new user
    if (!email) {
      return new Response(
        JSON.stringify({ success: false, error: 'Missing required field: email' }),
        { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
      );
    }

    // Normalize inputs
    const emailNorm = String(email).trim().toLowerCase();
    const passwordNorm = String(password);
    const firstNameNorm = firstName ? String(firstName).trim() : undefined;
    const lastNameNorm = lastName ? String(lastName).trim() : undefined;
    const dobNorm = dateOfBirth ? String(dateOfBirth).trim() : undefined;
    const genderNorm = genderIdentity ? String(genderIdentity).trim() : undefined;
    const zipNorm = zipCode ? String(zipCode).trim() : undefined;
    const retailersNorm = normalizeRetailers(preferredRetailers);
    const appPrefNorm = appPreference ? String(appPreference).trim() : undefined;

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Try to find existing user by email using paginated list (Supabase doesn't provide admin.getUserByEmail)
    let user: any = null;
    let page = 1;
    const perPage = 1000;
    while (!user && page <= 10) {
      const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (listError) {
        console.error('Error listing users:', listError);
        throw listError;
      }
      const users = data?.users ?? [];
      if (!users.length) break;
      user = users.find((u: any) => String(u.email || '').toLowerCase() === emailNorm);
      if (user) break;
      if (users.length < perPage) break;
      page += 1;
    }

    if (!user) {
      // Creating a new user requires a password
      if (!password) {
        return new Response(
          JSON.stringify({ success: false, error: 'Password required when creating a new user' }),
          { status: 400, headers: { "Content-Type": "application/json", ...corsHeaders } }
        );
      }
      // Create a new user
      const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailNorm,
        password: passwordNorm,
        email_confirm: true,
        user_metadata: {
          first_name: firstNameNorm,
          last_name: lastNameNorm,
          date_of_birth: dobNorm,
          gender_identity: genderNorm,
          zip_code: zipNorm,
          preferred_retailers: retailersNorm,
          app_preference: appPrefNorm,
        },
      });

      if (createError) {
        console.error('Error creating user:', createError);
        throw createError;
      }
      user = newUserData.user;
      console.log('Created new user:', user.id, user.email);
    } else {
      // Update existing user password and metadata
      const updatePayload: any = {
        email_confirm: true,
        user_metadata: {
          first_name: firstNameNorm,
          last_name: lastNameNorm,
          date_of_birth: dobNorm,
          gender_identity: genderNorm,
          zip_code: zipNorm,
          preferred_retailers: retailersNorm,
          app_preference: appPrefNorm,
        },
      };
      // Only set password if provided
      if (passwordNorm) updatePayload.password = passwordNorm;

      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, updatePayload);

      if (updateError) {
        console.error('Error updating user:', updateError);
        throw updateError;
      }
      console.log('Updated existing user:', user.id, user.email);
    }

    // Update waitlist entry (if exists) to attach user_id
    try {
      const { data, error: waitlistErr } = await supabaseAdmin
        .from('waitlist')
        .select('id')
        .eq('email', emailNorm)
        .maybeSingle();

      if (waitlistErr) {
        console.warn('Warning: error checking waitlist:', waitlistErr);
      } else if (data) {
        await supabaseAdmin
          .from('waitlist')
          .update({ user_id: user.id })
          .eq('email', emailNorm);
        console.log('Updated waitlist entry with user_id for', emailNorm);
      }
    } catch (e) {
      console.warn('Non-fatal: waitlist update failed', e);
    }

    return new Response(
      JSON.stringify({ success: true, userId: user.id }),
      { status: 200, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  } catch (error: any) {
    console.error('Error in complete-waitlist-signup function:', error);
    return new Response(
      JSON.stringify({ error: String(error?.message ?? error), success: false }),
      { status: 500, headers: { "Content-Type": "application/json", ...corsHeaders } }
    );
  }
};

serve(handler);
