// Supabase Auth identifies users by email. Threadline uses usernames, so each
// username maps to an internal address that is never emailed.
export const USERNAME_PATTERN = /^[a-z0-9][a-z0-9._-]{2,31}$/;

export function normalizeUsername(username: string) {
  return username.trim().toLowerCase();
}

export function usernameToEmail(username: string) {
  return `${normalizeUsername(username)}@threadline.local`;
}
