// ============================================================
//  SETTINGS — change these freely
// ============================================================

export const CONFIG = {
  // Placeholder name until the real one is chosen
  GAME_NAME: 'ميدان',

  // Timers (seconds)
  ANSWER_TIME: 60, // the team that picked the question
  STEAL_TIME: 30,  // the other team, after the first timer runs out

  // Start ticking louder when this many seconds are left
  TICK_WARNING_AT: 10,

  // Board layout: how many questions of each points value per category
  BOARD: [
    { difficulty: 'easy', points: 200, count: 2 },
    { difficulty: 'medium', points: 400, count: 2 },
    { difficulty: 'hard', points: 600, count: 2 },
  ],
  CATEGORIES_PER_TEAM: 3,

  // Only this account can open review.html
  OWNER_EMAIL: 'owner@example.com',

  // Supabase (filled in at step 6). The anon key is safe to be public.
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};
