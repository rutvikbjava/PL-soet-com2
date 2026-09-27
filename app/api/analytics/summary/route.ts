import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

export async function GET(request: NextRequest) {
  try {
    // Get authenticated session
    const { user } = await getSession()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createServerClient()

    // Fetch all documents
    const { data: documents, error: documentsError } = await supabase
      .from('documents')
      .select('status, type')

    if (documentsError) {
      return NextResponse.json(
        { error: documentsError.message || 'Failed to fetch documents' },
        { status: 500 }
      )
    }

    // Initialize counters
    const byStatus: Record<string, number> = {
      draft: 0,
      pending: 0,
      approved: 0,
      rejected: 0,
    }

    const byType: Record<string, number> = {
      notice: 0,
      timetable: 0,
      exam_schedule: 0,
      policy: 0,
    }

    // Count documents by status and type
    if (documents && documents.length > 0) {
      documents.forEach((doc) => {
        // Count by status
        if (doc.status in byStatus) {
          byStatus[doc.status]++
        } else {
          byStatus[doc.status] = 1
        }

        // Count by type
        if (doc.type in byType) {
          byType[doc.type]++
        } else {
          byType[doc.type] = 1
        }
      })
    }

    // Calculate total
    const total = documents?.length || 0

    // Return summary
    return NextResponse.json(
      {
        total,
        by_status: byStatus,
        by_type: byType,
      },
      { status: 200 }
    )
  } catch (error) {
    console.error('Analytics summary error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Internal server error'

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
