import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    // Verify user authentication
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const assignmentId = params.id;
    const adminClient = createAdminClient();

    // Find existing submission
    const { data: existingSubmission, error: fetchError } = await (adminClient as any)
      .from('submissions')
      .select('id')
      .eq('assignment_id', assignmentId)
      .eq('student_email', session.user.email)
      .single();

    // If found, update submitted_via to 'link' and status to 'submitted'
    if (!fetchError && existingSubmission) {
      const { error: updateError } = await (adminClient as any)
        .from('submissions')
        .update({ 
          submitted_via: 'link',
          status: 'submitted'
        })
        .eq('id', existingSubmission.id);

      if (updateError) {
        console.error('Failed to update submission:', updateError);
        return NextResponse.json(
          { error: 'Failed to mark as submitted' },
          { status: 500 }
        );
      }

      return NextResponse.json({ success: true });
    }

    // If not found, insert new row
    const { error: insertError } = await (adminClient as any)
      .from('submissions')
      .insert({
        assignment_id: assignmentId,
        student_email: session.user.email,
        file_url: '',
        file_name: '',
        attempt: 1,
        status: 'submitted',
        submitted_via: 'link',
        link_opened_at: new Date().toISOString(),
      });

    if (insertError) {
      console.error('Failed to create submission:', insertError);
      return NextResponse.json(
        { error: 'Failed to mark as submitted' },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Mark submitted error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
