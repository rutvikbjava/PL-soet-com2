import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';

export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse JSON body
    const body = await request.json();
    const { document_id } = body;

    if (!document_id) {
      return NextResponse.json({ error: 'Missing document_id' }, { status: 400 });
    }

    // Initialize Supabase admin client
    const supabase = createAdminClient();

    // Fetch the document from documents table
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', document_id)
      .single();

    if (docError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check document status is 'approved'
    if (document.status !== 'approved') {
      return NextResponse.json(
        { error: 'Document must be approved before publishing' },
        { status: 400 }
      );
    }

    // Check is_published is false
    if ((document as any).is_published) {
      return NextResponse.json({ error: 'Notice already published' }, { status: 400 });
    }

    // Update the document
    const published_at = new Date().toISOString();
    const { error: updateError } = await supabase
      .from('documents')
      .update({
        is_published: true,
        published_at,
      } as any)
      .eq('id', document_id);

    if (updateError) {
      console.error('Document update error:', updateError);
      return NextResponse.json({ error: 'Failed to publish notice' }, { status: 500 });
    }

    // Fetch all notice_recipients for this document
    const { data: recipients, error: recipientsError } = await (supabase as any)
      .from('notice_recipients')
      .select('*')
      .eq('document_id', document_id);

    if (recipientsError) {
      console.error('Recipients fetch error:', recipientsError);
      return NextResponse.json({ error: 'Failed to fetch recipients' }, { status: 500 });
    }

    // Collect unique user IDs
    const uniqueUserIds = new Set<string>();

    if (recipients && recipients.length > 0) {
      // Separate role and department recipients
      const roleRecipients = recipients.filter((r: any) => r.recipient_type === 'role');
      const departmentRecipients = recipients.filter((r: any) => r.recipient_type === 'department');

      // Fetch users whose role matches any recipient_type: 'role' rows
      if (roleRecipients.length > 0) {
        const roles = roleRecipients.map((r: any) => r.recipient_value);
        const { data: usersByRole, error: roleError } = await supabase
          .from('users')
          .select('id')
          .in('role', roles);

        if (roleError) {
          console.error('Users by role fetch error:', roleError);
        } else if (usersByRole) {
          usersByRole.forEach((u) => uniqueUserIds.add(u.id));
        }
      }

      // Fetch users whose department matches any recipient_type: 'department' rows
      if (departmentRecipients.length > 0) {
        const departments = departmentRecipients.map((r: any) => r.recipient_value);
        const { data: usersByDepartment, error: deptError } = await supabase
          .from('users')
          .select('id')
          .in('department', departments);

        if (deptError) {
          console.error('Users by department fetch error:', deptError);
        } else if (usersByDepartment) {
          usersByDepartment.forEach((u) => uniqueUserIds.add(u.id));
        }
      }
    }

    // Insert a notification for each unique user
    const userIdsArray = Array.from(uniqueUserIds);
    const notificationInserts = userIdsArray.map((user_id) => ({
      user_id,
      message: `New notice published: ${document.title}`,
      document_id,
      read: false,
    }));

    if (notificationInserts.length > 0) {
      const { error: notificationsError } = await supabase
        .from('notifications')
        .insert(notificationInserts);

      if (notificationsError) {
        console.error('Notifications insert error:', notificationsError);
        return NextResponse.json({ error: 'Failed to create notifications' }, { status: 500 });
      }
    }

    // Insert audit_log
    const { error: auditError } = await supabase.from('audit_logs').insert({
      document_id,
      actor_id: session.user.id,
      action: 'notice_published',
      metadata: {
        document_id,
        published_at,
        recipient_count: userIdsArray.length,
      } as any,
    } as any);

    if (auditError) {
      console.error('Audit log insert error:', auditError);
    }

    // Return success response
    return NextResponse.json({
      success: true,
      published_at,
    });
  } catch (error) {
    console.error('Notice publish error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
