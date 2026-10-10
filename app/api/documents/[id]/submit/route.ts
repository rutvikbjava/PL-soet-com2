import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import type { WorkflowStep, ApprovalInsert } from '@/types/database'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // Get authenticated session
    const { user } = await getSession()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get document ID from route params
    const { id: documentId } = await params

    if (!documentId) {
      return NextResponse.json(
        { error: 'Document ID is required' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Fetch the document
    const { data, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single()

    const document = data as any

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Verify the user is the document creator
    if (document.creator_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You can only submit your own documents' },
        { status: 403 }
      )
    }

    // Check if document is in draft status
    if (document.status !== 'draft') {
      return NextResponse.json(
        { error: `Document is already ${document.status}. Only draft documents can be submitted.` },
        { status: 400 }
      )
    }

    // Fetch the workflow for this document
    const { data: workflowData, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('document_id', documentId)
      .single()

    const workflow = workflowData as any

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found for this document' },
        { status: 404 }
      )
    }

    // Parse workflow steps from JSONB
    const workflowSteps = workflow.generated_steps as WorkflowStep[]

    if (!workflowSteps || workflowSteps.length === 0) {
      return NextResponse.json(
        { error: 'No workflow steps found' },
        { status: 400 }
      )
    }

    // Fetch users by required roles for approval steps
    const requiredRoles = workflowSteps.map(step => step.requiredRole)
    const { data: approversData, error: approversError } = await supabase
      .from('users')
      .select('id, role')
      .in('role', requiredRoles)
      .or('status.is.null,status.eq.active')

    const approvers = (approversData ?? []) as any[]

    if (approversError || approvers.length === 0) {
      return NextResponse.json(
        { error: 'No approvers found for the required roles' },
        { status: 500 }
      )
    }

    // Create a map of role to user ID (take first user for each role)
    const roleToUserId = new Map<string, string>()
    approvers.forEach((approver: any) => {
      if (!roleToUserId.has(approver.role)) {
        roleToUserId.set(approver.role, approver.id)
      }
    })

    // Create approval rows for each workflow step
    const approvalData: ApprovalInsert[] = []
    
    for (const step of workflowSteps) {
      const approverId = roleToUserId.get(step.requiredRole)
      
      if (!approverId) {
        return NextResponse.json(
          { error: `No approver found for role: ${step.requiredRole}` },
          { status: 400 }
        )
      }

      approvalData.push({
        workflow_id: workflow.id,
        approver_id: approverId,
        step_order: step.stepOrder,
        status: 'pending',
      })
    }

    // Insert approval rows
    const { data: approvalsData, error: approvalsError } = await (supabase as any)
      .from('approvals')
      .insert(approvalData)
      .select()

    const approvals = approvalsData as any

    if (approvalsError || !approvals) {
      return NextResponse.json(
        { error: approvalsError?.message || 'Failed to create approval rows' },
        { status: 500 }
      )
    }

    // Update document status to "pending"
    const { data: updatedDocumentData, error: updateError } = await (supabase as any)
      .from('documents')
      .update({ status: 'pending' })
      .eq('id', documentId)
      .select()
      .single()

    const updatedDocument = updatedDocumentData as any

    if (updateError || !updatedDocument) {
      // Rollback: delete created approvals
      await (supabase as any).from('approvals').delete().eq('workflow_id', workflow.id)
      
      return NextResponse.json(
        { error: updateError?.message || 'Failed to update document status' },
        { status: 500 }
      )
    }

    // Return success response
    return NextResponse.json(
      {
        document: updatedDocument,
        approvals,
        workflow: {
          id: workflow.id,
          steps: workflowSteps,
        },
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Document submit error:', error)
    
    const errorMessage = error instanceof Error ? error.message : 'Internal server error'
    
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
