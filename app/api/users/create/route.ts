import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json({
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL
  });
}

export async function POST(request: NextRequest) {
  let step = 'start';
  try {
    step = 'env';
    const admin = createAdminClient();

    step = 'auth-caller';
    // Get Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: '[auth-caller] Not authorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Get caller from token
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: '[auth-caller] Not authorized' }, { status: 401 });
    }

    const callerEmail = authData.user.email;
    if (!callerEmail) {
      return NextResponse.json({ error: '[auth-caller] Not authorized' }, { status: 401 });
    }

    step = 'load-caller';
    // Load caller's row from users
    const { data: caller, error: callerError } = await (admin.from('users') as any)
      .select('email, role, department, status')
      .eq('email', callerEmail)
      .single();

    if (callerError || !caller) {
      return NextResponse.json({ error: '[load-caller] Not authorized' }, { status: 401 });
    }

    // Check caller status (null counts as active)
    const callerStatus = caller.status || 'active';
    if (callerStatus !== 'active') {
      return NextResponse.json({ error: '[load-caller] Not authorized' }, { status: 401 });
    }

    step = 'checks';
    // Parse request body
    const body = await request.json();
    let {
      email,
      full_name,
      password,
      role,
      department,
      employee_id,
      designation,
      section
    } = body;

    // Normalize email
    email = email?.toLowerCase().trim();

    // Validate required fields
    if (!email || !full_name || !role) {
      return NextResponse.json(
        { error: '[checks] Missing required fields: email, full_name, role' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: '[checks] Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await (admin.from('users') as any)
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: '[checks] User already exists' }, { status: 400 });
    }

    const { data: listData } = await admin.auth.admin.listUsers({ perPage: 1000 });
    const existingAuthUser = listData?.users?.find((u: any) => u.email === email);
    if (existingAuthUser) {
      return NextResponse.json({ error: '[checks] User already exists' }, { status: 400 });
    }

    // Determine creation rights and set status/approval_stage
    let canCreate = false;
    let status: 'active' | 'pending' = 'active';
    let approval_stage: 'hod' | 'principal' | null = null;
    let finalDepartment = department;

    switch (caller.role) {
      case 'student':
        return NextResponse.json({ error: '[checks] You cannot create users' }, { status: 403 });

      case 'faculty':
        if (role === 'student') {
          canCreate = true;
          finalDepartment = caller.department; // Force to faculty's department
          status = 'pending';
          approval_stage = 'hod';
          
          // Section is required for students
          if (!section) {
            return NextResponse.json(
              { error: '[checks] Section is required for students' },
              { status: 400 }
            );
          }
        }
        break;

      case 'hod':
        if (role === 'faculty') {
          canCreate = true;
          finalDepartment = caller.department; // Force to hod's department
          status = 'pending';
          approval_stage = 'principal';
        }
        break;

      case 'coe':
        if (role === 'faculty') {
          canCreate = true;
          status = 'pending';
          approval_stage = 'principal';
        }
        break;

      case 'principal':
        if (['hod', 'coe', 'faculty', 'accountant', 'librarian', 'admission_incharge', 'admin'].includes(role)) {
          canCreate = true;
          status = 'active';
          approval_stage = null;
        }
        break;

      case 'admin':
      case 'accountant':
      case 'librarian':
      case 'admission_incharge':
        canCreate = true;
        status = 'active';
        approval_stage = null;
        break;
    }

    if (!canCreate) {
      return NextResponse.json(
        { error: '[checks] You cannot create this role' },
        { status: 403 }
      );
    }

    step = 'create-auth-user';
    // Create auth user
    const { data: authUser, error: authUserError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authUserError || !authUser.user) {
      return NextResponse.json(
        { error: `[create-auth-user] ${authUserError?.message || 'Failed to create user'}` },
        { status: 400 }
      );
    }

    step = 'insert-users';
    // Update existing users row (created by trigger) or insert if not found
    const userRecord = {
      full_name,
      role,
      department: finalDepartment || null,
      section: section || null,
      employee_id: employee_id || null,
      designation: designation || null,
      status,
      approval_stage,
      created_by_email: callerEmail
    };

    const { data: updatedUser, error: updateError } = await (admin.from('users') as any)
      .update(userRecord)
      .eq('email', email)
      .select()
      .single();

    let newUser = updatedUser;
    let finalError = updateError;

    // If update found no row, fall back to insert
    if (!updatedUser && updateError) {
      const insertRecord = {
        id: authUser.user.id,
        email,
        ...userRecord
      };

      const { data: insertedUser, error: insertError } = await (admin.from('users') as any)
        .insert(insertRecord)
        .select()
        .single();

      newUser = insertedUser;
      finalError = insertError;
    }

    if (finalError || !newUser) {
      // Rollback: delete users row and auth user
      await (admin.from('users') as any).delete().eq('email', email);
      await admin.auth.admin.deleteUser(authUser.user.id);
      console.error('insert-users failed:', finalError, 'attempted data:', userRecord);
      return NextResponse.json(
        { error: `[insert-users] ${finalError.message} | code: ${finalError.code} | details: ${finalError.details}` },
        { status: 500 }
      );
    }

    step = 'insert-log';
    // Insert approval log (non-fatal)
    try {
      await (admin.from('user_approval_log') as any).insert({
        user_email: email,
        user_name: full_name,
        action: 'created',
        stage: approval_stage,
        actor_email: callerEmail,
        actor_role: caller.role
      });
    } catch (logError) {
      console.error('insert-log failed (non-fatal):', logError);
    }

    step = 'notify';
    // Send notifications based on approval_stage (non-fatal)
    try {
      if (approval_stage === 'hod') {
        // Notify all active HODs in the same department
        const { data: hods } = await (admin.from('users') as any)
          .select('email')
          .eq('role', 'hod')
          .eq('department', finalDepartment)
          .or('status.is.null,status.eq.active');

        if (hods && hods.length > 0) {
          const notifications = hods.map((hod: { email: string }) => ({
            user_email: hod.email,
            message: `New student pending your approval: ${full_name}`,
            link: '/users',
            is_read: false
          }));

          await (admin.from('assignment_notifications') as any).insert(notifications);
        }
      } else if (approval_stage === 'principal') {
        // Notify all active principals
        const { data: principals } = await (admin.from('users') as any)
          .select('email')
          .eq('role', 'principal')
          .or('status.is.null,status.eq.active');

        if (principals && principals.length > 0) {
          const notifications = principals.map((principal: { email: string }) => ({
            user_email: principal.email,
            message: `New user pending approval: ${full_name} (${role})`,
            link: '/users',
            is_read: false
          }));

          await (admin.from('assignment_notifications') as any).insert(notifications);
        }
      }
    } catch (notifyError) {
      console.error('notify failed (non-fatal):', notifyError);
    }

    // Send welcome email to newly created user (#17)
    try {
      const { sendEmail } = await import('@/lib/notify');
      
      const welcomeHtml = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="utf-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Welcome to EduSphere AI</title>
        </head>
        <body style="font-family: 'Arial', sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
          <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
            <h1 style="color: white; margin: 0; font-size: 28px;">Welcome to EduSphere AI!</h1>
            <p style="color: #f0f0f0; margin: 10px 0 0 0; font-size: 14px;">MGM University SOET</p>
          </div>
          
          <div style="background: #ffffff; padding: 30px; border: 1px solid #e0e0e0; border-top: none; border-radius: 0 0 10px 10px;">
            <h2 style="color: #667eea; margin-top: 0; font-size: 22px;">Hello ${full_name},</h2>
            
            <p style="font-size: 15px; color: #555; line-height: 1.8;">
              Your EduSphere AI account has been successfully created! You can now access the platform to manage your academic activities.
            </p>
            
            <div style="background: #f8f9fa; padding: 20px; border-left: 4px solid #667eea; margin: 25px 0; border-radius: 4px;">
              <h3 style="margin-top: 0; color: #333; font-size: 16px;">Your Account Details:</h3>
              <table style="width: 100%; font-size: 14px; color: #555;">
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Email:</td>
                  <td style="padding: 8px 0;">${email}</td>
                </tr>
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Role:</td>
                  <td style="padding: 8px 0; text-transform: capitalize;">${role.replace('_', ' ')}</td>
                </tr>
                ${finalDepartment ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Department:</td>
                  <td style="padding: 8px 0;">${finalDepartment}</td>
                </tr>
                ` : ''}
                ${section ? `
                <tr>
                  <td style="padding: 8px 0; font-weight: bold;">Section:</td>
                  <td style="padding: 8px 0;">${section}</td>
                </tr>
                ` : ''}
              </table>
            </div>
            
            ${status === 'pending' ? `
            <div style="background: #fff3cd; border: 1px solid #ffc107; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #856404;">
                ⏳ <strong>Approval Pending:</strong> Your account is awaiting approval from ${approval_stage === 'hod' ? 'your HOD' : 'the Principal'}. You'll receive another email once approved.
              </p>
            </div>
            ` : `
            <div style="background: #d4edda; border: 1px solid #28a745; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <p style="margin: 0; font-size: 14px; color: #155724;">
                ✅ <strong>Account Active:</strong> You can log in now and start using EduSphere AI!
              </p>
            </div>
            `}
            
            <p style="font-size: 14px; color: #666; margin-top: 25px;">
              Use your email address and the password shared with you by your administrator to log in.
            </p>
            
            <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #e0e0e0; text-align: center;">
              <a href="${process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://pl-soet-com2.vercel.app'}/login" 
                 style="display: inline-block; background: #667eea; color: white; padding: 14px 35px; text-decoration: none; border-radius: 5px; font-weight: bold; font-size: 15px;">
                Login to EduSphere
              </a>
            </div>
            
            <div style="margin-top: 25px; padding: 15px; background: #f8f9fa; border-radius: 5px;">
              <p style="font-size: 13px; color: #666; margin: 0;">
                💡 <strong>Getting Started:</strong> After logging in, complete your profile and explore the dashboard to access all features available for your role.
              </p>
            </div>
          </div>
          
          <div style="text-align: center; margin-top: 20px; padding: 20px; color: #999; font-size: 12px;">
            <p style="margin: 5px 0;">&copy; ${new Date().getFullYear()} MGM University SOET | EduSphere AI</p>
            <p style="margin: 5px 0;">If you have any questions, contact your department administrator.</p>
          </div>
        </body>
        </html>
      `;
      
      await sendEmail(email, 'Welcome to EduSphere AI - Your Account is Ready', welcomeHtml);
      console.log('[notify] Welcome email sent to:', email);
    } catch (emailError) {
      console.error('[notify] Failed to send welcome email (non-fatal):', emailError);
    }

    return NextResponse.json({
      success: true,
      status,
      approval_stage
    });

  } catch (err) {
    console.error('create-user failed at', step, err);
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      { error: `[${step}] ${message}` },
      { status: 500 }
    );
  }
}
