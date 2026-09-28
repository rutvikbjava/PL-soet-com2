"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

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

interface PendingApprovalDocument {
  approvalId: string;
  document: Document;
  stepOrder: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [myDocuments, setMyDocuments] = useState<Document[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
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

        const userId = session?.user?.id;
        setUserEmail(session.user.email || "");

        // Fetch user role
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("id", userId)
          .single();

        const role = (userData as any)?.role || null;
        setUserRole(role);

        // Fetch My Documents
        const { data: myDocs, error: myDocsError } = await supabase
          .from("documents")
          .select("*")
          .eq("creator_id", userId)
          .order("created_at", { ascending: false });

        if (myDocsError) {
          console.error("Error fetching my documents:", myDocsError);
        } else {
          setMyDocuments((myDocs || []) as Document[]);
        }

        // Fetch Pending Approvals (only for hod, coe, principal)
        if (role === "hod" || role === "coe" || role === "principal") {
          const { data: approvals } = await supabase
            .from("approvals")
            .select(`
              id,
              step_order,
              status,
              workflows (
                id,
                document_id,
                generated_steps,
                documents (
                  id,
                  title,
                  type,
                  department,
                  scope,
                  status,
                  created_at,
                  creator_id
                )
              )
            `)
            .eq("status", "pending");

          // Filter approvals in JavaScript
          const filteredApprovals: PendingApprovalDocument[] = [];

          if (approvals) {
            for (const approval of approvals as any[]) {
              const workflow = approval.workflows;
              if (!workflow || !workflow.generated_steps) continue;

              const generatedSteps = workflow.generated_steps as any[];
              const matchingStep = generatedSteps.find(
                (step: any) => step.stepOrder === approval.step_order
              );

              if (matchingStep && matchingStep.requiredRole === role) {
                const document = workflow.documents;
                if (document) {
                  filteredApprovals.push({
                    approvalId: approval.id,
                    document: document as Document,
                    stepOrder: approval.step_order,
                  });
                }
              }
            }
          }

          setPendingApprovals(filteredApprovals);
        }

        setLoading(false);
      } catch (err) {
        console.error("Dashboard error:", err);
        setError("An unexpected error occurred.");
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
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

  // Calculate stats from My Documents
  const totalCount = myDocuments.length;
  const pendingCount = myDocuments.filter((d) => d.status === "pending").length;
  const approvedCount = myDocuments.filter((d) => d.status === "approved").length;
  const rejectedCount = myDocuments.filter((d) => d.status === "rejected").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">
          Loading your documents...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} />
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
      <Navbar userEmail={userEmail} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="page-heading">My Documents</h1>
            <p className="text-sm text-gray-500 font-poppins mt-1">
              Manage and track your submitted workflows
            </p>
          </div>
          <Link href="/upload" className="btn-primary mt-4 md:mt-0">
            Upload New Document
          </Link>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          {/* Total Documents */}
          <div className="card text-center">
            <p className="text-3xl font-bold text-college-secondary font-poppins">
              {totalCount}
            </p>
            <p className="text-xs text-gray-500 font-poppins mt-1">
              Total Documents
            </p>
          </div>

          {/* Pending */}
          <div className="card text-center">
            <p className="text-3xl font-bold text-college-secondary font-poppins">
              {pendingCount}
            </p>
            <p className="text-xs text-gray-500 font-poppins mt-1">Pending</p>
          </div>

          {/* Approved */}
          <div className="card text-center">
            <p className="text-3xl font-bold text-college-secondary font-poppins">
              {approvedCount}
            </p>
            <p className="text-xs text-gray-500 font-poppins mt-1">Approved</p>
          </div>

          {/* Rejected */}
          <div className="card text-center">
            <p className="text-3xl font-bold text-college-secondary font-poppins">
              {rejectedCount}
            </p>
            <p className="text-xs text-gray-500 font-poppins mt-1">Rejected</p>
          </div>
        </div>

        {/* Pending Your Approval Section (only for hod, coe, principal) */}
        {(userRole === "hod" ||
          userRole === "coe" ||
          userRole === "principal") && (
          <div className="mb-8">
            <h2 className="section-heading border-l-4 border-college-secondary pl-3">
              Pending Your Approval
            </h2>
            <div className="card">
              {pendingApprovals.length === 0 ? (
                <p className="text-sm text-gray-500 font-poppins text-center py-6">
                  No documents pending your approval
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr>
                        <th className="table-header">Title</th>
                        <th className="table-header">Type</th>
                        <th className="table-header">Department</th>
                        <th className="table-header">Submitted By</th>
                        <th className="table-header">Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pendingApprovals.map((item) => (
                        <tr key={item.approvalId} className="table-row">
                          <td className="px-4 py-3 text-sm font-medium text-college-text font-poppins">
                            {item.document.title}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                            {item.document.type}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                            {item.document.department}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-poppins font-mono">
                            {item.document.creator_id.substring(0, 8)}...
                          </td>
                          <td className="px-4 py-3">
                            <Link
                              href={`/documents/${item.document.id}`}
                              className="btn-primary text-xs"
                            >
                              Review & Sign
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* My Documents Table */}
        <div>
          <h2 className="section-heading">My Documents</h2>
          <div className="card">
            {myDocuments.length === 0 ? (
              // Empty State
              <div className="text-center py-12">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="h-16 w-16 text-gray-300 mx-auto mb-4"
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
                <p className="text-gray-500 font-poppins text-lg mb-2">
                  No documents yet
                </p>
                <p className="text-gray-400 font-poppins text-sm mb-6">
                  Start by uploading your first document
                </p>
                <Link href="/upload" className="btn-primary">
                  Upload Document
                </Link>
              </div>
            ) : (
              // Table
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Title</th>
                      <th className="table-header">Type</th>
                      <th className="table-header">Department</th>
                      <th className="table-header">Scope</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Date</th>
                      <th className="table-header">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {myDocuments.map((doc) => (
                      <tr key={doc.id} className="table-row">
                        <td className="px-4 py-3 text-sm font-medium text-college-text font-poppins">
                          {doc.title}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                          {doc.type}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                          {doc.department}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                          {doc.scope}
                        </td>
                        <td className="px-4 py-3">
                          <span className={getBadgeClass(doc.status)}>
                            {doc.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                          {formatDate(doc.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/documents/${doc.id}`}
                            className="btn-secondary text-xs"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
