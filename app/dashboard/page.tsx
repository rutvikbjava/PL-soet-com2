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
}

export default function DashboardPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [documents, setDocuments] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const supabase = createBrowserClient();

        // Get session
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        setUserEmail(session.user.email || "");

        // Fetch documents
        const { data: docs, error: docsError } = await supabase
          .from("documents")
          .select("*")
          .eq("creator_id", session.user.id)
          .order("created_at", { ascending: false });

        if (docsError) {
          console.error("Error fetching documents:", docsError);
        } else {
          setDocuments(docs || []);
        }

        setLoading(false);
      } catch (err) {
        console.error("Dashboard error:", err);
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

  // Calculate stats
  const totalCount = documents.length;
  const pendingCount = documents.filter((d) => d.status === "pending").length;
  const approvedCount = documents.filter((d) => d.status === "approved").length;
  const rejectedCount = documents.filter((d) => d.status === "rejected").length;

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">
          Loading your documents...
        </p>
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

        {/* Documents Table */}
        <div className="card">
          {documents.length === 0 ? (
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
                  {documents.map((doc) => (
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
      </main>

      {/* Footer */}
      <footer className="text-center text-xs text-gray-400 font-poppins py-6">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
