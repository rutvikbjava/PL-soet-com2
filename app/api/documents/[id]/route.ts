import { NextRequest, NextResponse } from 'next/server';
import { createServerClient, getSignedUrl } from '@/lib/supabase';
import { getSession } from '@/lib/auth';

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const documentId = params.id;

    // Verify authenticated user
    const { user } = await getSession();
    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      );
    }

    const supabase = await createServerClient();

    // Fetch the document row
    const { data, error: docError } = await supabase
      .from('documents')
      .select('*')
      .eq('id', documentId)
      .single();

    const document = data as any;

    if (docError || !document) {
      return NextResponse.json(
        { error: 'Document not found.' },
        { status: 404 }
      );
    }

    // Generate signed URL for document file if it exists
    let viewable_file_url: string | null = null;
    if (document.file_url) {
      try {
        viewable_file_url = await getSignedUrl('documents', document.file_url);
      } catch (error) {
        console.error('Failed to generate signed URL for document file:', error);
      }
    }

    // Fetch the related workflow
    const { data: workflowData, error: workflowError } = await supabase
      .from('workflows')
      .select('*')
      .eq('document_id', documentId)
      .single();

    const workflow = workflowData as any;

    if (workflowError || !workflow) {
      return NextResponse.json(
        { error: 'Workflow not found.' },
        { status: 404 }
      );
    }

    // Fetch all approval rows for the workflow
    const { data: approvalsData, error: approvalsError } = await supabase
      .from('approvals')
      .select('*')
      .eq('workflow_id', workflow.id)
      .order('step_order', { ascending: true });

    const approvals = (approvalsData ?? []) as any[];

    if (approvalsError) {
      return NextResponse.json(
        { error: 'Failed to fetch approvals.' },
        { status: 500 }
      );
    }

    // Generate signed URLs for signatures
    const approvalsWithSignatures = await Promise.all(
      approvals.map(async (approval: any) => {
        if (approval.signature_url) {
          try {
            const viewable_signature_url = await getSignedUrl(
              'signatures',
              approval.signature_url
            );
            return {
              ...approval,
              viewable_signature_url,
            };
          } catch (error) {
            console.error(
              `Failed to generate signed URL for signature ${approval.signature_url}:`,
              error
            );
            return approval;
          }
        }
        return approval;
      })
    );

    return NextResponse.json({
      document,
      viewable_file_url,
      workflow,
      approvals: approvalsWithSignatures,
    });
  } catch (error) {
    console.error('Error fetching document:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
