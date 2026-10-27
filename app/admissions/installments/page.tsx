"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface InstallmentRequest {
  id: string;
  form_id: string;
  student_email: string;
  total_amount: number;
  installment_count: number;
  first_payment: number;
  reason: string | null;
  status: string;
  approved_by_email: string | null;
  approved_at: string | null;
  created_at: string;
  student_name?: string;
  department?: string;
}

interface CurrentUser {
  email: string;
  role: string;
}

export default function InstallmentsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [requests, setRequests] = useState<InstallmentRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    try {
      setLoading(true);
      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const userEmail = session.user.email || "";

      // Fetch current user
      const { data: userData } = await (supabase.from("users") as any)
        .select("email, role")
        .eq("email", userEmail)
        .single();

      if (!userData) {
        router.push("/login");
        return;
      }

      // Only admin and accountant can access
      if (userData.role !== "admin" && userData.role !== "accountant") {
        router.replace("/admissions");
        return;
      }

      setCurrentUser({
        email: userData.email,
        role: userData.role,
      });

      // Fetch installment requests
      const { data: requestsData } = await (
        supabase.from("installment_requests") as any
      )
        .select("*")
        .order("created_at", { ascending: false });

      const installmentRequests = (requestsData ?? []) as InstallmentRequest[];

      // Fetch student names and departments for each request
      const enrichedRequests = await Promise.all(
        installmentRequests.map(async (request) => {
          const { data: formData } = await (
            supabase.from("admission_forms") as any
          )
            .select("student_name, department")
            .eq("id", request.form_id)
            .single();

          return {
            ...request,
            student_name: formData?.student_name || "Unknown",
            department: formData?.department || "N/A",
          };
        })
      );

      setRequests(enrichedRequests);
      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load installment requests.");
      setLoading(false);
    }
  };

  const handleApprove = async (requestId: string) => {
    if (!currentUser) return;

    setActionLoading(requestId);
    setError("");

    try {
      const supabase = createBrowserClient();

      const { error: updateError } = await (
        supabase.from("installment_requests") as any
      )
        .update({
          status: "approved",
          approved_by_email: currentUser.email,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) {
        console.error("Update error:", updateError);
        setError("Failed to approve installment request.");
        setActionLoading(null);
        return;
      }

      // Reload data
      await fetchData();
      setActionLoading(null);
    } catch (err) {
      console.error("Approve error:", err);
      setError("An unexpected error occurred.");
      setActionLoading(null);
    }
  };

  const handleReject = async (requestId: string) => {
    if (!currentUser) return;

    setActionLoading(requestId);
    setError("");

    try {
      const supabase = createBrowserClient();

      const { error: updateError } = await (
        supabase.from("installment_requests") as any
      )
        .update({
          status: "rejected",
          approved_by_email: currentUser.email,
          approved_at: new Date().toISOString(),
        })
        .eq("id", requestId);

      if (updateError) {
        console.error("Update error:", updateError);
        setError("Failed to reject installment request.");
        setActionLoading(null);
        return;
      }

      // Reload data
      await fetchData();
      setActionLoading(null);
    } catch (err) {
      console.error("Reject error:", err);
      setError("An unexpected error occurred.");
      setActionLoading(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "pending":
        return "bg-yellow-100 text-yellow-700 px-2 py-1 rounded-full text-xs font-semibold";
      case "approved":
        return "bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold";
      case "rejected":
        return "bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold";
      default:
        return "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading...</p>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  const isAdmin = currentUser.role === "admin";

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/admissions"
          className="text-college-secondary text-sm font-poppins mb-4 inline-block hover:underline"
        >
          ← Back to Admissions
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">Installment Requests</h1>
          <p className="text-sm text-gray-500 font-poppins mt-1">
            Review and approve student fee installment plans
          </p>
        </div>

        {/* Error Message */}
        {error && (
          <div className="text-red-500 text-sm text-center font-poppins bg-red-50 border border-red-200 rounded-lg p-3 mb-6">
            {error}
          </div>
        )}

        {/* Installment Requests Table */}
        {requests.length === 0 ? (
          <div className="card text-center py-12">
            <p className="text-gray-400 font-poppins text-lg">
              No installment requests found.
            </p>
            <p className="text-sm text-gray-500 font-poppins mt-2">
              Installment requests will appear here when students request payment plans.
            </p>
          </div>
        ) : (
          <div className="card overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-college-peach">
                  <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                    Student Name
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                    Department
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                    Total Amount
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                    First Payment
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                    No. of Installments
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                    Reason
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                    Status
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                    Requested Date
                  </th>
                  <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {requests.map((request) => (
                  <tr
                    key={request.id}
                    className="border-b border-college-peach hover:bg-college-bg transition-colors"
                  >
                    <td className="py-3 px-4 text-sm text-college-text font-poppins">
                      {request.student_name}
                    </td>
                    <td className="py-3 px-4 text-sm text-college-text font-poppins">
                      {request.department}
                    </td>
                    <td className="py-3 px-4 text-sm text-college-text font-poppins font-medium">
                      ₹{request.total_amount.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-college-text font-poppins font-medium">
                      ₹{request.first_payment.toLocaleString()}
                    </td>
                    <td className="py-3 px-4 text-sm text-college-text font-poppins text-center">
                      {request.installment_count}
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-600 font-poppins max-w-xs">
                      <div className="truncate" title={request.reason || "N/A"}>
                        {request.reason || "N/A"}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      <span className={getStatusBadgeClass(request.status)}>
                        {request.status.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 px-4 text-sm text-gray-500 font-poppins">
                      {formatDate(request.created_at)}
                    </td>
                    <td className="py-3 px-4">
                      {request.status === "pending" && isAdmin ? (
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleApprove(request.id)}
                            disabled={actionLoading === request.id}
                            className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 text-white px-3 py-1 rounded text-xs font-poppins font-semibold transition-colors"
                          >
                            {actionLoading === request.id ? "..." : "Approve"}
                          </button>
                          <button
                            onClick={() => handleReject(request.id)}
                            disabled={actionLoading === request.id}
                            className="bg-red-600 hover:bg-red-700 disabled:bg-gray-300 text-white px-3 py-1 rounded text-xs font-poppins font-semibold transition-colors"
                          >
                            {actionLoading === request.id ? "..." : "Reject"}
                          </button>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400 font-poppins">
                          {request.status === "pending" ? "Admin only" : "—"}
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary Card */}
        {requests.length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-6">
            <div className="card text-center">
              <p className="text-sm text-gray-600 font-poppins mb-2">Pending Requests</p>
              <p className="text-3xl font-bold text-yellow-600 font-poppins">
                {requests.filter((r) => r.status === "pending").length}
              </p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-gray-600 font-poppins mb-2">Approved Requests</p>
              <p className="text-3xl font-bold text-green-600 font-poppins">
                {requests.filter((r) => r.status === "approved").length}
              </p>
            </div>
            <div className="card text-center">
              <p className="text-sm text-gray-600 font-poppins mb-2">Rejected Requests</p>
              <p className="text-3xl font-bold text-red-600 font-poppins">
                {requests.filter((r) => r.status === "rejected").length}
              </p>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
