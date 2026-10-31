import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Send OTP to user's email
 * POST /api/otp/send
 * Body: { email: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();

    // Check if user exists
    const admin = createAdminClient();
    const { data: user, error: userError } = await (admin.from('users') as any)
      .select('email')
      .eq('email', normalizedEmail)
      .single();

    if (userError || !user) {
      return NextResponse.json(
        { error: 'User not found with this email address.' },
        { status: 404 }
      );
    }

    // Use Supabase Admin Auth to send OTP
    const { error } = await admin.auth.admin.generateLink({
      type: 'magiclink',
      email: normalizedEmail,
    });

    if (error) {
      console.error('[OTP Send] Supabase error:', error);
      return NextResponse.json(
        { error: 'Failed to send OTP. Please try again.' },
        { status: 500 }
      );
    }

    console.log('[OTP Send] OTP sent successfully to:', normalizedEmail);

    return NextResponse.json({
      success: true,
      message: 'OTP sent to your email. Please check your inbox.',
    });
  } catch (err) {
    console.error('[OTP Send] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Failed to send OTP: ${message}` },
      { status: 500 }
    );
  }
}
