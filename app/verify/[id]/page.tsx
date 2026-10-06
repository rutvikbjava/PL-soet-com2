"use client";

import { useState, useEffect } from "react";
import { createBrowserClient } from "@/lib/supabase";

interface Document {
  id: string;
  title: string;
  type: string;
  department: string;
  scope: string;
  file_url: string | null;
  status: string;
  created_at: string;
  publicly_verifiable: boolean;
}

interface Workflow {
  id: string;
  document_id: string;
}

interface Approval {
  id: string;
  workflow_id: string;
  approver_id: string;
  step_order: number;
  status: string;
  comment: string | null;
  acted_at: string | null;
  approver_name: string | null;
  approver_role: string | null;
}

export default function PublicVerificationPage({
  params,
}: {
  params: { id: string };
}) {
  const [document, setDocument] = useState<Document | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const fetchVerificationData = async () => {
      try {
        setLoading(true);

        const supabase = createBrowserClient();

        // Fetch document
        const { data: docData, error: docError } = await (supabase
          .from("documents") as any)
          .select("*")
          .eq("id", params.id)
          .single();

        if (docError || !docData) {
          setIsAvailable(false);
          setLoading(false);
          return;
        }

        const doc = docData as Document;

        // Check if document is available for public verification
        if (
          !doc.publicly_verifiable ||
          doc.status === "draft" ||
          doc.status === "pending"
        ) {
          setIsAvailable(false);
          setLoading(false);
          return;
        }

        setDocument(doc);
        setIsAvailable(true);

        // Fetch workflow
        const { data: workflowData } = await (supabase
          .from("workflows") as any)
          .select("id")
          .eq("document_id", params.id)
          .single();

        if (!workflowData) {
          setLoading(false);
          return;
        }

        const workflow = workflowData as Workflow;

        // Fetch approvals with user info
        const { data: approvalsData } = await (supabase
          .from("approvals") as any)
          .select(
            `
            id,
            workflow_id,
            approver_id,
            step_order,
            status,
            comment,
            acted_at
          `
          )
          .eq("workflow_id", workflow.id)
          .order("step_order", { ascending: true });

        const approvalsList = (approvalsData ?? []) as Approval[];

        // Fetch approver details for each approval
        const approvalsWithUsers = await Promise.all(
          approvalsList.map(async (approval) => {
            const { data: userData } = await (supabase
              .from("users") as any)
              .select("full_name, role")
              .eq("id", approval.approver_id)
              .single();

            return {
              ...approval,
              approver_name: userData?.full_name ?? null,
              approver_role: userData?.role ?? null,
            };
          })
        );

        setApprovals(approvalsWithUsers);
        setLoading(false);
      } catch (err) {
        console.error("Verification fetch error:", err);
        setIsAvailable(false);
        setLoading(false);
      }
    };

    fetchVerificationData();
  }, [params.id]);

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
      case "approved":
        return "badge-approved";
      case "rejected":
        return "bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold";
      case "pending":
        return "badge-pending";
      default:
        return "badge-draft";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading...</p>
      </div>
    );
  }

  if (!isAvailable || !document) {
    return (
      <div className="min-h-screen bg-college-bg flex flex-col">
        <div className="flex-1 flex items-center justify-center py-20">
          <p className="text-gray-500 text-center font-poppins text-lg">
            This document is not available for public verification.
          </p>
        </div>
        <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
          © MGM University SOET | EduSphere AI
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="page-heading">EduSphere AI — Document Verification</h1>
          <p className="text-sm text-gray-500 font-poppins mt-1">
            MGM University SOET
          </p>
        </div>

        {/* Document Details Card */}
        <div className="card mb-6">
          <div className="flex justify-between flex-wrap gap-4 mb-4">
            <h2 className="text-2xl font-bold text-college-accent font-poppins">
              {document.title}
            </h2>
            <span className={getBadgeClass(document.status)}>
              {document.status === "approved" ? "Approved" : "Rejected"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-3 mb-4">
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

            {/* Created On */}
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Created On</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {formatDate(document.created_at)}
              </p>
            </div>
          </div>

          {/* View Document Button */}
          {document.file_url && (
            <div className="mt-4">
              <a
                href={document.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="btn-secondary"
              >
                View Document
              </a>
            </div>
          )}
        </div>

        {/* Approval Chain Card */}
        <div className="card mb-6">
          <h2 className="section-heading mb-4">Approval Chain</h2>
          
          {approvals.length === 0 ? (
            <p className="text-sm text-gray-500 font-poppins">
              No approval records found.
            </p>
          ) : (
            <div className="space-y-4">
              {approvals.map((approval) => (
                <div
                  key={approval.id}
                  className="border-b border-college-peach pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="text-sm font-semibold text-college-accent font-poppins">
                          Step {approval.step_order}
                        </p>
                        <span className={getBadgeClass(approval.status)}>
                          {approval.status}
                        </span>
                      </div>
                      
                      <p className="text-sm text-gray-700 font-poppins">
                        {approval.approver_name || "Unknown"}{" "}
                        {approval.approver_role && (
                          <span className="text-gray-500">
                            ({approval.approver_role.toUpperCase()})
                          </span>
                        )}
                      </p>

                      {approval.acted_at && (
                        <p className="text-xs text-gray-500 font-poppins mt-1">
                          {formatDateTime(approval.acted_at)}
                        </p>
                      )}

                      {approval.comment && (
                        <p className="text-sm text-gray-600 font-poppins mt-2 italic">
                          {approval.comment}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        This is an automated verification page generated by EduSphere AI.
        <br />
        Verify this document only through its official link.
      </footer>
    </div>
  );
}
