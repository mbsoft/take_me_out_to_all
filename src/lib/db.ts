import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY! // Use service role key for server-side operations
);

// For backward compatibility, we'll create a wrapper that mimics the old API
// but uses Supabase's query builder. This will be gradually replaced.
export const db = supabase;
