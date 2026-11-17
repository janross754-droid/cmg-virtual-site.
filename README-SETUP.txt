CMG VIRTUAL — SETUP GUIDE

This ZIP is a fresh website project. It is designed to be deployed to Netlify.

1) NETLIFY DEPLOY
- Upload the contents of this ZIP as a project to Netlify.
- Netlify should detect netlify.toml and deploy the functions in netlify/functions.

2) NETLIFY ENVIRONMENT VARIABLES
In Netlify: Site configuration > Environment variables, add:
- SUPABASE_URL = https://qusfqdtnfxbbubcekroc.supabase.co
- SUPABASE_ANON_KEY = your Supabase publishable key (the sb_publishable_... key)
- SUPABASE_SERVICE_ROLE_KEY = your Supabase secret/service-role key (KEEP PRIVATE; never put it in browser files or share it)
- OPENAI_API_KEY = your private OpenAI API key (KEEP PRIVATE)
Optional:
- OPENAI_MODEL = gpt-4.1-mini

After adding/changing variables, trigger a new deploy.

3) SUPABASE AUTH URLS
In Supabase > Authentication > URL Configuration:
- Site URL: your Netlify production URL
- Add that same URL to Redirect URLs.
For deploy previews, add the preview URL pattern if you plan to use previews.

4) MAKE YOUR FIRST USER AN ADMIN
- First create an account through the website and confirm the email if confirmation is enabled.
- In Supabase SQL Editor, run this command using the exact email you registered:
  update public.profiles
  set role = 'admin'
  where email = 'YOUR-REGISTERED-EMAIL';
- Replace the placeholder with your own email. Do not share your email or password here.
- Log out and log back in.

5) IMPORTANT
- The database SQL schema was created in the previous setup step. If you create another Supabase project, you must run that SQL schema there too.
- Never expose the Supabase service-role key or OpenAI API key in app.js, index.html, screenshots, or chat.
- The Starter Package is GH₵50 for 10 credits in the database. Change it in Supabase if you want a different package.
- The customer payment page displays MTN MoMo number 0550204222, account name PRINCE AFFUL. Confirm these details in your own MoMo account before accepting payments.
- Admin Dashboard appears after an administrator signs in. Refresh Payment Review to load requests. After independently confirming the payment in MoMo, choose “Approve & credit N tokens”; the existing approve_payment database function adds the package tokens to that customer once. Never approve based only on a submitted reference.
- Payment references are submitted for manual verification. Do not approve a payment until you have independently confirmed receipt.
- AI screenshot analysis is not a prediction guarantee. Virtual football outcomes are unpredictable; the AI can read visible data and explain odds/risk but cannot produce guaranteed winning bets.
- Test signup, login, reset password, payment submission, admin approval and screenshot analysis before accepting users or payments.
