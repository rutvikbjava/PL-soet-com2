import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(
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

    // Verify the document exists
    const { data: document, error: docError } = await supabase
      .from('documents')
      .select('id')
      .eq('id', documentId)
      .single()

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found' },
        { status: 404 }
      )
    }

    // Fetch all audit logs for this document, ordered newest to oldest
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_logs')
      .select('*')
      .eq('document_id', documentId)
      .order('created_at', { ascending: false })

    if (auditError) {
      return NextResponse.json(
        { error: auditError.message || 'Failed to fetch audit logs' },
        { status: 500 }
      )
    }

    // Return audit logs (can be empty array if no logs exist)
    return NextResponse.json(
      {
        document_id: documentId,
        audit_logs: auditLogs || [],
        count: auditLogs?.length || 0,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Audit log fetch error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Internal server error'

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
