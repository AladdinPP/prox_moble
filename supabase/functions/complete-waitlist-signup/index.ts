// supabase/functions/complete-waitlist-signup/index.ts
// Supabase Edge Function: finalize signup by creating/updating user metadata
// Expects JSON POST bodies containing at least `email`. When creating a new user,
// include `password`. Accepts optional fields: firstName, lastName, dateOfBirth,
// genderIdentity, zipCode, preferredRetailers (array or comma-separated string), appPreference.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.2';

interface CompleteSignupRequest {
  email: string;
  password?: string;
  firstName?: string;
  lastName?: string;
  dateOfBirth?: string;
  phone?: string;
  genderIdentity?: string;
  zipCode?: string;
  preferredRetailers?: string[] | string;
  appPreference?: string;
}

const normalizeRetailers = (raw?: string[] | string) => {
  if (!raw) return [] as string[];
  let arr: string[] = [];
  if (Array.isArray(raw)) arr = raw.slice();
  else arr = String(raw).split(',').map((s) => s.trim()).filter(Boolean);
  return arr.slice(0, 3);
};

export default async (req: Request) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };

  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  try {
    const body = await req.json().catch(() => null) as CompleteSignupRequest | null;
    if (!body || !body.email) {
      return new Response(JSON.stringify({ success: false, error: 'Missing required field: email' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    // Accept either SUPABASE_SERVICE_ROLE_KEY or SERVICE_ROLE_KEY because some CLIs
    // disallow environment variable names that start with SUPABASE_. Use whichever is set.
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? Deno.env.get('SERVICE_ROLE_KEY');
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing environment variables:', {
        hasUrl: !!supabaseUrl,
        hasServiceKey: !!supabaseServiceKey,
      });
      return new Response(JSON.stringify({ success: false, error: 'Server misconfigured: missing SERVICE_ROLE_KEY or SUPABASE_URL' }), { status: 500, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, { auth: { autoRefreshToken: false, persistSession: false } });

    const emailNorm = String(body.email).trim().toLowerCase();
    const passwordNorm = body.password ? String(body.password) : undefined;
    const firstNameNorm = body.firstName ? String(body.firstName).trim() : undefined;
    const lastNameNorm = body.lastName ? String(body.lastName).trim() : undefined;
    const dobNorm = body.dateOfBirth ? String(body.dateOfBirth).trim() : undefined;
    const phoneNorm = body.phone ? String(body.phone).trim() : undefined;
    const genderNorm = body.genderIdentity ? String(body.genderIdentity).trim() : undefined;
    const zipNorm = body.zipCode ? String(body.zipCode).trim() : undefined;
    const retailersNorm = normalizeRetailers(body.preferredRetailers);
    const appPrefNorm = body.appPreference ? String(body.appPreference).trim() : undefined;

    // Find existing user by email (paginated list)
    let user: any = null;
    let page = 1;
    const perPage = 1000;
    while (!user && page <= 10) {
      const { data, error: listError } = await supabaseAdmin.auth.admin.listUsers({ page, perPage });
      if (listError) throw listError;
      const users = data?.users ?? [];
      if (!users.length) break;
      user = users.find((u: any) => String(u.email || '').toLowerCase() === emailNorm);
      if (user) break;
      if (users.length < perPage) break;
      page += 1;
    }

    if (!user) {
      // Creating a new user requires a password
      if (!passwordNorm) {
        return new Response(JSON.stringify({ success: false, error: 'Password required when creating a new user' }), { status: 400, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
      }

      const { data: newUserData, error: createError } = await supabaseAdmin.auth.admin.createUser({
        email: emailNorm,
        password: passwordNorm,
        email_confirm: true,
        user_metadata: {
          first_name: firstNameNorm,
          last_name: lastNameNorm,
          date_of_birth: dobNorm,
          phone_number: phoneNorm,
          gender_identity: genderNorm,
          zip_code: zipNorm,
          preferred_retailers: retailersNorm,
          app_preference: appPrefNorm,
        },
      });
      if (createError) throw createError;
      user = newUserData.user;
      console.log('Created new user', user.id);
    } else {
      const updatePayload: any = {
        email_confirm: true,
        user_metadata: {
          first_name: firstNameNorm,
          last_name: lastNameNorm,
          date_of_birth: dobNorm,
          phone_number: phoneNorm,
          gender_identity: genderNorm,
          zip_code: zipNorm,
          preferred_retailers: retailersNorm,
          app_preference: appPrefNorm,
        },
      };
      if (passwordNorm) updatePayload.password = passwordNorm;
      const { error: updateError } = await supabaseAdmin.auth.admin.updateUserById(user.id, updatePayload);
      if (updateError) throw updateError;
      console.log('Updated user', user.id);
    }

    // Update waitlist entry to attach user_id if present
    try {
      const { data: waitlistUser, error: waitlistErr } = await supabaseAdmin.from('waitlist').select('id').eq('email', emailNorm).maybeSingle();
      if (!waitlistErr && waitlistUser) {
        await supabaseAdmin.from('waitlist').update({ user_id: user.id }).eq('email', emailNorm);
      }
    } catch (e) {
      console.warn('Waitlist update failed', e);
    }

    return new Response(JSON.stringify({ success: true, userId: user.id }), { status: 200, headers: { 'Content-Type': 'application/json', ...corsHeaders } });
  } catch (error: any) {
    console.error('complete-waitlist-signup error', error);
    return new Response(JSON.stringify({ success: false, error: String(error?.message ?? error) }), { status: 500, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*'} });
  }
};
