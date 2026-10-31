import { NextRequest, NextResponse } from 'next/server';
import { createBrowserClient } from '@/lib/supabase';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

/**
 * Verify OTP and mark email as verified
 * POST /api/otp/verify
 * Body: { email: string, token: string }
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, token } = body;

    if (!email || !email.trim()) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    if (!token || !token.trim()) {
      return NextResponse.json(
        { error: 'OTP token is required' },
        { status: 400 }
      );
    }

    const normalizedEmail = email.toLowerCase().trim();
    const normalizedToken = token.trim();

    // Verify OTP using Supabase Auth
    const supabase = createBrowserClient();
    
    const { data, error } = await supabase.auth.verifyOtp({
      email: normalizedEmail,
      token: normalizedToken,
      type: 'email',
    });

    if (error) {
      console.error('[OTP Verify] Supabase verification error:', error);
      return NextResponse.json(
        { error: 'Invalid or expired OTP. Please try again.' },
        { status: 400 }
      );
    }

    if (!data.user) {
      return NextResponse.json(
        { error: 'Verification failed. User not found.' },
        { status: 400 }
      );
    }

    // Update email_verified flag in users table
    const admin = createAdminClient();
    
    const { error: updateError } = await (admin.from('users') as any)
      .update({ email_verified: true })
      .eq('email', normalizedEmail);

    if (updateError) {
      console.error('[OTP Verify] Failed to update email_verified:', updateError);
      // Don't fail the request - OTP is verified, just log the error
    }

    console.log('[OTP Verify] Email verified successfully:', normalizedEmail);

    return NextResponse.json({
      success: true,
      message: 'Email verified successfully!',
      user: {
        email: data.user.email,
        id: data.user.id,
      },
    });
  } catch (err) {
    console.error('[OTP Verify] Error:', err);
    const message = err instanceof Error ? err.message : 'Unknown error';
    return NextResponse.json(
      { error: `Verification failed: ${message}` },
      { status: 500 }
    );
  }
}
