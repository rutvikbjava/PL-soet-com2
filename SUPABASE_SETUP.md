# Supabase Setup Guide

## ✅ Completed Steps

1. ✓ Created migration file: `supabase/migrations/20240101000000_initial_schema.sql`
2. ✓ Authenticated with Supabase CLI (`supabase login`)
3. ✓ Linked to project: `rbaibedjwqmhjottoonw`
4. ✓ Applied migration to remote database (`supabase db push`)
5. ✓ Generated TypeScript types from database: `types/database.ts`
6. ✓ Installed Supabase agent skills
7. ✓ Verified migration status - Local and Remote in sync

---

## 🎉 Database is Live!

Your database is now fully set up with all tables, indexes, and relationships.

**Verification:**
```bash
supabase migration list --linked
```

**Output:**
```
   Local            | Remote           | Time (UTC)            
  ------------------|------------------|-----------------------
   20240101000000   | 20240101000000   | 2024-01-01 00:00:00
```

✓ Both local and remote show the same migration timestamp

---

## 📊 Database Schema Overview

### Tables Created

1. **users** - System users with role-based access
   - Roles: faculty, hod, coe, principal, admin
   - Fields: email, full_name, role, department

2. **documents** - Documents requiring approval workflows
   - Types: notice, timetable, exam_schedule, policy
   - Scopes: department, college, institution
   - Statuses: draft, pending, approved, rejected

3. **workflows** - Generated approval workflows
   - Contains JSONB steps for dynamic workflow generation
   - Linked to documents

4. **approvals** - Individual approval steps
   - Tracks who approved, when, and with what comments
   - Ordered by step_order

5. **audit_logs** - System-wide audit trail
   - Tracks all actions with JSONB metadata

6. **notifications** - User notifications
   - Read/unread status for pending actions

---

## 🔧 Next Steps

### 1. Set Up Environment Variables

Create `.env.local` file in your project root:

```env
NEXT_PUBLIC_SUPABASE_URL=https://rbaibedjwqmhjottoonw.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
```

Get your anon key from: https://supabase.com/dashboard/project/rbaibedjwqmhjottoonw/settings/api

### 2. Create Supabase Client Files

You'll need:
- `lib/supabase/client.ts` - Browser client
- `lib/supabase/server.ts` - Server-side client
- `lib/supabase/middleware.ts` - Auth middleware

### 3. Optional: Set Up Row Level Security (RLS)

After applying the migration, consider adding RLS policies for:
- Users can only see their own data
- Role-based access (faculty, hod, coe, principal, admin)
- Document visibility based on department/scope

### 4. Optional: Add Seed Data

Create sample users and test documents for development.

---

## 📚 Type Usage Examples

```typescript
import { User, Document, Workflow } from '@/types/database'

// Using table types
const user: User = {
  id: '...',
  email: 'faculty@college.edu',
  full_name: 'John Doe',
  role: 'faculty',
  department: 'Computer Science',
  created_at: '2024-01-01T00:00:00Z'
}

// Using insert types
const newDoc: DocumentInsert = {
  title: 'Exam Schedule - Fall 2024',
  type: 'exam_schedule',
  creator_id: user.id,
  scope: 'college',
  status: 'draft'
}
```

---

## 🛠️ Helpful Commands

```bash
# Check database status
supabase db dump --data-only

# Reset local database (careful!)
supabase db reset

# View migration history
supabase migration list

# Create a new migration
supabase migration new migration_name
```

---

## 📖 Resources

- [Supabase Documentation](https://supabase.com/docs)
- [Next.js with Supabase SSR](https://supabase.com/docs/guides/auth/server-side/nextjs)
- [TypeScript Types](https://supabase.com/docs/guides/api/generating-types)
