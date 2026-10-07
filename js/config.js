// ============================================================
//  SETTINGS — change these freely
// ============================================================

export const CONFIG = {
  // Placeholder name until the real one is chosen
  GAME_NAME: 'ميدان',

  // The public address of the game (shown after "نشر التحديثات" in the admin panel)
  SITE_URL: 'https://trivia-game-1br.pages.dev/',

  // No time limit: each question has a stopwatch that counts up from 0:00 and the host
  // pauses / resumes / resets it. The host passes a question to the other team with "سرقة".

  // Helpers (each team can use each one once per game)
  HELPERS: [
    { id: 'bet', name: 'الرهان', when: 'board', desc: 'قبل فتح السؤال: الإجابة الصحيحة بضعف النقاط، والخطأ يخصمها' },
    { id: 'swap', name: 'تبديل', when: 'question', desc: 'يستبدل السؤال بسؤال آخر من الفئة نفسها وبالنقاط نفسها' },
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
  REQUIRE_REVIEW: true,

  // Guests (not signed in) can play this many full games, then must sign in.
  // Only enforced once Supabase is configured below.
  GUEST_FREE_GAMES: 1,

  // Only this account can open review.html.
  // Stored as a SHA-256 fingerprint (not the email itself) because this file is public.
  // To change owner: python -c "import hashlib;print(hashlib.sha256('you@example.com'.lower().encode()).hexdigest())"
  OWNER_EMAIL_SHA256: 'baad4e43edd317eb67f19338d4b17ec17e3fcb72b38de175ae7d7575c0e04b76',

  // Supabase: Project Settings → API. Paste the Project URL and the "anon public" key.
  // The anon key is meant to be public (security comes from row-level security rules).
  SUPABASE_URL: '',
  SUPABASE_ANON_KEY: '',
};
