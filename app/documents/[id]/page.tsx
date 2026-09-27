"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import SignaturePad from "@/components/SignaturePad";

interface Document {
  id: string;
  title: string;
  type: string;
  department: string;
  scope: string;
  status: string;
  created_at: string;
}

interface Approval {
  id: string;
  step_order: number;
  required_role: string;
  status: string;
  signed_at?: string;
  viewable_signature_url?: string;
}

interface Workflow {
  id: string;
  document_id: string;
}

interface DocumentData {
  document: Document;
  viewable_file_url: string | null;
  workflow: Workflow;
  approvals: Approval[];
}

export default function DocumentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [data, setData] = useState<DocumentData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [savedSignatureDataUrl, setSavedSignatureDataUrl] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [actionError, setActionError] = useState("");

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

      setUserEmail(session.user.email || "");

      // Get user role
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (userData) {
        setUserRole(userData.role);
      }

      // Fetch document data
      const response = await fetch(`/api/documents/${documentId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to fetch document.");
        setLoading(false);
        return;
      }

      setData(result);
      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (documentId) {
      fetchDocumentData();
    }
  }, [documentId]);

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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const handleSignatureSave = (dataUrl: string) => {
    setSavedSignatureDataUrl(dataUrl);
  };

  const handleApprove = async (approvalId: string) => {
    if (!savedSignatureDataUrl) {
      setActionError("Please save your signature first.");
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");

      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setActionError("Session expired. Please log in again.");
        setActionLoading(false);
        return;
      }

      // Convert dataUrl to Blob
      const blob = await fetch(savedSignatureDataUrl).then((r) => r.blob());

      // Upload signature
      const formData = new FormData();
      formData.append("signature", blob, "signature.png");
      formData.append("approval_id", approvalId);

      const uploadResponse = await fetch("/api/signatures/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const uploadResult = await uploadResponse.json();

      if (!uploadResponse.ok) {
        setActionError(uploadResult.error || "Failed to upload signature.");
        setActionLoading(false);
        return;
      }

      const { signature_url } = uploadResult;

      // Approve with signature
      const approveResponse = await fetch(`/api/approvals/${approvalId}/act`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "approve",
          signature_url,
        }),
      });

      const approveResult = await approveResponse.json();

      if (!approveResponse.ok) {
        setActionError(approveResult.error || "Failed to approve document.");
        setActionLoading(false);
        return;
      }

      // Success - refetch data and reset signature
      setSavedSignatureDataUrl(null);
      await fetchDocumentData();
      setActionLoading(false);
    } catch (err) {
      console.error("Approve error:", err);
      setActionError("An unexpected error occurred during approval.");
      setActionLoading(false);
    }
  };

  const handleReject = async (approvalId: string) => {
    if (!confirm("Are you sure you want to reject this document?")) {
      return;
    }

    try {
      setActionLoading(true);
      setActionError("");

      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setActionError("Session expired. Please log in again.");
        setActionLoading(false);
        return;
      }

      const response = await fetch(`/api/approvals/${approvalId}/act`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: "reject",
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setActionError(result.error || "Failed to reject document.");
        setActionLoading(false);
        return;
      }

      // Success - refetch data
      await fetchDocumentData();
      setActionLoading(false);
    } catch (err) {
      console.error("Reject error:", err);
      setActionError("An unexpected error occurred during rejection.");
      setActionLoading(false);
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

  if (error) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="card text-center">
            <p className="text-red-500 font-poppins">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  const { document, viewable_file_url, approvals } = data;

  // Find pending approval that matches user role
  const pendingApproval = approvals.find(
    (approval) =>
      approval.status === "pending" && approval.required_role === userRole
  );

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="text-college-secondary text-sm font-poppins mb-4 inline-block hover:underline"
        >
          ← Back to Dashboard
        </Link>

        {/* Section 1: Document Details */}
        <div className="card mb-6">
          <div className="flex justify-between items-start flex-wrap gap-4 mb-4">
            <h1 className="page-heading">{document.title}</h1>
            <span className={getBadgeClass(document.status)}>
              {document.status}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mt-4">
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Type</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {document.type}
              </p>
            </div>
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Department</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {document.department}
              </p>
            </div>
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Scope</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {document.scope}
              </p>
            </div>
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Created</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {formatDate(document.created_at)}
              </p>
            </div>
          </div>

          {viewable_file_url && (
            <a
              href={viewable_file_url}
              target="_blank"
              rel="noopener noreferrer"
              className="btn-secondary mt-4 inline-flex items-center gap-2"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                />
              </svg>
              View Uploaded File
            </a>
          )}
        </div>

        {/* Section 2: Workflow Steps */}
        <div className="card mb-6">
          <h2 className="section-heading">Approval Workflow</h2>
          <div className="space-y-4">
            {approvals.map((approval) => (
              <div key={approval.id} className="flex gap-4">
                {/* Circle with step number */}
                <div
                  className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 font-bold text-sm font-poppins ${
                    approval.status === "approved"
                      ? "bg-college-secondary text-white"
                      : approval.status === "rejected"
                      ? "bg-red-500 text-white"
                      : "border-2 border-gray-300 text-gray-400"
                  }`}
                >
                  {approval.step_order}
                </div>

                {/* Step details */}
                <div className="flex-1">
                  <div className="flex justify-between items-start flex-wrap gap-2">
                    <p className="font-semibold text-college-accent font-poppins">
                      Step {approval.step_order} — {approval.required_role}{" "}
                      Approval
                    </p>
                    <span className={getBadgeClass(approval.status)}>
                      {approval.status}
                    </span>
                  </div>

                  {approval.status === "approved" && approval.signed_at && (
                    <p className="text-xs text-gray-500 font-poppins mt-1">
                      Signed on {formatDate(approval.signed_at)}
                    </p>
                  )}

                  {approval.status === "approved" &&
                    approval.viewable_signature_url && (
                      <img
                        src={approval.viewable_signature_url}
                        alt="Signature"
                        className="max-h-14 border border-college-peach rounded p-1 mt-2"
                      />
                    )}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: Action Panel */}
        {pendingApproval && (
          <div className="card border-l-4 border-college-secondary mb-6">
            <h2 className="section-heading">Your Approval Required</h2>
            <p className="text-sm text-gray-500 font-poppins mb-4">
              Please review the document above before signing
            </p>

            <div className="mb-6">
              <SignaturePad
                onSave={handleSignatureSave}
                disabled={actionLoading}
              />
              {savedSignatureDataUrl && (
                <p className="mt-2 text-sm text-green-600 font-poppins">
                  ✓ Signature saved and ready to use
                </p>
              )}
            </div>

            {actionError && (
              <div className="mb-4 text-red-500 text-sm font-poppins">
                {actionError}
              </div>
            )}

            <div className="flex gap-3 flex-wrap">
              <button
                onClick={() => handleApprove(pendingApproval.id)}
                disabled={!savedSignatureDataUrl || actionLoading}
                className="btn-primary"
              >
                {actionLoading ? "Processing..." : "Approve with Signature"}
              </button>
              <button
                onClick={() => handleReject(pendingApproval.id)}
                disabled={actionLoading}
                className="btn-danger"
              >
                {actionLoading ? "Processing..." : "Reject Document"}
              </button>
            </div>
          </div>
        )}

        {/* Audit Link */}
        <Link
          href={`/audit/${documentId}`}
          className="text-college-secondary text-sm font-poppins hover:underline inline-block"
        >
          View Audit Trail →
        </Link>
      </main>
    </div>
  );
}
