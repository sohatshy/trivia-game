// ============================================================
//  Sign-in. Supabase Google login is added in step 6.
//  Until then there is no account, so owner-only pages are allowed ONLY on this computer (localhost).
// ============================================================

import { CONFIG } from './config.js';

const isLocal = ['localhost', '127.0.0.1', '[::1]'].includes(location.hostname);

/** The signed-in user ({ id, email }) or null. */
export async function getUser() {
  return null;
}

/** Can the current visitor open owner-only pages (review.html)? */
export async function isOwner() {
  const user = await getUser();
  if (user) return user.email?.toLowerCase() === CONFIG.OWNER_EMAIL.toLowerCase();
  return !CONFIG.SUPABASE_URL && isLocal; // before login exists: only on your own computer
}
