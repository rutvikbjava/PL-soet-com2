"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface ApprovalRecord {
  approvalId: string;
  documentId: string;
  documentTitle: string;
  documentType: string;
  documentStatus: string;
  stepOrder: number;
  approvalStatus: string;
  comment: string | null;
  actedAt: string | null;
  createdAt: string;
}

export default function MyApprovalsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [approvals, setApprovals] = useState<ApprovalRecord[]>([]);
  const [filteredApprovals, setFilteredApprovals] = useState<ApprovalRecord[]>([]);
  const [activeFilter, setActiveFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
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

        // Fetch user role
        const { data: userData } = await (supabase.from("users") as any)
          .select("role")
          .eq("email", currentUserEmail)
          .single();

        const role = (userData as any)?.role || null;
        setUserRole(role);

        // Fetch all approvals for this user
        const { data: approvalsData } = await (supabase.from("approvals") as any)
          .select("id, workflow_id, step_order, status, comment, acted_at, created_at")
          .eq("approver_id", currentUserId)
          .order("created_at", { ascending: false });

        const approvalsList = (approvalsData ?? []) as any[];

        // For each approval, fetch the workflow and document
        const recordsPromises = approvalsList.map(async (approval) => {
          // Fetch workflow
          const { data: workflowData } = await (supabase.from("workflows") as any)
            .select("document_id")
            .eq("id", approval.workflow_id)
            .single();

          if (!workflowData) return null;

          // Fetch document
          const { data: documentData } = await (supabase.from("documents") as any)
            .select("id, title, type, status")
            .eq("id", workflowData.document_id)
            .single();

          if (!documentData) return null;

          return {
            approvalId: approval.id,
            documentId: documentData.id,
            documentTitle: documentData.title,
            documentType: documentData.type,
            documentStatus: documentData.status,
            stepOrder: approval.step_order,
            approvalStatus: approval.status,
            comment: approval.comment,
            actedAt: approval.acted_at,
            createdAt: approval.created_at,
          } as ApprovalRecord;
        });

        const records = (await Promise.all(recordsPromises)).filter(
          (record) => record !== null
        ) as ApprovalRecord[];

        setApprovals(records);
        setFilteredApprovals(records);
        setLoading(false);
      } catch (err: any) {
        console.error("Fetch error:", err);
        setError(err.message || "An unexpected error occurred.");
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  useEffect(() => {
    // Filter approvals based on active filter
    if (activeFilter === "all") {
      setFilteredApprovals(approvals);
    } else if (activeFilter === "pending") {
      setFilteredApprovals(
        approvals.filter((record) => record.approvalStatus === "pending")
      );
    } else if (activeFilter === "approved") {
      setFilteredApprovals(
        approvals.filter((record) => record.approvalStatus === "approved")
      );
    } else if (activeFilter === "rejected") {
      setFilteredApprovals(
        approvals.filter((record) => record.approvalStatus === "rejected")
      );
    }
  }, [activeFilter, approvals]);

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const formatDocumentType = (type: string) => {
    switch (type) {
      case "notice":
        return "Notice";
      case "timetable":
        return "Timetable";
      case "exam_schedule":
        return "Examination Schedule";
      case "policy":
        return "Policy Document";
      default:
        return type;
    }
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
        return "bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold";
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

  if (error) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="card text-center">
            <p className="text-red-500 font-poppins">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Header */}
        <h1 className="page-heading">My Approval Records</h1>
        <p className="text-sm text-gray-500 font-poppins mb-6">
          Every document or notice sent to you for approval
        </p>

        {/* Filter Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveFilter("all")}
            className={`px-4 py-2 rounded-lg font-poppins text-sm font-medium transition-colors ${
              activeFilter === "all"
                ? "bg-college-secondary text-white"
                : "bg-white text-college-text border border-college-peach hover:bg-college-peach"
            }`}
          >
            All
          </button>
          <button
            onClick={() => setActiveFilter("pending")}
            className={`px-4 py-2 rounded-lg font-poppins text-sm font-medium transition-colors ${
              activeFilter === "pending"
                ? "bg-college-secondary text-white"
                : "bg-white text-college-text border border-college-peach hover:bg-college-peach"
            }`}
          >
            Pending My Action
          </button>
          <button
            onClick={() => setActiveFilter("approved")}
            className={`px-4 py-2 rounded-lg font-poppins text-sm font-medium transition-colors ${
              activeFilter === "approved"
                ? "bg-college-secondary text-white"
                : "bg-white text-college-text border border-college-peach hover:bg-college-peach"
            }`}
          >
            I Approved
          </button>
          <button
            onClick={() => setActiveFilter("rejected")}
            className={`px-4 py-2 rounded-lg font-poppins text-sm font-medium transition-colors ${
              activeFilter === "rejected"
                ? "bg-college-secondary text-white"
                : "bg-white text-college-text border border-college-peach hover:bg-college-peach"
            }`}
          >
            I Rejected
          </button>
        </div>

        {/* Table */}
        <div className="card">
          {filteredApprovals.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-8 font-poppins">
              No records found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Document Title</th>
                    <th className="table-header">Type</th>
                    <th className="table-header">My Step</th>
                    <th className="table-header">My Action</th>
                    <th className="table-header">Document Status</th>
                    <th className="table-header">Acted On</th>
                    <th className="table-header">View</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredApprovals.map((record) => (
                    <tr key={record.approvalId} className="table-row">
                      <td className="px-4 py-3">
                        <Link
                          href={`/documents/${record.documentId}`}
                          className="text-college-secondary text-sm font-poppins hover:underline"
                        >
                          {record.documentTitle}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        {formatDocumentType(record.documentType)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        Step {record.stepOrder}
                      </td>
                      <td className="px-4 py-3">
                        <span className={getBadgeClass(record.approvalStatus)}>
                          {record.approvalStatus === "pending"
                            ? "Pending"
                            : record.approvalStatus === "approved"
                            ? "Approved"
                            : "Rejected"}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <span className={getBadgeClass(record.documentStatus)}>
                          {record.documentStatus}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                        {formatDate(record.actedAt)}
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/documents/${record.documentId}`}
                          className="text-college-secondary text-sm font-poppins hover:underline"
                        >
                          Open
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
