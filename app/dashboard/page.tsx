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

interface ActionHistoryItem {
  approvalId: string;
  documentId: string;
  documentTitle: string;
  action: string;
  comment: string | null;
  actedAt: string;
}

interface RejectedDocument {
  document: Document;
  rejectionComment: string | null;
}

export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [myDocuments, setMyDocuments] = useState<Document[]>([]);
  const [pendingApprovals, setPendingApprovals] = useState<PendingApprovalDocument[]>([]);
  const [actionHistory, setActionHistory] = useState<ActionHistoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [recentNotices, setRecentNotices] = useState<any[]>([]);

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
        const email = session.user.email || "";
        setUserEmail(email);

        // Fetch user role by email
        const { data: userData } = await (supabase.from("users") as any)
          .select("role")
          .eq("email", email)
          .single();

        const role = (userData as any)?.role || null;
        setUserRole(role);

        // Redirect students to /assignments
        if (role === "student") {
          router.replace("/assignments");
          return;
        }

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

        // Fetch Action History (approvals acted on by this user)
        const { data: actedApprovals } = await supabase
          .from("approvals")
          .select(`
            id,
            status,
            comment,
            acted_at,
            workflows (
              documents (
                id,
                title
              )
            )
          `)
          .eq("approver_id", userId)
          .in("status", ["approved", "rejected"])
          .order("acted_at", { ascending: false })
          .limit(20);

        const history: ActionHistoryItem[] = [];
        if (actedApprovals) {
          for (const approval of actedApprovals as any[]) {
            const workflow = approval.workflows;
            const document = workflow?.documents;
            if (document) {
              history.push({
                approvalId: approval.id,
                documentId: document.id,
                documentTitle: document.title,
                action: approval.status,
                comment: approval.comment ?? null,
                actedAt: approval.acted_at,
              });
            }
          }
        }
        setActionHistory(history);

        // Fetch Recent Notices
        const { data: notices } = await (supabase as any)
          .from('published_notices')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(3);

        setRecentNotices(notices || []);

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
        <Navbar userEmail={userEmail} userRole={userRole} />
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="card text-center">
            <p className="text-red-500 font-poppins">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  // Find rejected documents with comments
  const rejectedDocs: RejectedDocument[] = [];
  // We'll need to fetch approvals for rejected docs to get rejection comments
  // For now, we'll just mark them as rejected without comments in this view
  // To get rejection comments, we'd need to join with approvals table

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="page-heading">My Documents</h1>
            <p className="text-sm text-gray-500 font-poppins mt-1">
              Manage and track your submitted workflows
            </p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            <Link href="/upload" className="btn-primary">
              Upload New Document
            </Link>
            <Link href="/notices/create" className="btn-secondary">
              📢 Create Notice
            </Link>
          </div>
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

        {/* Recent Notices Section */}
        <div className="mb-8">
          <h2 className="section-heading">📢 Recent Notices</h2>
          {recentNotices.length === 0 ? (
            <div className="bg-college-peach rounded-lg px-4 py-3">
              <p className="text-sm text-gray-500 font-poppins">
                No published notices yet
              </p>
              <Link
                href="/notice-board"
                className="text-college-secondary text-xs font-poppins hover:underline"
              >
                View Notice Board →
              </Link>
            </div>
          ) : (
            <>
              <div className="flex gap-3 flex-wrap mb-3">
                {recentNotices.map((notice) => (
                  <div
                    key={notice.id}
                    onClick={() => router.push('/notice-board')}
                    className="bg-white border border-college-peach rounded-xl p-4 flex-1 min-w-48 max-w-xs cursor-pointer hover:shadow-md transition-shadow"
                  >
                    <span className="text-xs bg-college-peach text-college-accent px-2 py-0.5 rounded-full font-poppins">
                      {notice.category || 'General'}
                    </span>
                    <h3 className="text-sm font-semibold text-college-accent mt-2 font-poppins truncate max-w-full">
                      {notice.title}
                    </h3>
                    <p className="text-xs text-gray-400 font-poppins mt-1">
                      {formatDate(notice.published_at || notice.created_at)}
                    </p>
                  </div>
                ))}
              </div>
              <Link
                href="/notice-board"
                className="text-college-secondary text-sm font-poppins hover:underline"
              >
                View All Notices →
              </Link>
            </>
          )}
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

        {/* Your Action History Section */}
        <div className="mb-8">
          <h2 className="section-heading border-l-4 border-college-accent pl-3">
            Your Action History
          </h2>
          <div className="card">
            {actionHistory.length === 0 ? (
              <p className="text-sm text-gray-500 font-poppins text-center py-6">
                No action records yet
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Document</th>
                      <th className="table-header">Action</th>
                      <th className="table-header">Date</th>
                      <th className="table-header">Comment</th>
                      <th className="table-header">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {actionHistory.map((item) => (
                      <tr key={item.approvalId} className="table-row">
                        <td className="px-4 py-3 text-sm font-medium text-college-text font-poppins">
                          {item.documentTitle}
                        </td>
                        <td className="px-4 py-3">
                          <span className={getBadgeClass(item.action)}>
                            {item.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                          {formatDateTime(item.actedAt)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-poppins italic">
                          {item.comment || '—'}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/documents/${item.documentId}`}
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

        {/* My Uploaded Documents */}
        <div>
          <h2 className="section-heading">My Uploaded Documents</h2>
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
                        <td className="px-4 py-3">
                          <div className="text-sm font-medium text-college-text font-poppins">
                            {doc.title}
                          </div>
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
