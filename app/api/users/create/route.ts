import { NextRequest, NextResponse } from 'next/server';
import { createAdminClient } from '@/lib/supabase-admin';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const admin = createAdminClient();

    // Get Authorization header
    const authHeader = request.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const token = authHeader.substring(7);

    // Get caller from token
    const { data: authData, error: authError } = await admin.auth.getUser(token);
    if (authError || !authData.user) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    const callerEmail = authData.user.email;
    if (!callerEmail) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    // Load caller's row from users
    const { data: caller, error: callerError } = await (admin.from('users') as any)
      .select('email, role, department, status')
      .eq('email', callerEmail)
      .single();

    if (callerError || !caller) {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    // Check caller status (null counts as active)
    const callerStatus = caller.status || 'active';
    if (callerStatus !== 'active') {
      return NextResponse.json({ error: 'Not authorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const {
      email,
      full_name,
      password,
      role,
      department,
      employee_id,
      designation,
      section
    } = body;

    // Validate required fields
    if (!email || !full_name || !role) {
      return NextResponse.json(
        { error: 'Missing required fields: email, full_name, role' },
        { status: 400 }
      );
    }

    if (!password || password.length < 6) {
      return NextResponse.json(
        { error: 'Password must be at least 6 characters' },
        { status: 400 }
      );
    }

    // Check if user already exists
    const { data: existingUser } = await (admin.from('users') as any)
      .select('email')
      .eq('email', email)
      .single();

    if (existingUser) {
      return NextResponse.json({ error: 'User already exists' }, { status: 400 });
    }

    // Determine creation rights and set status/approval_stage
    let canCreate = false;
    let status: 'active' | 'pending' = 'active';
    let approval_stage: 'hod' | 'principal' | null = null;
    let finalDepartment = department;

    switch (caller.role) {
      case 'student':
        return NextResponse.json({ error: 'You cannot create users' }, { status: 403 });

      case 'faculty':
        if (role === 'student') {
          canCreate = true;
          finalDepartment = caller.department; // Force to faculty's department
          status = 'pending';
          approval_stage = 'hod';
          
          // Section is required for students
          if (!section) {
            return NextResponse.json(
              { error: 'Section is required for students' },
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
        if (['hod', 'coe', 'faculty'].includes(role)) {
          canCreate = true;
          status = 'active';
          approval_stage = null;
        }
        break;

      case 'admin':
        canCreate = true;
        status = 'active';
        approval_stage = null;
        break;
    }

    if (!canCreate) {
      return NextResponse.json(
        { error: 'You cannot create this role' },
        { status: 403 }
      );
    }

    // Create auth user
    const { data: authUser, error: authUserError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true
    });

    if (authUserError || !authUser.user) {
      return NextResponse.json(
        { error: authUserError?.message || 'Failed to create user' },
        { status: 400 }
      );
    }

    // Insert into users table
    const { data: newUser, error: insertError } = await (admin.from('users') as any)
      .insert({
        id: authUser.user.id,
        email,
        full_name,
        role,
        department: finalDepartment || null,
        section: section || null,
        employee_id: employee_id || null,
        designation: designation || null,
        status,
        approval_stage,
        created_by_email: callerEmail
      })
      .select()
      .single();

    if (insertError) {
      // Rollback: delete auth user
      await admin.auth.admin.deleteUser(authUser.user.id);
      return NextResponse.json(
        { error: 'Failed to create user record' },
        { status: 500 }
      );
    }

    // Insert approval log
    await (admin.from('user_approval_log') as any).insert({
      user_email: email,
      user_name: full_name,
      action: 'created',
      stage: approval_stage,
      actor_email: callerEmail,
      actor_role: caller.role
    });

    // Send notifications based on approval_stage
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

    return NextResponse.json({
      success: true,
      status,
      approval_stage
    });

  } catch (error) {
    console.error('User creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
