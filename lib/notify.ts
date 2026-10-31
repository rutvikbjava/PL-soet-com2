import { createAdminClient } from './supabase-admin';

/**
 * Send email notification using Supabase Auth Admin
 * Uses Supabase's built-in email service (no external SMTP needed)
 * 
 * @param to - Recipient email address
 * @param subject - Email subject line
 * @param html - HTML content of the email
 */
export async function sendEmail(to: string, subject: string, html: string): Promise<void> {
  try {
    const admin = createAdminClient();

    // Use Supabase's built-in email via auth admin
    // Note: This sends a magic link email. For custom emails, you'll need to use
    // Supabase's SMTP relay or a third-party service like Resend
    
    // For now, we'll use the invite method which allows custom email content
    const { error } = await admin.auth.admin.inviteUserByEmail(to, {
      data: {
        subject,
        html,
      },
    });

    if (error) {
      console.error('[sendEmail] Failed:', error.message);
      throw error;
    }

    console.log('[sendEmail] Email sent successfully to:', to);
  } catch (err) {
    console.error('[sendEmail] Error:', err);
    throw err;
  }
}

/**
 * Send notification to user via web, email, or both channels
 * Always logs to notification_log table
 * 
 * @param userId - User's UUID from users table
 * @param title - Notification title
 * @param message - Notification message body
 * @param channel - Delivery channel: 'web', 'email', or 'all'
 */
export async function sendNotification(
  userId: string,
  title: string,
  message: string,
  channel: 'web' | 'email' | 'all' = 'web'
): Promise<void> {
  try {
    const admin = createAdminClient();

    // 1. Always log notification to notification_log table
    const notificationLogEntry = {
      user_id: userId,
      channel: channel === 'all' ? 'web' : channel,
      title,
      message,
      sent_at: new Date().toISOString(),
      status: 'sent',
    };

    const { error: logError } = await (admin.from('notification_log') as any).insert(notificationLogEntry);

    if (logError) {
      console.error('[sendNotification] Failed to log notification:', logError);
    }

    // 2. If email channel is requested, send email
    if (channel === 'email' || channel === 'all') {
      // Fetch user details
      const { data: user, error: userError } = await (admin.from('users') as any)
        .select('email, email_verified, full_name')
        .eq('id', userId)
        .single();

      if (userError || !user) {
        console.error('[sendNotification] User not found:', userId);
        return;
      }

      // Check if email is verified
      if (!user.email_verified) {
        console.warn('[sendNotification] Email not verified for user:', user.email);
        // Still log but don't send email
        await (admin.from('notification_log') as any).insert({
          user_id: userId,
          channel: 'email',
          title,
          message,
          sent_at: new Date().toISOString(),
          status: 'skipped_unverified',
        });
        return;
      }

      // Send email notification
      try {
        const htmlContent = `
          <!DOCTYPE html>
          <html>
          <head>
            <meta charset="utf-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>${title}</title>
          </head>
          <body style="font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
              <h1 style="color: white; margin: 0; font-size: 24px;">EduSphere AI</h1>
              <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 14px;">MGM University SOET</p>
            </div>
            
            <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
              <h2 style="color: #667eea; margin-top: 0; font-size: 20px;">${title}</h2>
              
              <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #667eea; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 15px; color: #555;">${message}</p>
              </div>
              
              <p style="font-size: 14px; color: #666; margin-top: 20px;">
                Hello ${user.full_name || 'User'},
              </p>
              
              <p style="font-size: 14px; color: #666;">
                This notification was sent from your EduSphere AI account. If you have any questions, please contact your department administrator.
              </p>
              
              <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
                <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pl-soet-com2.vercel.app'}" 
                   style="display: inline-block; background: #667eea; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 14px;">
                  Go to Dashboard
                </a>
              </div>
            </div>
            
            <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
              <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} MGM University SOET | EduSphere AI</p>
              <p style="margin: 5px 0;">This is an automated message, please do not reply to this email.</p>
            </div>
          </body>
          </html>
        `;

        await sendEmail(user.email, title, htmlContent);

        // Log successful email send
        await (admin.from('notification_log') as any).insert({
          user_id: userId,
          channel: 'email',
          title,
          message,
          sent_at: new Date().toISOString(),
          status: 'sent',
        });

        console.log('[sendNotification] Email sent successfully to:', user.email);
      } catch (emailError) {
        console.error('[sendNotification] Failed to send email:', emailError);
        
        // Log failed email send
        await (admin.from('notification_log') as any).insert({
          user_id: userId,
          channel: 'email',
          title,
          message,
          sent_at: new Date().toISOString(),
          status: 'failed',
        });
      }
    }

    // 3. If web channel, notification is already in assignment_notifications or notifications table
    // This function just logs to notification_log
    console.log('[sendNotification] Notification sent successfully:', { userId, title, channel });
  } catch (err) {
    console.error('[sendNotification] Error:', err);
    throw err;
  }
}

/**
 * Bulk send notifications to multiple users
 * 
 * @param userIds - Array of user UUIDs
 * @param title - Notification title
 * @param message - Notification message
 * @param channel - Delivery channel
 */
export async function sendBulkNotifications(
  userIds: string[],
  title: string,
  message: string,
  channel: 'web' | 'email' | 'all' = 'web'
): Promise<void> {
  const promises = userIds.map((userId) => sendNotification(userId, title, message, channel));
  await Promise.allSettled(promises);
}
