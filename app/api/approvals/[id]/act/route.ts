import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@/lib/supabase';
import { getSession } from '@/lib/auth';
import { sendNotification } from '@/lib/notify';

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const approvalId = params.id;
    const body = await request.json();
    const { action, signature_url, comment } = body;

    // Validate action
    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject".' },
        { status: 400 }
      );
    }

    // Validate signature_url for approve action
    if (action === 'approve' && !signature_url) {
      return NextResponse.json(
        { error: 'signature_url is required when approving.' },
        { status: 400 }
      );
    }

    // Verify authenticated user
    const { user, role } = await getSession(request);
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = createServerClient();

    // Fetch the approval row
    const { data: approval, error: fetchError } = await supabase
      .from('approvals')
      .select('*, workflows!inner(document_id)')
      .eq('id', approvalId)
      .eq('approver_id', user.id)
      .single();

    if (fetchError || !approval) {
      return NextResponse.json(
        { error: 'Approval not found or access denied.' },
        { status: 404 }
      );
    }

    // Verify approval is pending
    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: 'Approval has already been processed.' },
        { status: 400 }
      );
    }

    const documentId = approval.workflows.document_id;
    const now = new Date().toISOString();

    // Update the approval row
    const updateData: any = {
      status: action,
      acted_at: now,
    };

    if (action === 'approve') {
      updateData.signature_url = signature_url;
      updateData.signed_at = now;
    }

    if (comment) {
      updateData.comment = comment;
    }

    const { error: updateError } = await supabase
      .from('approvals')
      .update(updateData)
      .eq('id', approvalId);

    if (updateError) {
      return NextResponse.json(
        { error: 'Failed to update approval.' },
        { status: 500 }
      );
    }

    let documentStatus = 'pending';

    // Handle rejection
    if (action === 'reject') {
      // Update document status to rejected
      const { error: docUpdateError } = await supabase
        .from('documents')
        .update({ status: 'rejected' })
        .eq('id', documentId);

      if (docUpdateError) {
        return NextResponse.json(
          { error: 'Failed to update document status.' },
          { status: 500 }
        );
      }

      documentStatus = 'rejected';

      // Insert audit log for rejection
      const { error: auditError } = await supabase
        .from('audit_logs')
        .insert({
          document_id: documentId,
          user_id: user.id,
          action: 'document_rejected',
          metadata: {
            approval_id: approvalId,
            comment: comment || null,
          },
        });

      if (auditError) {
        console.error('Failed to insert audit log:', auditError);
      }

      // Fetch document to get creator_id for notification
      const { data: document } = await supabase
        .from('documents')
        .select('creator_id')
        .eq('id', documentId)
        .single();

      if (document) {
        await sendNotification(
          document.creator_id,
          'approval_rejected',
          `Your document has been rejected by ${role}.${comment ? ` Comment: ${comment}` : ''}`,
          documentId
        );
      }
    }

    // Handle approval
    if (action === 'approve') {
      // Fetch all approvals for the same workflow
      const { data: allApprovals, error: fetchAllError } = await supabase
        .from('approvals')
        .select('id, status, step_order')
        .eq('workflow_id', approval.workflow_id)
        .order('step_order');

      if (fetchAllError || !allApprovals) {
        return NextResponse.json(
          { error: 'Failed to fetch workflow approvals.' },
          { status: 500 }
        );
      }

      // Check if all approvals are approved
      const allApproved = allApprovals.every(
        (appr) => appr.status === 'approved'
      );

      if (allApproved) {
        // Update document status to approved
        const { error: docUpdateError } = await supabase
          .from('documents')
          .update({ status: 'approved' })
          .eq('id', documentId);

        if (docUpdateError) {
          return NextResponse.json(
            { error: 'Failed to update document status.' },
            { status: 500 }
          );
        }

        documentStatus = 'approved';

        // Insert audit log for document approval
        const { error: auditError } = await supabase
          .from('audit_logs')
          .insert({
            document_id: documentId,
            user_id: user.id,
            action: 'document_approved',
            metadata: {
              approval_id: approvalId,
            },
          });

        if (auditError) {
          console.error('Failed to insert audit log:', auditError);
        }

        // Notify document creator
        const { data: document } = await supabase
          .from('documents')
          .select('creator_id')
          .eq('id', documentId)
          .single();

        if (document) {
          await sendNotification(
            document.creator_id,
            'document_approved',
            `Your document has been fully approved and is now complete.`,
            documentId
          );
        }
      } else {
        // Not all approved yet - step approval
        documentStatus = 'pending';

        // Insert audit log for step approval
        const { error: auditError } = await supabase
          .from('audit_logs')
          .insert({
            document_id: documentId,
            user_id: user.id,
            action: 'step_approved',
            metadata: {
              approval_id: approvalId,
              step_order: approval.step_order,
            },
          });

        if (auditError) {
          console.error('Failed to insert audit log:', auditError);
        }

        // Notify document creator of step approval
        const { data: document } = await supabase
          .from('documents')
          .select('creator_id')
          .eq('id', documentId)
          .single();

        if (document) {
          await sendNotification(
            document.creator_id,
            'step_approved',
            `Your document has been approved by ${role} (step ${approval.step_order}). Awaiting further approvals.`,
            documentId
          );
        }
      }
    }

    // Fetch updated approval for response
    const { data: updatedApproval } = await supabase
      .from('approvals')
      .select('*')
      .eq('id', approvalId)
      .single();

    return NextResponse.json({
      approval: updatedApproval,
      documentStatus,
    });
  } catch (error) {
    console.error('Error processing approval action:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
