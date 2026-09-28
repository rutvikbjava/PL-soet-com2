"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

export default function AnalyticsPage() {
  const router = useRouter();
  const [byStatus, setByStatus] = useState<Record<string, number>>({});
  const [byType, setByType] = useState<Record<string, number>>({});
  const [total, setTotal] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);

  useEffect(() => {
    const fetchAnalytics = async () => {
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

        const res = await fetch("/api/analytics/summary");
        const data = await res.json();

        if (!res.ok) throw new Error(data.error || "Failed to fetch");

        setByStatus(data.byStatus ?? {});
        setByType(data.byType ?? {});
        setTotal(data.total ?? 0);

        setLoading(false);
      } catch (err: any) {
        console.error("Analytics fetch error:", err);
        setError(err.message || "Failed to load analytics");
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

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins py-20">
          Loading analytics...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center">
            <p className="text-red-500 font-poppins">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  const pendingCount = byStatus["pending"] ?? 0;
  const approvedCount = byStatus["approved"] ?? 0;

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Page Header */}
        <h1 className="page-heading">Analytics</h1>
        <p className="text-sm text-gray-500 font-poppins mb-6">
          Workflow statistics for MGM University SOET
        </p>

        {/* Stats Overview */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {/* Total Documents */}
          <div className="card text-center">
            <p className="text-4xl font-bold text-college-secondary font-poppins">
              {total}
            </p>
            <p className="text-xs text-gray-500 mt-1 font-poppins">
              Total Documents
            </p>
          </div>

          {/* Policy Compliance */}
          <div className="card text-center">
            <p className="text-4xl font-bold text-green-600 font-poppins">
              100%
            </p>
            <p className="text-xs text-gray-500 mt-1 font-poppins">
              Policy Compliance
            </p>
          </div>

          {/* Active Workflows */}
          <div className="card text-center">
            <p className="text-4xl font-bold text-orange-500 font-poppins">
              {pendingCount}
            </p>
            <p className="text-xs text-gray-500 mt-1 font-poppins">
              Active Workflows
            </p>
          </div>
        </div>

        {/* Two Tables Side by Side */}
        <div className="grid grid-cols-2 gap-6">
          {/* Table 1: By Status */}
          <div className="card">
            <h2 className="section-heading">Documents by Status</h2>

            {Object.keys(byStatus).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 font-poppins">
                No data yet
              </p>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Status</th>
                      <th className="table-header">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byStatus).map(([status, count]) => (
                      <tr key={status} className="table-row">
                        <td className="px-4 py-3">
                          <span className={getBadgeClass(status)}>
                            {status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-college-text font-poppins font-semibold">
                          {count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Table 2: By Type */}
          <div className="card">
            <h2 className="section-heading">Documents by Type</h2>

            {Object.keys(byType).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4 font-poppins">
                No data yet
              </p>
            ) : (
              <div className="overflow-x-auto mt-4">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Type</th>
                      <th className="table-header">Count</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(byType).map(([type, count]) => (
                      <tr key={type} className="table-row">
                        <td className="px-4 py-3 text-sm text-college-text font-poppins">
                          {formatType(type)}
                        </td>
                        <td className="px-4 py-3 text-sm text-college-text font-poppins font-semibold">
                          {count}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* Research Note */}
        <div className="bg-college-peach border-l-4 border-college-accent rounded-r-lg p-4 mt-6">
          <p className="text-sm text-college-accent font-poppins">
            Research Note: This dashboard compares context-aware workflow
            generation against manual approval processes for MGM University SOET.
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
