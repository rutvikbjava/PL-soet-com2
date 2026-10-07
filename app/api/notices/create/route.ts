import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { analyzeDocumentContext } from '@/lib/context';
import { generateWorkflow, validateWorkflow } from '@/lib/workflow';

const ALLOWED_FILE_TYPES = ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx'];

export async function POST(request: NextRequest) {
  try {
    // Verify authenticated user
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Check role is faculty, hod, or principal
    const userRole = session.user.role;
    if (!['faculty', 'hod', 'principal'].includes(userRole)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient permissions' }, { status: 403 });
    }

    // Parse multipart/form-data
    const formData = await request.formData();
    
    const title = formData.get('title') as string;
    const type = formData.get('type') as string;
    const department = formData.get('department') as string;
    const scope = formData.get('scope') as string;
    const category = formData.get('category') as string;
    const notice_content = formData.get('notice_content') as string | null;
    const publication_date = formData.get('publication_date') as string | null;
    const recipient_roles_json = formData.get('recipient_roles') as string;
    const recipient_departments_json = formData.get('recipient_departments') as string;
    const file = formData.get('file') as File | null;

    // Validate required fields
    if (!title || !type || !department || !scope || !category) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Initialize Supabase admin client
    const supabase = createAdminClient();

    let file_url: string | null = null;

    // Handle file upload if provided
    if (file && file.size > 0) {
      const fileExtension = file.name.split('.').pop()?.toLowerCase();
      
      if (!fileExtension || !ALLOWED_FILE_TYPES.includes(fileExtension)) {
        return NextResponse.json(
          { error: `Invalid file type. Allowed types: ${ALLOWED_FILE_TYPES.join(', ')}` },
          { status: 400 }
        );
      }

      // Generate storage path: {userId}/{timestamp}_{filename}
      const timestamp = Date.now();
      const storagePath = `${session.user.id}/${timestamp}_${file.name}`;

      // Upload to Supabase Storage bucket "documents"
      const { error: uploadError } = await supabase.storage
        .from('documents')
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) {
        console.error('File upload error:', uploadError);
        return NextResponse.json({ error: 'Failed to upload file' }, { status: 500 });
      }

      file_url = storagePath;
    }

    // Insert into documents table
    const { data: document, error: documentError } = await (supabase.from('documents') as any)
      .insert({
        title,
        type,
        department,
        scope,
        creator_id: session.user.id,
        status: 'draft',
        file_url: file_url || null,
      })
      .select()
      .single();

    if (documentError || !document) {
      console.error('Document insert error:', documentError);
      return NextResponse.json({ error: 'Failed to create document' }, { status: 500 });
    }

    // Update document with notice-specific fields
    const { error: updateFieldsError } = await (supabase.from('documents') as any)
      .update({
        category: category || null,
        notice_content: notice_content || null,
        publication_date: publication_date || null,
        is_published: false,
      })
      .eq('id', document.id);

    if (updateFieldsError) {
      console.error('Document update error:', updateFieldsError);
      return NextResponse.json({ error: 'Failed to update document fields' }, { status: 500 });
    }

    // Analyze document context
    const documentContext = analyzeDocumentContext({
      ...document,
      department: document.department || '',
      creator_role: session.user.role as any,
      category: category || null,
      publication_date: publication_date || null,
      published_at: null,
      is_published: false,
      notice_content: notice_content || null,
    } as any);

    // Generate workflow
    const workflowSteps = generateWorkflow(documentContext);

    // Validate workflow
    const isValidWorkflow = validateWorkflow(workflowSteps, documentContext);
    if (!isValidWorkflow) {
      console.error('Workflow validation failed');
      return NextResponse.json({ error: 'Invalid workflow configuration' }, { status: 500 });
    }

    // Insert workflow row into workflows table
    const { data: workflow, error: workflowError } = await (supabase.from('workflows') as any)
      .insert({
        document_id: document.id,
        policy_valid: isValidWorkflow,
        generated_steps: workflowSteps,
      })
      .select()
      .single();

    if (workflowError || !workflow) {
      console.error('Workflow insert error:', workflowError);
      return NextResponse.json({ error: 'Failed to create workflow' }, { status: 500 });
    }

    // Fetch users by required roles for approval steps
    const requiredRoles = workflowSteps.map((step: any) => step.requiredRole ?? step.required_role);
    const { data: approversData, error: approversError } = await supabase
      .from('users')
      .select('id, role')
      .in('role', requiredRoles);

    const approvers = (approversData ?? []) as any[];

    if (approversError || approvers.length === 0) {
      return NextResponse.json(
        { error: 'No approvers found for the required roles' },
        { status: 400 }
      );
    }

    // Create a map of role to user ID (take first user for each role)
    const roleToUserId = new Map<string, string>();
    approvers.forEach((approver: any) => {
      if (!roleToUserId.has(approver.role)) {
        roleToUserId.set(approver.role, approver.id);
      }
    });

    // Insert approval rows for each step
    const approvalRows = [];
    for (const step of workflowSteps) {
      const stepRole = (step as any).requiredRole ?? (step as any).required_role;
      const approverId = roleToUserId.get(stepRole);
      
      if (!approverId) {
        return NextResponse.json(
          { error: `No approver found for role: ${stepRole}` },
          { status: 400 }
        );
      }

      approvalRows.push({
        workflow_id: workflow.id,
        approver_id: approverId,
        step_order: (step as any).stepOrder ?? (step as any).step_order ?? 1,
        status: 'pending',
      });
    }

    const { error: approvalsError } = await (supabase
      .from('approvals') as any)
      .insert(approvalRows);

    if (approvalsError) {
      console.error('Approvals error:', JSON.stringify(approvalsError));
      return NextResponse.json(
        { error: 'Failed to create approvals' },
        { status: 500 }
      );
    }

    // Parse recipient_roles and recipient_departments from JSON strings safely
    let recipient_roles: string[] = [];
    let recipient_departments: string[] = [];

    try {
      recipient_roles = JSON.parse(recipient_roles_json || '[]') as string[];
    } catch (e) {
      console.error('Invalid recipient_roles JSON:', e);
    }

    try {
      recipient_departments = JSON.parse(recipient_departments_json || '[]') as string[];
    } catch (e) {
      console.error('Invalid recipient_departments JSON:', e);
    }

    // Insert rows into notice_recipients table
    const recipientInserts = [
      ...recipient_roles.map((role) => ({
        document_id: document.id,
        recipient_type: 'role',
        recipient_value: role,
      })),
      ...recipient_departments.map((dept) => ({
        document_id: document.id,
        recipient_type: 'department',
        recipient_value: dept,
      })),
    ];

    if (recipientInserts.length > 0) {
      const { error: recipientsError } = await (supabase as any)
        .from('notice_recipients')
        .insert(recipientInserts);

      if (recipientsError) {
        console.error('Notice recipients insert error:', recipientsError);
        return NextResponse.json({ error: 'Failed to create notice recipients' }, { status: 500 });
      }
    }

    // Insert into audit_logs
    const { error: auditError } = await (supabase.from('audit_logs') as any)
      .insert({
        document_id: document.id,
        actor_id: session.user.id,
        action: 'notice_created',
        metadata: {
          title,
          category,
          scope,
        },
      });

    if (auditError) {
      console.error('Audit log insert error:', auditError);
    }

    // Update document status to 'pending'
    const { error: updateStatusError } = await (supabase.from('documents') as any)
      .update({ status: 'pending' })
      .eq('id', document.id);

    if (updateStatusError) {
      console.error('Document status update error:', updateStatusError);
      return NextResponse.json({ error: 'Failed to update document status' }, { status: 500 });
    }

    // Return success response
    return NextResponse.json({
      document: { ...document, status: 'pending' },
      workflow,
    });
  } catch (error) {
    console.error('Notice creation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
