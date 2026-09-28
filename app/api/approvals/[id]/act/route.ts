import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { user } = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const approvalId = params.id
    const body = await request.json()
    const { action, signature_url, comment } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    const supabase = createAdminClient()

    const { data: approval } = await supabase
      .from('approvals')
      .select('id, status, workflow_id, step_order')
      .eq('id', approvalId)
      .single()

    if (!approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 })
    }

    if (approval.status !== 'pending') {
      return NextResponse.json({ error: 'Approval already acted on' }, { status: 400 })
    }

    const { data: workflow } = await supabase
      .from('workflows')
      .select('id, document_id')
      .eq('id', approval.workflow_id)
      .single()

    if (!workflow || !workflow.document_id) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 })
    }

    const documentId = workflow.document_id
    const workflowId = workflow.id
    const now = new Date().toISOString()

    const updateData: {
      status: string
      acted_at: string
      signature_url?: string
      signed_at?: string
      comment?: string
    } = {
      status: action === 'approve' ? 'approved' : 'rejected',
      acted_at: now,
    }

    if (action === 'approve' && signature_url) {
      updateData.signature_url = signature_url
      updateData.signed_at = now
    }

    if (comment) {
      updateData.comment = comment
    }

    const { error: updateError } = await (supabase as any)
      .from('approvals')
      .update(updateData)
      .eq('id', approvalId)

    if (updateError) {
      console.error('Update approval error:', JSON.stringify(updateError))
      return NextResponse.json(
        { error: 'Failed to update approval' },
        { status: 500 }
      )
    }

    let documentStatus = 'pending'

    if (action === 'reject') {
      await supabase
        .from('documents')
        .update({ status: 'rejected' })
        .eq('id', documentId)

      documentStatus = 'rejected'

      await supabase
        .from('audit_logs')
        .insert({
          document_id: documentId,
          actor_id: user.id,
          action: 'document_rejected',
          metadata: { 
            approval_id: approvalId, 
            comment: comment ?? null 
          }
        })
    } else {
      const { data: allApprovals } = await supabase
        .from('approvals')
        .select('status')
        .eq('workflow_id', workflowId)

      const allApproved = allApprovals?.every(
        (a: { status: string }) => a.status === 'approved'
      )

      if (allApproved) {
        await supabase
          .from('documents')
          .update({ status: 'approved' })
          .eq('id', documentId)

        documentStatus = 'approved'

        await supabase
          .from('audit_logs')
          .insert({
            document_id: documentId,
            actor_id: user.id,
            action: 'document_approved',
            metadata: { approval_id: approvalId }
          })
      } else {
        await supabase
          .from('audit_logs')
          .insert({
            document_id: documentId,
            actor_id: user.id,
            action: 'step_approved',
            metadata: {
              approval_id: approvalId,
              step_order: approval.step_order
            }
          })
      }
    }

    await supabase
      .from('notifications')
      .insert({
        user_id: user.id,
        message: action === 'approve'
          ? 'Document step approved successfully'
          : 'Document has been rejected',
        document_id: documentId,
        read: false
      })

    return NextResponse.json({
      success: true,
      documentStatus,
      approvalId
    })
  } catch (err) {
    console.error('Approval act error:', err)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
