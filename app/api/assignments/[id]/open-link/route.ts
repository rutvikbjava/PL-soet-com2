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

    // Check if submission already exists for this student
    const { data: existingSubmission, error: fetchError } = await (adminClient as any)
      .from('submissions')
      .select('id, link_opened_at')
      .eq('assignment_id', assignmentId)
      .eq('student_email', session.user.email)
      .single();

    // If no existing submission, create new one
    if (fetchError || !existingSubmission) {
      const { error: insertError } = await (adminClient as any)
        .from('submissions')
        .insert({
          assignment_id: assignmentId,
          student_email: session.user.email,
          file_url: '',
          file_name: '',
          attempt: 1,
          status: 'pending',
          link_opened_at: new Date().toISOString(),
        });

      if (insertError) {
        console.error('Failed to create submission:', insertError);
        return NextResponse.json(
          { error: 'Failed to record link access' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        already_opened: false,
      });
    }

    // If existing submission and link_opened_at is null, update it
    if (existingSubmission.link_opened_at === null) {
      const { error: updateError } = await (adminClient as any)
        .from('submissions')
        .update({ link_opened_at: new Date().toISOString() })
        .eq('id', existingSubmission.id);

      if (updateError) {
        console.error('Failed to update link_opened_at:', updateError);
        return NextResponse.json(
          { error: 'Failed to record link access' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        already_opened: false,
      });
    }

    // Link was already opened before
    return NextResponse.json({
      success: true,
      already_opened: true,
    });
  } catch (error) {
    console.error('Open link error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
