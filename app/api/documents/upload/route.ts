import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import { analyzeDocumentContext } from '@/lib/context'
import { generateWorkflow, validateWorkflow } from '@/lib/workflow'
import type { DocumentInsert, WorkflowInsert, ApprovalInsert, AuditLogInsert } from '@/types/database'

export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const { user } = await getSession()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse multipart/form-data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const title = formData.get('title') as string
    const type = formData.get('type') as string
    const department = formData.get('department') as string
    const scope = formData.get('scope') as string

    // Validate required fields
    if (!title || !type || !scope) {
      return NextResponse.json(
        { error: 'Missing required fields: title, type, scope' },
        { status: 400 }
      )
    }

    // Validate enum values
    const validTypes = ['notice', 'timetable', 'exam_schedule', 'policy']
    const validScopes = ['department', 'college', 'institution']

    if (!validTypes.includes(type)) {
      return NextResponse.json(
        { error: `Invalid type. Must be one of: ${validTypes.join(', ')}` },
        { status: 400 }
      )
    }

    if (!validScopes.includes(scope)) {
      return NextResponse.json(
        { error: `Invalid scope. Must be one of: ${validScopes.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate file if provided
    let fileUrl: string | null = null
    
    if (file) {
      const fileName = file.name.toLowerCase()
      const validExtensions = ['.pdf', '.doc', '.docx', '.ppt', '.pptx']
      const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext))

      if (!hasValidExtension) {
        return NextResponse.json(
          { error: `Invalid file type. Allowed: ${validExtensions.join(', ')}` },
          { status: 400 }
        )
      }

      // Upload file to Supabase Storage
      try {
        const adminClient = createAdminClient()
        const timestamp = Date.now()
        const storagePath = `${user.id}/${timestamp}_${file.name}`
        
        const fileBuffer = await file.arrayBuffer()
        const { error: uploadError } = await adminClient.storage
          .from('documents')
          .upload(storagePath, fileBuffer, {
            contentType: file.type,
            upsert: false,
          })

        if (uploadError) {
          return NextResponse.json(
            { error: `File upload failed: ${uploadError.message}` },
            { status: 500 }
          )
        }

        fileUrl = storagePath
      } catch (uploadErr) {
        return NextResponse.json(
          { error: 'File upload failed' },
          { status: 500 }
        )
      }
    }

    const supabase = await createServerClient()

    // Insert document into database
    const documentData: DocumentInsert = {
      title,
      type,
      creator_id: user.id,
      department: department || null,
      scope,
      file_url: fileUrl,
      status: 'draft',
    }

    const { data: document, error: docError } = await supabase
      .from('documents')
      .insert(documentData)
      .select()
      .single()

    if (docError || !document) {
      // Cleanup uploaded file if document creation fails
      if (fileUrl) {
        const adminClient = createAdminClient()
        await adminClient.storage.from('documents').remove([fileUrl])
      }
      
      return NextResponse.json(
        { error: docError?.message || 'Failed to create document' },
        { status: 500 }
      )
    }

    // Analyze document context with creator role
    const documentWithRole = {
      ...document,
      creator_role: user.role,
    }
    const context = analyzeDocumentContext(documentWithRole)

    // Generate workflow steps
    const workflowSteps = generateWorkflow(context)

    // Validate workflow
    const isValid = validateWorkflow(workflowSteps, context)

    // Insert workflow into database
    const workflowData: WorkflowInsert = {
      document_id: document.id,
      generated_steps: workflowSteps,
      policy_valid: isValid,
    }

    const { data: workflow, error: workflowError } = await supabase
      .from('workflows')
      .insert(workflowData)
      .select()
      .single()

    if (workflowError || !workflow) {
      // Rollback: delete document and file
      await supabase.from('documents').delete().eq('id', document.id)
      if (fileUrl) {
        const adminClient = createAdminClient()
        await adminClient.storage.from('documents').remove([fileUrl])
      }
      
      return NextResponse.json(
        { error: workflowError?.message || 'Failed to create workflow' },
        { status: 500 }
      )
    }

    // Fetch users by required roles for approval steps
    const requiredRoles = workflowSteps.map(step => step.requiredRole)
    const { data: approvers, error: approversError } = await supabase
      .from('users')
      .select('id, role')
      .in('role', requiredRoles)

    if (approversError || !approvers || approvers.length === 0) {
      // Rollback
      await supabase.from('workflows').delete().eq('id', workflow.id)
      await supabase.from('documents').delete().eq('id', document.id)
      if (fileUrl) {
        const adminClient = createAdminClient()
        await adminClient.storage.from('documents').remove([fileUrl])
      }
      
      return NextResponse.json(
        { error: 'No approvers found for the required roles' },
        { status: 500 }
      )
    }

    // Create a map of role to user ID
    const roleToUserId = new Map<string, string>()
    approvers.forEach(approver => {
      if (!roleToUserId.has(approver.role)) {
        roleToUserId.set(approver.role, approver.id)
      }
    })

    // Insert approval steps into database
    const approvalData: ApprovalInsert[] = workflowSteps.map((step) => {
      const approverId = roleToUserId.get(step.requiredRole)
      
      if (!approverId) {
        throw new Error(`No approver found for role: ${step.requiredRole}`)
      }

      return {
        workflow_id: workflow.id,
        approver_id: approverId,
        step_order: step.stepOrder,
        status: 'pending',
      }
    })

    const { data: approvals, error: approvalError } = await supabase
      .from('approvals')
      .insert(approvalData)
      .select()

    if (approvalError || !approvals) {
      // Rollback
      await supabase.from('workflows').delete().eq('id', workflow.id)
      await supabase.from('documents').delete().eq('id', document.id)
      if (fileUrl) {
        const adminClient = createAdminClient()
        await adminClient.storage.from('documents').remove([fileUrl])
      }
      
      return NextResponse.json(
        { error: approvalError?.message || 'Failed to create approval steps' },
        { status: 500 }
      )
    }

    // Insert audit log
    const auditData: AuditLogInsert = {
      document_id: document.id,
      actor_id: user.id,
      action: 'document_created',
      metadata: {
        title,
        type,
        department: department || null,
        scope,
        step_count: workflowSteps.length,
      },
    }

    await supabase.from('audit_logs').insert(auditData)

    // Return success response with created data
    return NextResponse.json(
      {
        document,
        workflow: {
          id: workflow.id,
          document_id: workflow.document_id,
          generated_steps: workflowSteps,
          policy_valid: workflow.policy_valid,
        },
        approvals,
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Document upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
