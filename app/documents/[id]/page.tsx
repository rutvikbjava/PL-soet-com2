"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import SignaturePad from "@/components/SignaturePad";

interface Document {
  id: string;
  title: string;
  type: string;
  department: string;
  scope: string;
  status: string;
  created_at: string;
  creator_id: string;
}

interface Approval {
  id: string;
  workflow_id: string;
  step_order: number;
  status: string;
  signed_at: string | null;
  signature_url: string | null;
  viewable_signature_url?: string | null;
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
  const [savedSignatureDataUrl, setSavedSignatureDataUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [actionError, setActionError] = useState<string | null>(null);

  const fetchDocumentData = async () => {
    try {
      setLoading(true);
      setError("");

      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const currentUserId = session?.user?.id;
      const currentUserEmail = session?.user?.email;

      setUserId(currentUserId);
      setUserEmail(currentUserEmail || null);

      // Fetch user role
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", currentUserId)
        .single();

      const role = (userData as any)?.role || null;
      setCurrentUserRole(role);

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
    if (!savedSignatureDataUrl || !pendingApproval) return

    setIsSubmitting(true)
    setError(null)

    try {
      const fetchRes = await fetch(savedSignatureDataUrl)
      const blob = await fetchRes.blob()
      
      const formData = new FormData()
      formData.append('signature', blob, 'signature.png')
      formData.append('approval_id', pendingApproval.id)
      
      const sigRes = await fetch('/api/signatures/upload', {
        method: 'POST',
        body: formData
      })
      const sigData = await sigRes.json()
      if (!sigRes.ok) throw new Error(sigData.error || 'Failed to upload signature')
      
      const actRes = await fetch('/api/approvals/' + pendingApproval.id + '/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          action: 'approve', 
          signature_url: sigData.signature_url 
        })
      })
      const actData = await actRes.json()
      if (!actRes.ok) throw new Error(actData.error || 'Failed to approve')
      
      setSavedSignatureDataUrl(null)
      await fetchDocumentData()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReject = async () => {
    if (!pendingApproval) return

    setIsSubmitting(true)
    setError(null)

    try {
      const actRes = await fetch('/api/approvals/' + pendingApproval.id + '/act', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reject' })
      })
      const actData = await actRes.json()
      if (!actRes.ok) throw new Error(actData.error || 'Failed to reject')

      await fetchDocumentData()
    } catch (err: any) {
      setError(err.message || 'Something went wrong')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">
          Loading document...
        </p>
      </div>
    );
  }

  if (error) {
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

  const generatedSteps = workflow?.generated_steps ?? [];
  const pendingApproval = approvals?.find((a) => a.status === "pending");
  const pendingStep = pendingApproval
    ? generatedSteps.find(
        (s: any) => {
          const stepNum = s.stepOrder ?? s.step_order ?? s.StepOrder
          return stepNum === pendingApproval.step_order
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

  console.log('pendingApproval:', pendingApproval);
  console.log('pendingStep:', pendingStep);
  console.log('stepRole:', stepRole);
  console.log('currentUserRole:', currentUserRole);
  console.log('isMyTurnToApprove:', isMyTurnToApprove);

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

        {/* Section 3: Action Panel (only when isMyTurnToApprove) */}
        {isMyTurnToApprove && (
          <div
            className="card mb-6"
            style={{ borderLeft: "4px solid #C06121" }}
          >
            <h2 className="section-heading">Your Approval Required</h2>

            <p className="text-sm text-gray-500 font-poppins mb-2">
              This document requires your approval as{" "}
              <strong>{currentUserRole}</strong>
            </p>

            <p className="text-sm text-gray-400 font-poppins mb-4">
              Please review the document above before signing
            </p>

            {/* Signature Pad */}
            <SignaturePad
              onSave={(dataUrl) => setSavedSignatureDataUrl(dataUrl)}
            />

            {/* Action Buttons */}
            <div className="flex gap-4 mt-4">
              <button
                type="button"
                onClick={handleApprove}
                disabled={!savedSignatureDataUrl || isSubmitting}
                className="btn-primary"
              >
                {isSubmitting ? "Approving..." : "Approve with Signature"}
              </button>

              <button
                type="button"
                onClick={handleReject}
                disabled={isSubmitting}
                className="btn-danger"
              >
                Reject Document
              </button>
            </div>

            {/* Inline Error */}
            {actionError && (
              <p className="text-red-500 text-sm mt-2 font-poppins">
                {actionError}
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
