"use client";

import { useState, useEffect } from "react";
import { createBrowserClient, getSignedUrl } from "@/lib/supabase";

interface Document {
  id: string;
  title: string;
  type: string;
  department: string;
  scope: string;
  status: string;
  created_at: string;
  file_url?: string;
  publicly_verifiable?: boolean;
}

interface Approval {
  id: string;
  step_order: number;
  status: string;
  comment?: string;
  acted_at?: string;
  approver_id?: string;
  approver_name?: string;
  approver_role?: string;
}

export default function VerifyPage({ params }: { params: { id: string } }) {
  const [document, setDocument] = useState<Document | null>(null);
  const [approvals, setApprovals] = useState<Approval[]>([]);
  const [viewableFileUrl, setViewableFileUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAvailable, setIsAvailable] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
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

        // Check if document is publicly verifiable
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

        // Get signed URL for file if exists
        if (doc.file_url) {
          try {
            const url = await getSignedUrl("documents", doc.file_url);
            setViewableFileUrl(url);
          } catch (err) {
            console.error("Failed to get signed URL:", err);
          }
        }

        // Fetch workflow
        const { data: workflowData, error: workflowError } = await (supabase
          .from("workflows") as any)
          .select("id, generated_steps")
          .eq("document_id", params.id)
          .single();

        if (workflowError || !workflowData) {
          setLoading(false);
          return;
        }

        const workflow = workflowData as any;
        const generatedSteps = workflow.generated_steps || [];

        // Fetch approvals
        const { data: approvalsData, error: approvalsError } = await (supabase
          .from("approvals") as any)
          .select("id, step_order, status, comment, acted_at, approver_id")
          .eq("workflow_id", workflow.id)
          .order("step_order", { ascending: true });

        if (approvalsError) {
          setLoading(false);
          return;
        }

        const approvalsList = (approvalsData || []) as any[];

        // For each approval, get approver name or role
        const enrichedApprovals = await Promise.all(
          approvalsList.map(async (approval: any) => {
            if (approval.approver_id) {
              // Fetch user name
              const { data: userData } = await (supabase
                .from("users") as any)
                .select("full_name, role")
                .eq("id", approval.approver_id)
                .single();

              if (userData) {
                return {
                  ...approval,
                  approver_name: userData.full_name,
                  approver_role: userData.role,
                };
              }
            }

            // Fallback to role from workflow steps
            const step = generatedSteps.find(
              (s: any) =>
                (s.stepOrder ?? s.step_order ?? s.StepOrder) ===
                approval.step_order
            );

            const role =
              step?.requiredRole ?? step?.required_role ?? step?.role ?? "";

            return {
              ...approval,
              approver_name: null,
              approver_role: role,
            };
          })
        );

        setApprovals(enrichedApprovals);
        setLoading(false);
      } catch (err) {
        console.error("Error fetching verification data:", err);
        setIsAvailable(false);
        setLoading(false);
      }
    };

    fetchData();
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

  const getCircleClass = (status: string) => {
    if (status === "approved") {
      return "bg-college-secondary text-white";
    } else if (status === "rejected") {
      return "bg-red-500 text-white";
    } else {
      return "border-2 border-gray-300 text-gray-400 bg-white";
    }
  };

  const getBadgeClass = (status: string) => {
    if (status === "approved") {
      return "badge-approved";
    } else if (status === "rejected") {
      return "bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold";
    } else {
      return "badge-pending";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading...</p>
      </div>
    );
  }

  if (!isAvailable) {
    return (
      <div className="min-h-screen bg-college-bg flex flex-col items-center justify-center">
        <p className="text-gray-500 py-20 text-center font-poppins">
          This document is not available for public verification.
        </p>
        <p className="text-xs text-gray-400 text-center mt-4 font-poppins">
          EduSphere AI — MGM University SOET
        </p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      {/* Header */}
      <header className="bg-college-accent text-white py-4 px-8">
        <div className="max-w-5xl mx-auto flex justify-between items-center">
          <h1 className="font-poppins font-bold text-xl">EduSphere AI</h1>
          <p className="text-sm font-poppins">MGM University SOET</p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Card 1: Document Details */}
        <div className="card">
          <div className="flex items-center gap-3 mb-2">
            <span className={getBadgeClass(document?.status || "")}>
              {document?.status}
            </span>
            <span className="text-xs text-gray-400 font-poppins">
              Verified Document
            </span>
          </div>

          <h2 className="text-2xl font-bold text-college-accent font-poppins mt-2">
            {document?.title}
          </h2>

          <div className="grid grid-cols-2 gap-3 mt-4">
            {/* Type */}
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Type</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {document?.type}
              </p>
            </div>

            {/* Department */}
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Department</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {document?.department}
              </p>
            </div>

            {/* Scope */}
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Scope</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {document?.scope}
              </p>
            </div>

            {/* Created On */}
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-xs text-gray-500 font-poppins">Created On</p>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {document?.created_at ? formatDate(document.created_at) : "N/A"}
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
                View Document
              </a>
            </div>
          )}
        </div>

        {/* Card 2: Approval Chain */}
        <div className="card mt-6">
          <h3 className="section-heading">Approval Chain</h3>

          <div className="mt-4">
            {approvals.map((approval, index) => (
              <div
                key={approval.id}
                className="flex items-start gap-4 py-3 border-b border-college-peach"
              >
                {/* Step Number Circle */}
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold ${getCircleClass(
                    approval.status
                  )}`}
                >
                  {approval.step_order}
                </div>

                {/* Center Content */}
                <div className="flex-1">
                  <p className="font-semibold text-college-accent font-poppins text-sm">
                    Step {approval.step_order} —{" "}
                    {approval.approver_name || approval.approver_role || "Unknown"}
                  </p>

                  {approval.approver_role && (
                    <p className="text-xs text-gray-500 font-poppins">
                      {approval.approver_role}
                    </p>
                  )}

                  {approval.acted_at && (
                    <p className="text-xs text-gray-400 font-poppins">
                      on {formatDateTime(approval.acted_at)}
                    </p>
                  )}

                  {approval.comment && (
                    <p className="italic text-xs text-gray-500 font-poppins mt-1">
                      {approval.comment}
                    </p>
                  )}
                </div>

                {/* Right: Status Badge */}
                <span className={getBadgeClass(approval.status)}>
                  {approval.status}
                </span>
              </div>
            ))}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 py-8 font-poppins">
        This is an automated verification page generated by EduSphere AI.
        <br />
        Verify this document only through its official link.
      </footer>
    </div>
  );
}
