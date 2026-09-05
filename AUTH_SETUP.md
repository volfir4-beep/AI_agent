# Authentication setup

This project now uses Supabase Auth for email/password login and stores completed interview scorecards in the Supabase `interviews` table.

## 1. Install dependencies

From the project root run:

```bash
npm install
```

The source package-lock was based on the pre-auth project, so `npm install` is intentional here; it will resolve the two added Supabase packages and update the lockfile.

## 2. Create a Supabase project

Create a project in Supabase and open **Project Settings → API**.

Copy the project URL and the public/publishable key into `.env.local`:

```env
NEXT_PUBLIC_SUPABASE_URL=your-project-url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-public-anon-key
```

Keep server-only Agora and n8n secrets in `.env.local` as before. Never commit `.env.local`.

## 3. Create the database table

Open **SQL Editor** in Supabase and run the complete `supabase-schema.sql` file from this project.

The table has Row Level Security policies so a signed-in user can only read/write their own interview records.

## 4. Email confirmation

For the easiest local/demo flow, you can disable email confirmation in Supabase Auth settings.

If email confirmation remains enabled, the signup page already sends users to:

`/auth/callback`

after they click the confirmation link.

## 5. Run the app

```bash
npm run dev
```

Then open:

`http://localhost:3000`

The root interview page is protected. Users must sign in first.

## What is persisted

The browser session is handled by Supabase Auth, so restarting Next.js does not log the user out.

When an interview finishes, the final scorecard is saved to `public.interviews`.

The dashboard at `/dashboard` loads the user's saved interviews from Supabase. Each history item opens its complete scorecard at `/dashboard/interview/[id]`.

The live interview session itself is still held in the existing in-memory session store. That means a server restart during an active interview can interrupt that active interview, but completed scorecards remain safely stored in Supabase.
