import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { getSignedUrl } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    // Verify authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get the path from query params
    const searchParams = request.nextUrl.searchParams;
    const path = searchParams.get('path');

    if (!path) {
      return NextResponse.json({ error: 'Missing path parameter' }, { status: 400 });
    }

    // Get signed URL for the document
    const url = await getSignedUrl('documents', path);

    if (!url) {
      return NextResponse.json({ error: 'Failed to generate signed URL' }, { status: 500 });
    }

    return NextResponse.json({ url });
  } catch (error) {
    console.error('Signed URL generation error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
