import { createClient } from '@supabase/supabase-js';

// Fallbacks prevent build errors during Vercel static page generation
// if environment variables haven't been configured in the Vercel dashboard yet.
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder_anon_key';

/** Client-side Supabase (uses anon key, subject to RLS) */
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

/** Server-side Supabase (uses service role key, bypasses RLS) */
export function createServerClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder_service_role_key';
  return createClient(supabaseUrl, serviceRoleKey);
}
