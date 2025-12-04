import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';

// Read env from Expo config `extra` (set via app.config.js) or fallback to process.env
const extras = (Constants.expoConfig && (Constants.expoConfig as any).extra) || {};

const SUPABASE_URL =
	extras.VITE_SUPABASE_URL ?? process.env.VITE_SUPABASE_URL ?? 'https://your-project.supabase.co';
const SUPABASE_ANON_KEY =
	extras.VITE_SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY ?? 'public-anon-key';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export default supabase;
