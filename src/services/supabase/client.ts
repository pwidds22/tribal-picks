import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL ?? '';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? '';

// Supabase URL and Anon Key are required — set EXPO_PUBLIC_SUPABASE_URL
// and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
