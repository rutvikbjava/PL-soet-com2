import { NextRequest, NextResponse } from 'next/server'
import { createServerClient, createAdminClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

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
    const signature = formData.get('signature') as File | null
    const approvalId = formData.get('approval_id') as string

    // Validate required fields
    if (!signature || !approvalId) {
      return NextResponse.json(
        { error: 'Missing required fields: signature, approval_id' },
        { status: 400 }
      )
    }

    // Validate file is PNG
    if (!signature.type.includes('image/png') && !signature.name.toLowerCase().endsWith('.png')) {
      return NextResponse.json(
        { error: 'Invalid file type. Only PNG images are allowed' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Fetch the approval and verify authorization
    const { data: approvalData, error: approvalError } = await supabase
      .from('approvals')
      .select('id, approver_id, workflow_id, status')
      .eq('id', approvalId)
      .single()

    const approval = approvalData as any

    if (approvalError || !approval) {
      return NextResponse.json(
        { error: 'Approval not found' },
        { status: 404 }
      )
    }

    // Verify the user is the assigned approver
    if (approval.approver_id !== user.id) {
      return NextResponse.json(
        { error: 'Forbidden: You are not authorized to sign this approval' },
        { status: 403 }
      )
    }

    // Check if approval is in pending status
    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: `Cannot upload signature for ${approval.status} approval` },
        { status: 400 }
      )
    }

    // Upload signature to Supabase Storage
    let signatureUrl: string
    try {
      const adminClient = createAdminClient()
      const timestamp = Date.now()
      const storagePath = `${user.id}/${approvalId}_${timestamp}.png`
      
      const fileBuffer = await signature.arrayBuffer()
      const { error: uploadError } = await adminClient.storage
        .from('signatures')
        .upload(storagePath, fileBuffer, {
          contentType: 'image/png',
          upsert: false,
        })

      if (uploadError) {
        return NextResponse.json(
          { error: `Signature upload failed: ${uploadError.message}` },
          { status: 500 }
        )
      }

      signatureUrl = storagePath
    } catch (uploadErr) {
      return NextResponse.json(
        { error: 'Signature upload failed' },
        { status: 500 }
      )
    }

    // Update approval with signature details
    const signedAt = new Date().toISOString()
    
    const { data: updatedApprovalData, error: updateError } = await (supabase as any)
      .from('approvals')
      .update({
        signature_url: signatureUrl,
        signed_at: signedAt,
      })
      .eq('id', approvalId)
      .select()
      .single()

    const updatedApproval = updatedApprovalData as any

    if (updateError || !updatedApproval) {
      // Rollback: delete uploaded signature
      const adminClient = createAdminClient()
      await adminClient.storage.from('signatures').remove([signatureUrl])
      
      return NextResponse.json(
        { error: updateError?.message || 'Failed to update approval with signature' },
        { status: 500 }
      )
    }

    // Return success response
    return NextResponse.json(
      {
        signature_url: signatureUrl,
        signed_at: signedAt,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Signature upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
