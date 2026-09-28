import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export const dynamic = 'force-dynamic'

export async function GET(request: NextRequest) {
  try {
    const { user } = await getSession()
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createAdminClient()

    // Fetch documents created by this user
    const { data: myDocuments } = await supabase
      .from('documents')
      .select('id')
      .eq('creator_id', user.id)

    const myDocumentIds = (myDocuments || []).map((d: any) => d.id)

    // Fetch audit logs where:
    // a) actor is this user, OR
    // b) document is one of user's documents
    const { data: auditLogs, error: auditError } = await supabase
      .from('audit_logs')
      .select(`
        id,
        action,
        actor_id,
        document_id,
        metadata,
        created_at,
        documents (
          id,
          title,
          creator_id
        )
      `)
      .or(`actor_id.eq.${user.id},document_id.in.(${myDocumentIds.join(',')})`)
      .order('created_at', { ascending: false })
      .limit(100)

    if (auditError) {
      console.error('Audit logs fetch error:', auditError)
      return NextResponse.json(
        { error: 'Failed to fetch audit logs' },
        { status: 500 }
      )
    }

    // Fetch user emails for actors
    const actorIds = [...new Set((auditLogs || []).map((log: any) => log.actor_id))]
    const { data: users } = await supabase
      .from('users')
      .select('id, email')
      .in('id', actorIds)

    const userEmailMap: Record<string, string> = {}
    if (users) {
      for (const u of users as any[]) {
        userEmailMap[u.id] = u.email
      }
    }

    // Process entries
    const entries = (auditLogs || []).map((log: any) => {
      const isByMe = log.actor_id === user.id
      const isOnMyDocument = myDocumentIds.includes(log.document_id)
      
      // Extract comment from metadata if it's a rejection
      let comment = null
      if (log.action === 'rejected' && log.metadata) {
        comment = log.metadata.comment || null
      }

      return {
        id: log.id,
        documentId: log.document_id,
        documentTitle: log.documents?.title || 'Unknown Document',
        action: log.action,
        actorId: log.actor_id,
        actorEmail: userEmailMap[log.actor_id] || 'Unknown',
        comment,
        metadata: log.metadata,
        timestamp: log.created_at,
        kind: isByMe ? 'by_me' : 'on_my_document',
      }
    })

    return NextResponse.json({ entries }, { status: 200 })
  } catch (error) {
    console.error('Audit mine error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
