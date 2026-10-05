"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import SignaturePad from "@/components/SignaturePad";
import PDFSignaturePlacer from "@/components/PDFSignaturePlacer";

interface Document {
  id: string;
  title: string;
  type: string;
  department: string;
  scope: string;
  status: string;
  created_at: string;
  creator_id: string;
  file_url?: string;
}

interface Approval {
  id: string;
  workflow_id: string;
  step_order: number;
  status: string;
  signed_at: string | null;
  signature_url: string | null;
  viewable_signature_url?: string | null;
  comment?: string | null;
  acted_at?: string | null;
}

interface Workflow {
  id: string;
  document_id: string;
  generated_steps: any[];
}

export default function DocumentDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [document, setDocument] = useState<Document | null>(null);
  const [workflow, setWorkflow] = useState<Workflow | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [viewableFileUrl, setViewableFileUrl] = useState<string | null>(null);
  const [currentUserRole, setCurrentUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState<string | null>(null);
  
  // New state variables for signature embedding
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [showPlacer, setShowPlacer] = useState(false);
  const [isEmbedding, setIsEmbedding] = useState(false);
  const [embeddedSignaturePath, setEmbeddedSignaturePath] = useState<string | null>(null);
  
  const [rejectionComment, setRejectionComment] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchDocumentData = async () => {
    try {
      setLoading(true);
      setError(null);

      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const currentUserId = session?.user?.id;
      const currentUserEmail = session?.user?.email || "";

      setUserId(currentUserId);
      setUserEmail(currentUserEmail);

      // Fetch user role by email
      const { data: userData } = await (supabase.from("users") as any)
        .select("role")
        .eq("email", currentUserEmail)
        .single();

      const role = (userData as any)?.role || null;
      setCurrentUserRole(role);

      // Redirect students to /assignments
      if (role === "student") {
        router.replace("/assignments");
        return;
      }

      // Fetch document details
      const res = await fetch(`/api/documents/${params.id}`);
      if (!res.ok) {
        const errData = await res.json();
        throw new Error(errData.error || "Failed to fetch document");
      }

      const data = await res.json();
      setDocument(data.document);
      setWorkflow(data.workflow);
      setApprovals(data.approvals || []);
      setViewableFileUrl(data.viewable_file_url || null);

      setLoading(false);
    } catch (err: any) {
      console.error("Error fetching document:", err);
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDocumentData();
  }, [params.id, router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getBadgeClass = (status: string) => {
    switch (status) {
      case "draft":
        return "badge-draft";
      case "pending":
        return "badge-pending";
      case "approved":
        return "badge-approved";
      case "rejected":
        return "badge-rejected";
      default:
        return "badge-draft";
    }
  };

  const handleApprove = async () => {
    if (!signatureDataUrl || !pendingApproval) return;

    setIsSubmitting(true);
    setError(null);

    try {
      let signaturePath: string;

      if (!embeddedSignaturePath && !isPDF) {
        // Non-PDF: Upload signature separately
        const base64 = signatureDataUrl.split(',')[1];
        const fetchRes = await fetch(`data:image/png;base64,${base64}`);
        const blob = await fetchRes.blob();
        
        const formData = new FormData();
        formData.append('signature', blob, 'signature.png');
        formData.append('approval_id', pendingApproval.id);
        
        const sigRes = await fetch('/api/signatures/upload', {
          method: 'POST',
          body: formData
        });
        const sigData = await sigRes.json();
        if (!sigRes.ok) throw new Error(sigData.error || 'Upload failed');
        
        signaturePath = sigData.signature_url;
      } else {
        // PDF: Use embedded signature path
        signaturePath = embeddedSignaturePath!;
      }
      
      const actRes = await fetch('/api/approvals/' + pendingApproval.id + '/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'approve', 
          signature_url: signaturePath 
        })
      });
      const actData = await actRes.json();
      if (!actRes.ok) throw new Error(actData.error || 'Approval failed');
      
      setSignatureDataUrl(null);
      setEmbeddedSignaturePath(null);
      setShowPlacer(false);
      await fetchDocumentData();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!pendingApproval) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const actRes = await fetch('/api/approvals/' + pendingApproval.id + '/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'reject',
          comment: rejectionComment 
        })
      });
      const actData = await actRes.json();
      if (!actRes.ok) throw new Error(actData.error || 'Failed to reject');

      await fetchDocumentData();
    } catch (err: any) {
      setError(err.message || 'Something went wrong');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">
          Loading document...
        </p>
      </div>
    );
  }

  if (error && !document) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center px-6">
        <div className="card text-center max-w-md">
          <p className="text-red-500 font-poppins">{error}</p>
          <Link href="/dashboard" className="btn-secondary mt-4 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!document) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center px-6">
        <div className="card text-center max-w-md">
          <p className="text-red-500 font-poppins">Document not found</p>
          <Link href="/dashboard" className="btn-secondary mt-4 inline-block">
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  // Compute isPDF
  const isPDF = (document?.file_url ?? '').toLowerCase().includes('.pdf');

  const generatedSteps = workflow?.generated_steps ?? [];
  const pendingApproval = approvals?.find((a) => a.status === "pending");
  const rejectedApproval = approvals?.find((a) => a.status === "rejected");
  const pendingStep = pendingApproval
    ? generatedSteps.find(
        (s: any) => {
          const stepNum = s.stepOrder ?? s.step_order ?? s.StepOrder;
          return stepNum === pendingApproval.step_order;
        }
      )
    : null;
  const stepRole = pendingStep
    ? (pendingStep.requiredRole ?? pendingStep.required_role ?? pendingStep.role ?? '')
    : '';
  const isMyTurnToApprove =
    !!pendingStep &&
    !!pendingApproval &&
    !!currentUserRole &&
    stepRole.toLowerCase() === currentUserRole.toLowerCase();

  return (
    <div className="min-h-screen bg-college-bg">
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="text-college-secondary text-sm mb-4 inline-block font-poppins hover:underline"
        >
          ← Back to Dashboard
        </Link>

        {/* Rejection Notice (if document is rejected) */}
        {document.status === "rejected" && rejectedApproval && (
          <div className="bg-red-50 border-l-4 border-red-500 rounded-r-lg p-4 mb-6">
            <p className="text-sm font-semibold text-red-700 font-poppins mb-1">
              Rejected by {generatedSteps.find((s: any) => {
                const stepNum = s.stepOrder ?? s.step_order ?? s.StepOrder;
                return stepNum === rejectedApproval.step_order;
              })?.requiredRole || 'Approver'} on {rejectedApproval.acted_at ? formatDateTime(rejectedApproval.acted_at) : 'N/A'}
            </p>
            {rejectedApproval.comment && (
              <p className="text-sm text-red-600 font-poppins mt-2">
                {rejectedApproval.comment}
              </p>
            )}
          </div>
        )}

        {/* Section 1: Document Details */}
        <div className="card mb-6">
          <div className="flex justify-between flex-wrap gap-4">
            <h1 className="page-heading">{document.title}</h1>
            <span className={getBadgeClass(document.status)}>
              {document.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {/* Type */}
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Type</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {document.type}
              </p>
            </div>

            {/* Department */}
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Department</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {document.department}
              </p>
            </div>

            {/* Scope */}
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Scope</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {document.scope}
              </p>
            </div>

            {/* Created Date */}
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Created Date</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {formatDate(document.created_at)}
              </p>
            </div>
          </div>

          {viewableFileUrl && (
            <div className="mt-4">
              <a
                href={viewableFileUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                View Uploaded File
              </a>
            </div>
          )}
        </div>

        {/* Section 2: Workflow Steps */}
        <div className="card mb-6">
          <h2 className="section-heading">Approval Workflow</h2>
          <div className="mt-4">
            {generatedSteps.map((step: any, index: number) => {
              const stepApproval = approvals.find(
                (a) => a.step_order === step.stepOrder
              );
              const stepStatus = stepApproval?.status || "pending";

              let circleClass = "";
              if (stepStatus === "approved") {
                circleClass = "bg-college-secondary text-white";
              } else if (stepStatus === "rejected") {
                circleClass = "bg-red-500 text-white";
              } else {
                circleClass = "border-2 border-gray-300 text-gray-400 bg-white";
              }

              return (
                <div
                  key={index}
                  className="flex items-start gap-4 py-3 border-b border-college-peach"
                >
                  {/* Step Number Circle */}
                  <div
                    className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${circleClass}`}
                  >
                    {step.stepOrder}
                  </div>

                  {/* Step Content */}
                  <div className="flex-1">
                    <p className="font-semibold text-college-accent font-poppins text-sm">
                      Step {step.stepOrder} — {step.requiredRole} Approval
                    </p>

                    {stepApproval?.status === "approved" &&
                      stepApproval?.signed_at && (
                        <p className="text-xs text-gray-500 mt-1 font-poppins">
                          Signed on {formatDateTime(stepApproval.signed_at)}
                        </p>
                      )}

                    {stepApproval?.status === "approved" &&
                      stepApproval?.viewable_signature_url && (
                        <img
                          src={stepApproval.viewable_signature_url}
                          alt="Approval signature"
                          className="mt-2 border border-college-peach rounded p-1"
                          style={{ maxHeight: "60px" }}
                        />
                      )}

                    {stepApproval?.comment && (
                      <p className="text-xs text-gray-600 mt-2 font-poppins italic">
                        Comment: {stepApproval.comment}
                      </p>
                    )}
                  </div>

                  {/* Status Badge */}
                  <span className={getBadgeClass(stepStatus)}>
                    {stepStatus}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Section 3: Action Panel (New Signature Embedding Flow) */}
        {isMyTurnToApprove && (
          <div
            className="card mb-6"
            style={{ borderLeft: "4px solid #C06121" }}
          >
            <h2 className="section-heading">Your Approval Required</h2>

            <p className="text-sm text-gray-500 font-poppins mb-4">
              Please review the document above before signing
            </p>

            {/* STEP 1 — Signature Collection */}
            <SignaturePad
              onSave={(dataUrl) => {
                setSignatureDataUrl(dataUrl);
                setShowPlacer(false);
                setEmbeddedSignaturePath(null);
              }}
              disabled={isEmbedding || isSubmitting}
            />

            {/* STEP 2 — PDF Placement */}
            {isPDF && signatureDataUrl && (
              <div className="mt-4">
                <div className="bg-college-peach rounded-lg p-3 text-sm text-college-accent font-poppins mb-3">
                  PDF detected. Please place your signature on the document.
                </div>

                {!showPlacer && !embeddedSignaturePath && (
                  <button
                    onClick={() => setShowPlacer(true)}
                    disabled={isEmbedding || isSubmitting}
                    className="btn-secondary"
                  >
                    Place Signature on PDF
                  </button>
                )}

                {showPlacer && viewableFileUrl && (
                  <div className="mt-4">
                    <PDFSignaturePlacer
                      pdfUrl={viewableFileUrl}
                      signatureDataUrl={signatureDataUrl}
                      disabled={isEmbedding}
                      onCancel={() => setShowPlacer(false)}
                      onConfirm={async (placement) => {
                        setIsEmbedding(true);
                        setShowPlacer(false);
                        try {
                          const res = await fetch('/api/signatures/embed', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                              approval_id: pendingApproval.id,
                              signature_data_url: signatureDataUrl,
                              placement
                            })
                          });
                          const data = await res.json();
                          if (!res.ok) throw new Error(data.error || 'Embedding failed');
                          setEmbeddedSignaturePath(data.signed_pdf_path ?? data.signature_url);
                          setIsEmbedding(false);
                        } catch (err: any) {
                          setError(err.message);
                          setIsEmbedding(false);
                        }
                      }}
                    />
                  </div>
                )}

                {isEmbedding && (
                  <p className="text-college-secondary text-sm font-poppins mt-2">
                    Embedding signature...
                  </p>
                )}

                {embeddedSignaturePath && (
                  <div className="bg-green-50 border border-green-200 rounded-lg p-3 mt-3">
                    <p className="text-green-700 text-sm font-poppins">
                      ✓ Signature embedded into PDF successfully
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3 — Non-PDF Signature Info */}
            {!isPDF && signatureDataUrl && (
              <div className="bg-college-peach rounded-lg p-3 text-sm text-college-accent font-poppins mt-4">
                Your signature will be recorded alongside this document.
              </div>
            )}

            {/* Rejection Comment Textarea */}
            <div className="mt-6">
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Reason for rejection (required if rejecting)
              </label>
              <textarea
                value={rejectionComment}
                onChange={(e) => setRejectionComment(e.target.value)}
                placeholder="Please provide a reason for rejecting this document..."
                className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary resize-none"
                rows={4}
                disabled={isSubmitting || isEmbedding}
              />
            </div>

            {/* STEP 4 — Approve and Reject Buttons */}
            {signatureDataUrl && (isPDF ? embeddedSignaturePath !== null : true) && (
              <div className="flex gap-4 mt-4">
                <button
                  onClick={handleApprove}
                  disabled={isSubmitting || isEmbedding}
                  className="btn-primary"
                >
                  {isSubmitting ? 'Approving...' : 'Approve Document'}
                </button>

                <button
                  onClick={handleReject}
                  disabled={!rejectionComment.trim() || isSubmitting}
                  className="btn-danger"
                >
                  Reject
                </button>
              </div>
            )}

            {/* Inline Error */}
            {error && (
              <p className="text-red-500 text-sm mt-2 font-poppins">
                {error}
              </p>
            )}
          </div>
        )}

        {/* Info Box when not user's turn */}
        {!isMyTurnToApprove && document.status === "pending" && (
          <div className="bg-college-peach rounded-lg p-4 text-sm text-college-accent font-poppins mb-6">
            This document is awaiting approval from another authorized approver.
          </div>
        )}

        {/* Audit Trail Link */}
        <Link
          href={`/audit/${document.id}`}
          className="text-college-secondary text-sm font-poppins hover:underline"
        >
          View Audit Trail →
        </Link>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
