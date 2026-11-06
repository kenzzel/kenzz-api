import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const anon = process.env.SUPABASE_ANON_KEY;
const service = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !anon || !service) {
  console.error("Missing Supabase environment variables.");
}

export const adminDb = createClient(url || "", service || "", {
  auth: { persistSession: false, autoRefreshToken: false }
});

export const authClient = createClient(url || "", anon || "", {
  auth: { persistSession: false, autoRefreshToken: false }
});
