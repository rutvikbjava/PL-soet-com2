"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface AuditLog {
  id: string;
  action: string;
  actor_id: string;
  created_at: string;
  metadata: any;
}

export default function AuditPage() {
  const params = useParams();
  const router = useRouter();
  const documentId = params.id as string;

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAuditData = async () => {
      try {
        const supabase = createBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

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

        // Fetch audit logs
        const response = await fetch(`/api/documents/${documentId}/audit`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || "Failed to fetch audit trail.");
          setLoading(false);
          return;
        }

        setAuditLogs(result.audit_logs || []);
        setLoading(false);
      } catch (err) {
        console.error("Audit fetch error:", err);
        setError("An unexpected error occurred.");
        setLoading(false);
      }
    };

    if (documentId) {
      fetchAuditData();
    }
  }, [documentId, router]);

  const formatAction = (action: string) => {
    switch (action) {
      case "document_created":
        return "Document Created";
      case "document_approved":
        return "Document Approved";
      case "document_rejected":
        return "Document Rejected";
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

  const formatMetadata = (metadata: any) => {
    if (!metadata || typeof metadata !== "object") {
      return "—";
    }

    return Object.entries(metadata)
      .map(([key, value]) => `${key}: ${value}`)
      .join(", ");
  };

  const truncateId = (id: string) => {
    return id.substring(0, 8) + "...";
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
        <Navbar userEmail={userEmail} userRole={userRole} />
        <div className="max-w-4xl mx-auto px-6 py-8">
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

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href={`/documents/${documentId}`}
          className="text-college-secondary text-sm font-poppins mb-4 inline-block hover:underline"
        >
          ← Back to Document
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">Audit Trail</h1>
          <p className="text-sm text-gray-500 font-poppins">
            Complete activity log for this document
          </p>
        </div>

        {/* Audit Table */}
        <div className="card">
          {auditLogs.length === 0 ? (
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
                No audit records found
              </p>
            </div>
          ) : (
            // Table
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Action</th>
                    <th className="table-header">Actor</th>
                    <th className="table-header">Timestamp</th>
                    <th className="table-header">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {auditLogs.map((log) => (
                    <tr key={log.id} className="table-row">
                      <td className="px-4 py-3">
                        <span className={getActionBadgeClass(log.action)}>
                          {formatAction(log.action)}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins font-mono">
                        {truncateId(log.actor_id)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                        {formatTimestamp(log.created_at)}
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-500 font-poppins">
                        {formatMetadata(log.metadata)}
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
