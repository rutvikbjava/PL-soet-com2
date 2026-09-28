# College Workflow Automation SaaS

Next.js 14 + Supabase application for managing document workflows with role-based approvals.

## Environment Variables

### Where to Find Supabase Keys

1. Go to your Supabase project dashboard
2. Navigate to **Project → Settings → API**
3. Copy the keys from this page

### Environment Variable Mapping

| Variable | Supabase Key |
|----------|-------------|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon public key |
| `SUPABASE_SERVICE_ROLE_KEY` | service_role secret key |

### ⚠️ Important Security Warning

**NEVER** add the `NEXT_PUBLIC_` prefix to `SUPABASE_SERVICE_ROLE_KEY`. This key must remain server-side only. Variables with the `NEXT_PUBLIC_` prefix are exposed to the browser and should only be used for public keys.

## Setup on Vercel

### Adding Environment Variables

1. Go to your Vercel project dashboard
2. Navigate to **Project → Settings → Environment Variables**
3. Add all three environment variables with their values:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
4. Select which environments (Production, Preview, Development) should have access to each variable

## Database Migration

### Run the SQL Migration in Supabase

1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor** in the left sidebar
3. Click **New Query**
4. Open `supabase/migrations/20240101000000_initial_schema.sql` from this repository
5. Copy the entire SQL content
6. Paste it into the SQL Editor
7. Click **Run** or press `Ctrl+Enter` to execute the migration

This will create all necessary tables, indexes, and relationships in your database.

## Deploy to Vercel

Deploy with a single command:

```bash
npx vercel --prod
```

This command will:
- Build your Next.js application
- Deploy to Vercel's production environment
- Use the environment variables configured in your Vercel project settings


ok but there is an thing after approving or rejecting there is no record showed on dashboard and what approvals are been arrived at that perticular user and there i want to add a new thing to reject witha comment soo that a applicant can track the issue and also one thing that when a new document is uploaded the audit trail is only showing that perticular document trails but i want user specific trails that what activities happening in his login and what activities are done over his uploaded document