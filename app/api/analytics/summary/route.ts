import { NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET() {
  try {
    // Verify authenticated user
    const { user } = await getSession();

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();

    // Fetch all documents with explicit typing
    const { data, error } = await supabase
      .from('documents')
      .select('status, type');

    const documents = (data ?? []) as { status: string; type: string }[];

    if (error) {
      return NextResponse.json(
        { error: 'Failed to fetch documents' },
        { status: 500 }
      );
    }

    // Count by status
    const byStatus: Record<string, number> = {};
    documents.forEach((doc) => {
      byStatus[doc.status] = (byStatus[doc.status] || 0) + 1;
    });

    // Count by type
    const byType: Record<string, number> = {};
    documents.forEach((doc) => {
      byType[doc.type] = (byType[doc.type] || 0) + 1;
    });

    return NextResponse.json({
      byStatus,
      byType,
      total: documents.length,
    });
  } catch {
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
