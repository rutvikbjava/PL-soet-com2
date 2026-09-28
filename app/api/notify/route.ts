import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'
import type { NotificationInsert } from '@/types/database'

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

    // Parse request body
    const body = await request.json()
    const { user_id, message, document_id } = body

    // Validate required fields
    if (!user_id || !message) {
      return NextResponse.json(
        { error: 'Missing required fields: user_id, message' },
        { status: 400 }
      )
    }

    const supabase = await createServerClient()

    // Verify the recipient user exists
    const { data: recipientUser, error: userError } = await supabase
      .from('users')
      .select('id')
      .eq('id', user_id)
      .single()

    if (userError || !recipientUser) {
      return NextResponse.json(
        { error: 'Recipient user not found' },
        { status: 404 }
      )
    }

    // If document_id is provided, verify it exists
    if (document_id) {
      const { data: document, error: docError } = await supabase
        .from('documents')
        .select('id')
        .eq('id', document_id)
        .single()

      if (docError || !document) {
        return NextResponse.json(
          { error: 'Document not found' },
          { status: 404 }
        )
      }
    }

    // Insert notification into database
    const notificationData: NotificationInsert = {
      user_id,
      message,
      document_id: document_id || null,
      read: false,
    }

    const { data: notificationData2, error: notificationError } = await (supabase as any)
      .from('notifications')
      .insert(notificationData)
      .select()
      .single()

    const notification = notificationData2 as any

    if (notificationError || !notification) {
      return NextResponse.json(
        { error: notificationError?.message || 'Failed to create notification' },
        { status: 500 }
      )
    }

    // Return created notification
    return NextResponse.json(
      {
        notification,
        message: 'Notification sent successfully',
      },
      { status: 201 }
    )
  } catch (error) {
    console.error('Notification creation error:', error)

    const errorMessage = error instanceof Error ? error.message : 'Internal server error'

    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}
