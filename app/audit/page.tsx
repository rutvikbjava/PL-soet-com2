"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface AuditEntry {
  id: string;
  documentId: string;
  documentTitle: string;
  action: string;
  actorId: string;
  actorEmail: string;
  comment: string | null;
  metadata: any;
  timestamp: string;
  kind: "by_me" | "on_my_document";
}

export default function AuditPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"by_me" | "on_my_document">("by_me");

  useEffect(() => {
    const fetchAuditData = async () => {
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

        setUserEmail(session.user.email || "");

        const response = await fetch("/api/audit/mine", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          throw new Error(result.error || "Failed to fetch audit trail");
        }

        setEntries(result.entries ?? []);
        setLoading(false);
      } catch (err: any) {
        console.error("Audit fetch error:", err);
        setError(err.message || "An unexpected error occurred.");
        setLoading(false);
      }
    };

    fetchAuditData();
  }, [router]);

  const formatAction = (action: string) => {
    switch (action) {
      case "document_created":
        return "Document Created";
      case "document_approved":
        return "Document Approved";
      case "document_rejected":
        return "Document Rejected";
      case "rejected":
        return "Rejected";
      case "step_approved":
        return "Step Approved";
      default:
        return action;
    }
  };

  const getActionBadgeClass = (action: string) => {
    switch (action) {
      case "document_created":
        return "bg-blue-100 text-blue-700 text-xs font-semibold px-3 py-1 rounded-full";
      case "document_approved":
        return "badge-approved";
      case "document_rejected":
      case "rejected":
        return "badge-rejected";
      case "step_approved":
        return "bg-purple-100 text-purple-700 text-xs font-semibold px-3 py-1 rounded-full";
      default:
        return "bg-gray-100 text-gray-700 text-xs font-semibold px-3 py-1 rounded-full";
    }
  };

  const formatTimestamp = (timestamp: string) => {
    const date = new Date(timestamp);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">
          Loading audit trail...
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

  const myActivityEntries = entries.filter((e) => e.kind === "by_me");
  const onMyDocumentEntries = entries.filter((e) => e.kind === "on_my_document");

  const displayedEntries = activeTab === "by_me" ? myActivityEntries : onMyDocumentEntries;

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">Audit Trail</h1>
          <p className="text-sm text-gray-500 font-poppins">
            Complete activity log for your documents and actions
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 border-b-2 border-college-peach">
          <button
            onClick={() => setActiveTab("by_me")}
            className={`px-6 py-3 font-poppins text-sm font-semibold transition-colors ${
              activeTab === "by_me"
                ? "text-college-secondary border-b-2 border-college-secondary -mb-0.5"
                : "text-gray-500 hover:text-college-accent"
            }`}
          >
            My Activity ({myActivityEntries.length})
          </button>
          <button
            onClick={() => setActiveTab("on_my_document")}
            className={`px-6 py-3 font-poppins text-sm font-semibold transition-colors ${
              activeTab === "on_my_document"
                ? "text-college-secondary border-b-2 border-college-secondary -mb-0.5"
                : "text-gray-500 hover:text-college-accent"
            }`}
          >
            On My Documents ({onMyDocumentEntries.length})
          </button>
        </div>

        {/* Audit Table */}
        <div className="card">
          {displayedEntries.length === 0 ? (
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
              <p className="text-sm text-gray-500 font-poppins">
                No audit records yet
              </p>
            </div>
          ) : (
            // Table
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Timestamp</th>
                    <th className="table-header">Action</th>
                    <th className="table-header">Document</th>
                    <th className="table-header">Actor</th>
                    <th className="table-header">Comment</th>
                  </tr>
                </thead>
                <tbody>
                  {displayedEntries.map((entry) => (
                    <tr key={entry.id} className="table-row">
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                        {formatTimestamp(entry.timestamp)}
                      </td>
                      <td className="px-4 py-3">
                        <span className={getActionBadgeClass(entry.action)}>
                          {formatAction(entry.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <Link
                          href={`/audit/${entry.documentId}`}
                          className="text-sm text-college-secondary font-poppins hover:underline"
                        >
                          {entry.documentTitle}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                        {entry.actorEmail}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-poppins italic">
                        {entry.comment || "—"}
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
