import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

// Mark route as dynamic to prevent static generation
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify user authentication
    const { user } = await getSession();
    
    if (!user) {
      return NextResponse.json({
        documents: [],
        assignments: [],
      });
    }

    // Get search query from URL params
    const searchParams = request.nextUrl.searchParams;
    const q = searchParams.get('q') || '';

    // If query is empty or too short, return empty results
    if (q.length < 2) {
      return NextResponse.json({
        documents: [],
        assignments: [],
      });
    }

    const adminClient = createAdminClient();

    // Search documents
    const { data: documentsData, error: documentsError } = await (adminClient
      .from('documents') as any)
      .select('id, title, type, status')
      .ilike('title', `%${q}%`)
      .limit(6);

    if (documentsError) {
      console.error('Documents search error:', documentsError);
    }

    // Search assignments
    const { data: assignmentsData, error: assignmentsError } = await (
      adminClient.from('assignments' as any) as any
    )
      .select('id, title, type')
      .ilike('title', `%${q}%`)
      .limit(6);

    if (assignmentsError) {
      console.error('Assignments search error:', assignmentsError);
    }

    return NextResponse.json({
      documents: documentsData ?? [],
      assignments: assignmentsData ?? [],
    });
  } catch (error) {
    console.error('Search error:', error);
    return NextResponse.json({
      documents: [],
      assignments: [],
    });
  }
}
