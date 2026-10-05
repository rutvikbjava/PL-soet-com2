import { NextRequest, NextResponse } from 'next/server';
import { getSession } from '@/lib/auth';
import { createAdminClient } from '@/lib/supabase';
import { embedSignatureIntoPDF } from '@/lib/pdf-signer';

export async function POST(request: NextRequest) {
  try {
    // Verify user authentication
    const session = await getSession();
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    const body = await request.json();
    const { approval_id, signature_data_url, placement } = body;

    // Validate required fields
    if (!approval_id || !signature_data_url || !placement) {
      return NextResponse.json(
        { error: 'Missing required fields: approval_id, signature_data_url, placement' },
        { status: 400 }
      );
    }

    const adminClient = createAdminClient();

    // Fetch the approval row
    const { data: approval, error: approvalError } = await (adminClient
      .from('approvals') as any)
      .select('id, status, workflow_id, step_order')
      .eq('id', approval_id)
      .single();

    if (approvalError || !approval) {
      return NextResponse.json({ error: 'Approval not found' }, { status: 404 });
    }

    if (approval.status !== 'pending') {
      return NextResponse.json(
        { error: 'Approval is not in pending status' },
        { status: 404 }
      );
    }

    // Fetch the workflow to get document_id
    const { data: workflow, error: workflowError } = await (adminClient
      .from('workflows') as any)
      .select('document_id')
      .eq('id', approval.workflow_id)
      .single();

    if (workflowError || !workflow || !workflow.document_id) {
      return NextResponse.json({ error: 'Workflow not found' }, { status: 404 });
    }

    // Fetch the document to get file_url
    const { data: document, error: documentError } = await (adminClient
      .from('documents') as any)
      .select('file_url, type')
      .eq('id', workflow.document_id)
      .single();

    if (documentError || !document) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    // Check if file is a PDF
    const isPDF =
      document.file_url?.toLowerCase().endsWith('.pdf') ||
      document.file_url?.includes('.pdf');

    if (isPDF) {
      // Embed signature into PDF
      const { signedPdfPath, error: embedError } = await embedSignatureIntoPDF(
        document.file_url,
        signature_data_url,
        placement
      );

      if (embedError || !signedPdfPath) {
        return NextResponse.json(
          { error: embedError || 'Failed to embed signature into PDF' },
          { status: 500 }
        );
      }

      // Update document file_url to signedPdfPath
      const { error: updateDocError } = await (adminClient
        .from('documents') as any)
        .update({ file_url: signedPdfPath })
        .eq('id', workflow.document_id);

      if (updateDocError) {
        console.error('Failed to update document file_url:', updateDocError);
      }

      // Update approval with signature info
      const { error: updateApprovalError } = await (adminClient
        .from('approvals') as any)
        .update({
          signature_url: signedPdfPath,
          signed_at: new Date().toISOString(),
        })
        .eq('id', approval_id);

      if (updateApprovalError) {
        console.error('Failed to update approval:', updateApprovalError);
        return NextResponse.json(
          { error: 'Failed to update approval record' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        signed_pdf_path: signedPdfPath,
        embedded: true,
      });
    } else {
      // Upload signature as separate PNG file
      const base64 = signature_data_url.split(',')[1];
      const buffer = Buffer.from(base64, 'base64');

      const timestamp = Date.now();
      const uploadPath = `${session.user.id}/${approval_id}_${timestamp}.png`;

      const { error: uploadError } = await adminClient.storage
        .from('signatures')
        .upload(uploadPath, buffer, {
          contentType: 'image/png',
          upsert: true,
        });

      if (uploadError) {
        console.error('Failed to upload signature:', uploadError);
        return NextResponse.json(
          { error: 'Failed to upload signature' },
          { status: 500 }
        );
      }

      // Update approval with signature info
      const { error: updateApprovalError } = await (adminClient
        .from('approvals') as any)
        .update({
          signature_url: uploadPath,
          signed_at: new Date().toISOString(),
        })
        .eq('id', approval_id);

      if (updateApprovalError) {
        console.error('Failed to update approval:', updateApprovalError);
        return NextResponse.json(
          { error: 'Failed to update approval record' },
          { status: 500 }
        );
      }

      return NextResponse.json({
        success: true,
        signature_url: uploadPath,
        embedded: false,
      });
    }
  } catch (error) {
    console.error('Signature embed error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
