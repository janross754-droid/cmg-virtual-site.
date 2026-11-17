CMG VIRTUAL — FOUR-STEP WEBSITE UPDATE

WHAT THIS UPDATE CHANGES
- Uses the existing CMG VIRTUAL Supabase project and publishable key supplied for the live website.
- Starts in the clean light theme; visitors can switch to dark mode with the theme button.
- Opens at Step 1 of 4: create account (full name, email, Ghana +233 phone, password and confirm password).
- Step 2 is a separate customer dashboard with a greeting, token balance, Buy Tokens button and the LIVE GAMES / Spin the Bottle / Aviator service cards.
- Step 3 shows Starter, Pro and Elite packages vertically, one full-width card under another. There is no horizontal package scrolling.
- Step 4 collects sender name, sender MoMo number, optional transaction ID and a required payment screenshot.
- Payment requests remain pending until an administrator verifies the money and approves them. Only approval credits tokens.
- Admin payment requests show sender details and a private, time-limited link to the uploaded payment screenshot.
- Existing screenshot analysis, prediction history, Netlify functions and one-token debit flow are retained.

DEPLOY
1. Deploy the contents of this ZIP to the same Netlify site/project as the current CMG VIRTUAL website. Upload the files inside the ZIP at the site root (index.html, styles.css, app.js and the netlify folder).
2. Do not create a new Netlify site unless you intend to reconfigure the domain and environment variables.
3. Keep the existing Netlify environment variables. They must point to the same Supabase project used by the browser app:
   - SUPABASE_URL = https://uhxcporbimiswpaqnoww.supabase.co
   - SUPABASE_ANON_KEY = the matching publishable key for this same project (the browser app is already configured with the project publishable key)
   - SUPABASE_SERVICE_ROLE_KEY = the private service-role/secret key (never put this in browser code)
   - OPENAI_API_KEY = your private OpenAI API key
   - OPENAI_MODEL = gpt-4.1-mini (optional)
4. Trigger a new deploy after the upload.

ONE-TIME SUPABASE DATABASE SETUP
1. Open the SAME Supabase project used by the live website.
2. Open SQL Editor > New query.
3. Open the file supabase-step-flow-migration.sql from this ZIP, copy all its contents into the SQL Editor and run it once.
4. This adds profile/payment fields, configures the private payment-proof bucket and sets the three package amounts:
   - Starter Plan: 5 tokens for GH₵10
   - Pro Plan: 15 tokens for GH₵20
   - Elite Plan: 50 tokens for GH₵30
5. The migration does not change existing profile roles or existing token balances.

MTN MOMO DETAILS SHOWN TO CUSTOMERS
- Network: MTN Mobile Money
- Number: 0550204222
- Account name: PRINCE AFFUL

ADMIN
- Sign in with the existing administrator account. The Admin Dashboard appears only for profiles whose role is 'admin'.
- Refresh the payment queue to see submissions, sender name/number, transaction ID, package, amount and screenshot proof.
- Independently confirm receipt in the MoMo account before pressing Approve & credit.
- Approving uses the existing approve_payment database function. Rejecting does not add tokens.

IMPORTANT TESTS BEFORE ACCEPTING PAYMENTS
- Test a new signup and email confirmation (if enabled in Supabase Auth).
- Test login with an existing user and administrator account.
- Submit a test payment request and confirm it appears in the admin queue with screenshot proof.
- Verify approve and reject behavior and confirm only approval adds tokens.
- Test screenshot analysis and confirm one token is deducted only after successful analysis.

SECURITY / RESPONSIBLE USE
- The payment-proof bucket is private; admin links expire after one hour.
- Never share your Supabase service-role key or OpenAI API key.
- Virtual game outcomes are unpredictable. AI analysis is informational and cannot guarantee a win or identify a guaranteed/safe bet. 18+ only; gamble responsibly.
