"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string | null;
  section: string | null;
  status: string | null;
  employee_id: string | null;
  designation: string | null;
  phone: string | null;
  gender: string | null;
  date_of_birth: string | null;
  date_of_joining: string | null;
  qualification: string | null;
  specialization: string | null;
  experience_years: number | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  photo_url: string | null;
  created_by_email: string | null;
  created_at: string;
}

interface CurrentUser {
  id: string;
  email: string;
  role: string;
  department: string | null;
}

interface ApprovalLogEntry {
  id: string;
  action: string;
  stage: string | null;
  actor_email: string;
  actor_role: string;
  comment: string | null;
  created_at: string;
}

export default function UserProfilePage() {
  const router = useRouter();
  const params = useParams();
  const userId = params?.id as string;

  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [approvalLog, setApprovalLog] = useState<ApprovalLogEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [accessDenied, setAccessDenied] = useState(false);

  useEffect(() => {
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

        // Fetch current user's data
        const { data: currentUserData } = await (supabase.from("users") as any)
          .select("id, email, role, department")
          .eq("email", userEmail)
          .single();

        if (!currentUserData) {
          router.push("/login");
          return;
        }

        setCurrentUser({
          id: currentUserData.id,
          email: currentUserData.email,
          role: currentUserData.role,
          department: currentUserData.department || null,
        });

        // Fetch target user's data
        const { data: userData } = await (supabase.from("users") as any)
          .select("*")
          .eq("id", userId)
          .single();

        if (!userData) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        // Check access permissions
        const canAccess = await checkAccess(
          supabase,
          currentUserData,
          userData,
          userEmail
        );

        if (!canAccess) {
          setAccessDenied(true);
          setLoading(false);
          return;
        }

        setUser(userData);

        // Fetch approval log for this user
        const { data: logData } = await (supabase.from("user_approval_log") as any)
          .select("id, action, stage, actor_email, actor_role, comment, created_at")
          .eq("user_email", userData.email)
          .order("created_at", { ascending: false });

        setApprovalLog((logData ?? []) as ApprovalLogEntry[]);
        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        setAccessDenied(true);
        setLoading(false);
      }
    };

    if (userId) {
      fetchData();
    }
  }, [router, userId]);

  const checkAccess = async (
    supabase: any,
    currentUserData: any,
    targetUser: any,
    currentEmail: string
  ): Promise<boolean> => {
    // Principal and admin can see all
    if (["principal", "admin"].includes(currentUserData.role)) {
      return true;
    }

    // Own profile
    if (targetUser.email === currentEmail) {
      return true;
    }

    // HOD can see own department
    if (
      currentUserData.role === "hod" &&
      currentUserData.department === targetUser.department
    ) {
      return true;
    }

    // CoE can see faculty
    if (currentUserData.role === "coe" && targetUser.role === "faculty") {
      return true;
    }

    // Created by current user
    if (targetUser.created_by_email === currentEmail) {
      return true;
    }

    // Has approval log entry (keeps visible after approving)
    const { data: logEntry } = await (supabase.from("user_approval_log") as any)
      .select("id")
      .eq("user_email", targetUser.email)
      .eq("actor_email", currentEmail)
      .limit(1)
      .single();

    if (logEntry) {
      return true;
    }

    return false;
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusBadgeClass = (status: string | null) => {
    const s = status || "active";
    switch (s) {
      case "active":
        return "badge-approved";
      case "pending":
        return "badge-pending";
      case "rejected":
      case "suspended":
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

  if (accessDenied || !user) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={currentUser?.email || ""} userRole={currentUser?.role || ""} />
        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="card text-center py-12">
            <p className="text-red-600 font-poppins font-semibold mb-4">Access Denied</p>
            <p className="text-gray-500 font-poppins mb-6">
              You do not have permission to view this profile.
            </p>
            <Link href="/users" className="btn-primary inline-block">
              Back to Users
            </Link>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={currentUser?.email || ""} userRole={currentUser?.role || ""} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Back Button */}
        <Link href="/users" className="text-college-secondary hover:underline font-poppins text-sm mb-4 inline-block">
          ← Back to Users
        </Link>

        {/* Page Header */}
        <div className="flex items-start gap-6 mb-8">
          {/* Profile Photo */}
          <div className="w-32 h-32 rounded-full overflow-hidden bg-gray-200 flex-shrink-0">
            {user.photo_url ? (
              <img src={user.photo_url} alt={user.full_name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-gray-400">
                {user.full_name.charAt(0).toUpperCase()}
              </div>
            )}
          </div>

          {/* Header Info */}
          <div className="flex-1">
            <h1 className="page-heading mb-2">{user.full_name}</h1>
            <p className="text-gray-600 font-poppins mb-2">{user.email}</p>
            <div className="flex gap-3 items-center">
              <span className="badge-approved capitalize">{user.role}</span>
              <span className={getStatusBadgeClass(user.status)}>
                {user.status || "active"}
              </span>
            </div>
          </div>
        </div>

        {/* Account Information Card */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-college-secondary mb-4 font-poppins">
            Account Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 font-poppins">Email</p>
              <p className="text-gray-800 font-poppins">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Role</p>
              <p className="text-gray-800 font-poppins capitalize">{user.role}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Employee ID</p>
              <p className="text-gray-800 font-poppins">{user.employee_id ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Status</p>
              <p className="text-gray-800 font-poppins capitalize">{user.status || "active"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Created By</p>
              <p className="text-gray-800 font-poppins">{user.created_by_email ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Created At</p>
              <p className="text-gray-800 font-poppins">{formatDate(user.created_at)}</p>
            </div>
          </div>
        </div>

        {/* Personal Information Card */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-college-secondary mb-4 font-poppins">
            Personal Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 font-poppins">Full Name</p>
              <p className="text-gray-800 font-poppins">{user.full_name}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Gender</p>
              <p className="text-gray-800 font-poppins capitalize">{user.gender ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Date of Birth</p>
              <p className="text-gray-800 font-poppins">{formatDate(user.date_of_birth)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Phone</p>
              <p className="text-gray-800 font-poppins">{user.phone ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Professional Information Card */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-college-secondary mb-4 font-poppins">
            Professional Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-gray-500 font-poppins">Department</p>
              <p className="text-gray-800 font-poppins">{user.department ?? "—"}</p>
            </div>
            {user.role === "student" && (
              <div>
                <p className="text-sm text-gray-500 font-poppins">Section</p>
                <p className="text-gray-800 font-poppins">{user.section ?? "—"}</p>
              </div>
            )}
            <div>
              <p className="text-sm text-gray-500 font-poppins">Designation</p>
              <p className="text-gray-800 font-poppins">{user.designation ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Date of Joining</p>
              <p className="text-gray-800 font-poppins">{formatDate(user.date_of_joining)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Qualification</p>
              <p className="text-gray-800 font-poppins">{user.qualification ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Specialization</p>
              <p className="text-gray-800 font-poppins">{user.specialization ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Experience (Years)</p>
              <p className="text-gray-800 font-poppins">
                {user.experience_years !== null ? user.experience_years : "—"}
              </p>
            </div>
          </div>
        </div>

        {/* Address Information Card */}
        <div className="card mb-6">
          <h2 className="text-lg font-semibold text-college-secondary mb-4 font-poppins">
            Address Information
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="md:col-span-2">
              <p className="text-sm text-gray-500 font-poppins">Address</p>
              <p className="text-gray-800 font-poppins">{user.address ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">City</p>
              <p className="text-gray-800 font-poppins">{user.city ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">State</p>
              <p className="text-gray-800 font-poppins">{user.state ?? "—"}</p>
            </div>
            <div>
              <p className="text-sm text-gray-500 font-poppins">Pincode</p>
              <p className="text-gray-800 font-poppins">{user.pincode ?? "—"}</p>
            </div>
          </div>
        </div>

        {/* Approval History Card */}
        <div className="card">
          <h2 className="text-lg font-semibold text-college-secondary mb-4 font-poppins">
            Approval History
          </h2>
          {approvalLog.length === 0 ? (
            <p className="text-sm text-gray-400 py-4 font-poppins">
              No approval history found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Action</th>
                    <th className="table-header">Stage</th>
                    <th className="table-header">Actor</th>
                    <th className="table-header">Role</th>
                    <th className="table-header">Comment</th>
                    <th className="table-header">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {approvalLog.map((entry) => (
                    <tr key={entry.id} className="table-row">
                      <td className="px-4 py-3">
                        <span
                          className={
                            entry.action === "approved"
                              ? "badge-approved"
                              : entry.action === "rejected"
                              ? "bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold"
                              : "badge-draft"
                          }
                        >
                          {entry.action}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins capitalize">
                        {entry.stage ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        {entry.actor_email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins capitalize">
                        {entry.actor_role}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        {entry.comment ?? "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        {formatDate(entry.created_at)}
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
