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

  // Helpers (each team can use each one once per game)
  BREATHER_SECONDS: 20, // نَفَس adds this many seconds
  HELPERS: [
    { id: 'bet', name: 'الرهان', when: 'board', desc: 'قبل فتح السؤال: الإجابة الصحيحة بضعف النقاط، والخطأ يخصمها' },
    { id: 'breather', name: 'نَفَس', when: 'question', desc: 'يضيف ثوانٍ إلى وقتكم' },
    { id: 'glimpse', name: 'لمحة', when: 'question', desc: 'يكشف أول حرف من الإجابة وعدد حروفها' },
  ],

  // Board layout: how many questions of each points value per category
  BOARD: [
    { difficulty: 'easy', points: 200, count: 2 },
    { difficulty: 'medium', points: 400, count: 2 },
    { difficulty: 'hard', points: 600, count: 2 },
  ],
  CATEGORIES_PER_TEAM: 3,

  // Your own review (review.html). false = play every fact-checked question except ones you marked wrong.
  // Set to true before launch so the game only uses questions you approved.
  REQUIRE_REVIEW: false,

  // Only this account can open review.html
  OWNER_EMAIL: 'owner@example.com',

  // Supabase (filled in at step 6). The anon key is safe to be public.
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};
