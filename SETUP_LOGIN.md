# Turning on "Sign in with Google" (Supabase)

You do these steps yourself, in your own accounts. It takes about 20 minutes.
**Never paste these into chat or into the code:** your Supabase database password, the Google *Client secret*,
or Supabase's *service_role / secret* key. The only two values the game needs are public by design.

---

## Part A — Create the Supabase project

1. Go to <https://supabase.com> and sign in (create a free account if you don't have one).
2. Click **New project**.
   - Name: `maydan` (any name is fine).
   - Database password: let it generate one and save it in your password manager. The game never needs it.
   - Region: pick the one closest to your players.
   - Click **Create new project** and wait 1–2 minutes.
3. Create the history table:
   - Left menu → **SQL Editor** → **New query**.
   - Open the file `supabase/schema.sql` from this project, copy everything, paste it, click **Run**.
   - You should see "Success. No rows returned".
4. Find the two public values:
   - Left menu → **Project Settings** (gear) → **API** (on newer dashboards: **Data API** and **API Keys**).
   - Copy the **Project URL** (looks like `https://abcdxyz.supabase.co`).
   - Copy the **anon public** key (on newer dashboards it's called the **publishable** key, starting with `sb_publishable_`).
   - ⚠️ Do **not** copy the `service_role` / `secret` key.
5. Keep that page open. You'll also need the Google callback address from Part B, step 5.

## Part B — Create the Google sign-in keys

1. Go to <https://console.cloud.google.com> and sign in with the Google account that will own the app.
2. At the top, click the project picker → **New project** → name it `Maydan` → **Create**, then select it.
3. Left menu → **Google Auth Platform** (older name: **APIs & Services → OAuth consent screen**) → **Get started**.
   - App name: `ميدان` (or the real name later). User support email: your email.
   - Audience: **External**. Contact email: your email. Agree and **Create**.
4. Go to **Clients** → **Create client**.
   - Application type: **Web application**. Name: `Maydan web`.
   - **Authorized JavaScript origins** → add `http://localhost:8080`
     (later, when the site is on GitHub Pages, also add `https://YOUR-GITHUB-NAME.github.io`).
5. **Authorized redirect URIs** → add the Supabase callback address:
   - In Supabase: **Authentication** → **Sign In / Providers** → **Google**. Copy the **Callback URL (for OAuth)**,
     which looks like `https://abcdxyz.supabase.co/auth/v1/callback`.
   - Paste it into Google, then click **Create**.
6. Google now shows a **Client ID** and a **Client secret**.
   - In Supabase (same Google provider page): turn **Enable Sign in with Google** on, paste the **Client ID**
     and the **Client secret**, then **Save**.
   - The secret only goes into the Supabase dashboard. It never goes into the code or the chat.
7. While the Google app is in "Testing" mode, only accounts you add under **Audience → Test users** can sign in.
   Add your own Gmail there. Before launch, click **Publish app**.

## Part C — Tell Supabase where the game lives

1. Supabase → **Authentication** → **URL Configuration**.
2. **Site URL**: `http://localhost:8080` (change it to your GitHub Pages address at launch).
3. **Redirect URLs** → **Add URL**:
   - `http://localhost:8080/**`
   - later: `https://YOUR-GITHUB-NAME.github.io/REPO-NAME/**`
4. **Save**.

## Part D — Connect the game

Open `js/config.js` and fill in the two public values from Part A step 4:

```js
SUPABASE_URL: 'https://abcdxyz.supabase.co',
SUPABASE_ANON_KEY: 'eyJ…  or  sb_publishable_…',
```

Then start the game (`python tools/dev_server.py`), open <http://localhost:8080>, and click **الدخول بحساب Google**.
Tell Claude when it's done so the sign-in can be tested together.

### What changes once login is on
- Guests get **1 free game** (`GUEST_FREE_GAMES` in `js/config.js`). After that, the game asks them to sign in.
  (This limit is stored in the browser, so a determined guest can get around it. That's fine for a free game;
  paid games will be checked on the server with Stripe + Supabase.)
- Signed-in players' "already played" history is saved in Supabase, so it follows them to any device.
- `review.html` only opens for `OWNER_EMAIL` (your Gmail).
