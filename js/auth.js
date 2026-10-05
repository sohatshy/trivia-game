// ============================================================
//  Sign-in with Supabase (Google).
//  Works only after SUPABASE_URL and SUPABASE_ANON_KEY are filled in js/config.js.
//  Before that, everyone plays as a guest and owner-only pages open only on localhost.
// ============================================================

import { CONFIG } from './config.js';

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);
let clientPromise = null;

export function isConfigured() {
  return Boolean(CONFIG.SUPABASE_URL && CONFIG.SUPABASE_ANON_KEY);
}

/** The Supabase client (loaded from a CDN only when needed), or null if not configured. */
export function getClient() {
  if (!isConfigured()) return Promise.resolve(null);
  if (!clientPromise) {
    clientPromise = import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm')
      .then(({ createClient }) => createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY))
      .catch((err) => {
        console.error('Supabase failed to load', err);
        return null;
      });
  }
  return clientPromise;
}

/** The signed-in user ({ id, email, name }) or null. */
export async function getUser() {
  const sb = await getClient();
  if (!sb) return null;
  const { data } = await sb.auth.getSession();
  const u = data.session?.user;
  return u ? { id: u.id, email: u.email, name: u.user_metadata?.full_name || u.email } : null;
}

/** Sends the browser to Google, then back to this same page. */
export async function signInWithGoogle() {
  const sb = await getClient();
  if (!sb) throw new Error('Supabase is not configured');
  const { error } = await sb.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: location.origin + location.pathname },
  });
  if (error) throw error;
}

export async function signOut() {
  const sb = await getClient();
  if (sb) await sb.auth.signOut();
}

/** Can the current visitor open owner-only pages (review.html)? */
export async function isOwner() {
  const user = await getUser();
  if (user) return user.email?.toLowerCase() === CONFIG.OWNER_EMAIL.toLowerCase();
  return !isConfigured() && isLocal; // before login exists: only on your own computer
}
