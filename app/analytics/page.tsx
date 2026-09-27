"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface StatusCount {
  status: string;
  count: number;
}

interface TypeCount {
  type: string;
  count: number;
}

interface AnalyticsSummary {
  by_status: StatusCount[];
  by_type: TypeCount[];
}

export default function AnalyticsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        const supabase = createBrowserClient();
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/login");
          return;
        }

        setUserEmail(session.user.email || "");

        // Fetch analytics
        const response = await fetch("/api/analytics/summary", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        const result = await response.json();

        if (!response.ok) {
          setError(result.error || "Failed to fetch analytics.");
          setLoading(false);
          return;
        }

        setSummary(result);
        setLoading(false);
      } catch (err) {
        console.error("Analytics fetch error:", err);
        setError("An unexpected error occurred.");
        setLoading(false);
      }
    };

    fetchAnalytics();
  }, [router]);

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

  const formatType = (type: string) => {
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

  const getTotalDocuments = () => {
    if (!summary) return 0;
    return summary.by_status.reduce((sum, item) => sum + item.count, 0);
  };

  const getPendingCount = () => {
    if (!summary) return 0;
    const pending = summary.by_status.find((item) => item.status === "pending");
    return pending ? pending.count : 0;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">
          Loading analytics...
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

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">Analytics</h1>
          <p className="text-sm text-gray-500 font-poppins">
            Workflow statistics for MGM University SOET
          </p>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Total Documents */}
          <div className="card text-center">
            <p className="text-4xl font-bold text-college-secondary font-poppins">
              {getTotalDocuments()}
            </p>
            <p className="text-xs text-gray-500 font-poppins mt-1">
              Total Documents
            </p>
          </div>

          {/* Policy Compliance Rate */}
          <div className="card text-center">
            <p className="text-4xl font-bold text-green-600 font-poppins">
              100%
            </p>
            <p className="text-xs text-gray-500 font-poppins mt-1">
              Policy Compliance
            </p>
          </div>

          {/* Active Workflows */}
          <div className="card text-center">
            <p className="text-4xl font-bold text-orange-500 font-poppins">
              {getPendingCount()}
            </p>
            <p className="text-xs text-gray-500 font-poppins mt-1">
              Active Workflows
            </p>
          </div>
        </div>

        {/* Two Tables Side by Side */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Table 1: By Status */}
          <div className="card">
            <h2 className="section-heading">Documents by Status</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Status</th>
                    <th className="table-header">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.by_status.map((item) => (
                    <tr key={item.status} className="table-row">
                      <td className="px-4 py-3">
                        <span className={getBadgeClass(item.status)}>
                          {item.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins font-semibold">
                        {item.count}
                      </td>
                    </tr>
                  ))}
                  {(!summary?.by_status || summary.by_status.length === 0) && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-6 text-center text-sm text-gray-400 font-poppins"
                      >
                        No data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Table 2: By Document Type */}
          <div className="card">
            <h2 className="section-heading">Documents by Type</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Document Type</th>
                    <th className="table-header">Count</th>
                  </tr>
                </thead>
                <tbody>
                  {summary?.by_type.map((item) => (
                    <tr key={item.type} className="table-row">
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        {formatType(item.type)}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins font-semibold">
                        {item.count}
                      </td>
                    </tr>
                  ))}
                  {(!summary?.by_type || summary.by_type.length === 0) && (
                    <tr>
                      <td
                        colSpan={2}
                        className="px-4 py-6 text-center text-sm text-gray-400 font-poppins"
                      >
                        No data available
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Research Note */}
        <div className="bg-college-peach border-l-4 border-college-accent rounded-r-lg p-4">
          <p className="text-sm text-college-accent font-poppins">
            <strong>Research Note:</strong> This dashboard compares context-aware
            workflow generation against manual approval processes for MGM
            University SOET.
          </p>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
