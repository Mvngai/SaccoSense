/* =====================================================================
   SUPABASE CONNECTION SETTINGS  (js/supabase-config.js)

   Find both values in Supabase:
   Project Settings -> API  (or the "Connect" button at the top)

   ABOUT THESE VALUES:
   - The Project URL and the anon / publishable key are DESIGNED to be
     public. Every visitor's browser downloads them. What protects the
     data is Row Level Security (see supabase/schema.sql).
   - NEVER put the "service_role" / secret key here. That key skips
     all security rules.
   ===================================================================== */

window.SACCO_SUPABASE = {
    url: "https://zkorldonbsdzxlpqizxm.supabase.co",   // e.g. https://abcdefgh.supabase.co
    anonKey: "sb_publishable_a6B5KzcwkQdgc4yN3rfMIQ_Lkn9YbrI"   // starts with "eyJ..." or "sb_publishable_..."
};
