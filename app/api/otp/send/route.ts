import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';

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

    // Use Supabase's built-in OTP email system
    const supabase = createBrowserClient();
    
    const { error } = await supabase.auth.signInWithOtp({
      email: normalizedEmail,
      options: {
        shouldCreateUser: false, // Don't create new user, only send OTP to existing users
      },
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
