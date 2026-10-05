import { PDFDocument } from 'pdf-lib';
import { createAdminClient } from './supabase';

interface SignaturePlacement {
  x: number;
  y: number;
  width: number;
  height: number;
  page: number;
}

export async function embedSignatureIntoPDF(
  pdfStoragePath: string,
  signatureDataUrl: string,
  placement: SignaturePlacement
): Promise<{ signedPdfPath: string; error: string | null }> {
  try {
    const adminClient = createAdminClient();

    // 1. Download the original PDF from Supabase storage
    const { data: pdfBlob, error: downloadError } = await adminClient.storage
      .from('documents')
      .download(pdfStoragePath);

    if (downloadError || !pdfBlob) {
      return { signedPdfPath: '', error: 'Failed to download PDF' };
    }

    // Convert blob to ArrayBuffer
    const arrayBuffer = await pdfBlob.arrayBuffer();

    // 2. Load the PDF using pdf-lib
    const pdfDoc = await PDFDocument.load(arrayBuffer);

    // 3. Convert signature dataUrl to bytes
    const base64Data = signatureDataUrl.split(',')[1];
    const signatureBytes = Uint8Array.from(Buffer.from(base64Data, 'base64'));

    // Detect image type and embed
    const isPng = signatureDataUrl.includes('image/png');
    const sigImage = isPng
      ? await pdfDoc.embedPng(signatureBytes)
      : await pdfDoc.embedJpg(signatureBytes);

    // 4. Get the target page (0-indexed)
    const pages = pdfDoc.getPages();
    const targetPage = pages[placement.page] ?? pages[pages.length - 1];
    const { height: pageHeight } = targetPage.getSize();

    // 5. Draw the signature image on the page
    // Note: pdf-lib uses bottom-left origin so y must be flipped
    targetPage.drawImage(sigImage, {
      x: placement.x,
      y: pageHeight - placement.y - placement.height,
      width: placement.width,
      height: placement.height,
    });

    // 6. Save the signed PDF
    const signedPdfBytes = await pdfDoc.save();

    // 7. Upload signed PDF back to Supabase storage
    let signedPath: string;
    if (pdfStoragePath.includes('.pdf')) {
      signedPath = pdfStoragePath.replace('.pdf', '_signed.pdf');
    } else {
      signedPath = pdfStoragePath + '_signed.pdf';
    }

    const { error: uploadError } = await adminClient.storage
      .from('documents')
      .upload(signedPath, signedPdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      });

    if (uploadError) {
      return { signedPdfPath: '', error: 'Failed to upload signed PDF' };
    }

    // 8. Return success
    return { signedPdfPath: signedPath, error: null };
  } catch (error) {
    console.error('PDF signature embedding error:', error);
    return { signedPdfPath: '', error: 'Failed to embed signature' };
  }
}
