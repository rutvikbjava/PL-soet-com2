"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string | null;
  status: string;
  approval_stage: string | null;
  created_by_email: string | null;
  employee_id: string | null;
  designation: string | null;
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
  user_email: string;
  user_name: string;
  action: string;
  stage: string | null;
  created_at: string;
}

export default function UsersPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [users, setUsers] = useState<User[]>([]);
  const [decisions, setDecisions] = useState<ApprovalLogEntry[]>([]);
  const [activeTab, setActiveTab] = useState<"pending" | "all" | "decisions">("pending");
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

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
        const { data: userData } = await (supabase.from("users") as any)
          .select("id, email, role, department")
          .eq("email", userEmail)
          .single();

        if (!userData) {
          router.push("/login");
          return;
        }

        const userRole = userData.role;

        // Students redirect to /assignments
        if (userRole === "student") {
          router.replace("/assignments");
          return;
        }

        setCurrentUser({
          id: userData.id,
          email: userData.email,
          role: userData.role,
          department: userData.department || null,
        });

        // Fetch users based on role
        await fetchUsers(supabase, userRole, userData.department, userEmail);
        await fetchDecisions(supabase, userEmail);
        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        router.push("/login");
      }
    };

    fetchData();
  }, [router]);

  const fetchUsers = async (supabase: any, role: string, department: string | null, email: string) => {
    let query = (supabase.from("users") as any).select(
      "id, email, full_name, role, department, status, approval_stage, created_by_email, employee_id, designation, created_at"
    );

    // Filter based on current user's role
    if (role === "hod") {
      // HoD sees only users in their department
      query = query.eq("department", department);
    } else if (role === "coe") {
      // CoE sees only faculty
      query = query.eq("role", "faculty");
    } else if (role === "faculty") {
      // Faculty sees only users they created
      query = query.eq("created_by_email", email);
    }
    // Principal and admin see everyone (no filter)

    query = query.order("created_at", { ascending: false });

    const { data } = await query;
    setUsers((data ?? []) as User[]);
  };

  const fetchDecisions = async (supabase: any, email: string) => {
    const { data } = await (supabase.from("user_approval_log") as any)
      .select("id, user_email, user_name, action, stage, created_at")
      .eq("actor_email", email)
      .in("action", ["approved", "rejected"])
      .order("created_at", { ascending: false })
      .limit(100);

    setDecisions((data ?? []) as ApprovalLogEntry[]);
  };

  const handleApproveHOD = async (user: User) => {
    if (!currentUser) return;
    setActionLoading(user.id);

    try {
      const supabase = createBrowserClient();

      // Get stage before change
      const stage = getApprovalStage(user);

      // Update approval_stage to 'principal' (status stays 'pending')
      await (supabase.from("users") as any)
        .update({ approval_stage: "principal" })
        .eq("id", user.id);

      // Insert approval log
      await (supabase.from("user_approval_log") as any).insert({
        user_email: user.email,
        user_name: user.full_name,
        action: "approved",
        stage: stage,
        actor_email: currentUser.email,
        actor_role: currentUser.role
      });

      // Notify all active principals
      const { data: principals } = await (supabase.from("users") as any)
        .select("email")
        .eq("role", "principal")
        .or("status.is.null,status.eq.active");

      if (principals && principals.length > 0) {
        const notifications = principals.map((principal: { email: string }) => ({
          user_email: principal.email,
          message: `Student ${user.full_name} approved by HOD, waiting for your approval`,
          link: "/users",
          is_read: false,
        }));

        await (supabase.from("assignment_notifications") as any).insert(notifications);
      }

      // Notify creator
      if (user.created_by_email) {
        await (supabase.from("assignment_notifications") as any).insert({
          user_email: user.created_by_email,
          message: `${user.full_name} was approved by the HOD`,
          link: "/users",
          is_read: false,
        });
      }

      // Reload users and decisions
      await fetchUsers(supabase, currentUser.role, currentUser.department, currentUser.email);
      await fetchDecisions(supabase, currentUser.email);
      setActionLoading(null);
    } catch (err) {
      console.error("Approve HOD error:", err);
      setActionLoading(null);
    }
  };

  const handleApprovePrincipal = async (user: User) => {
    if (!currentUser) return;
    setActionLoading(user.id);

    try {
      const supabase = createBrowserClient();

      // Get stage before change
      const stage = getApprovalStage(user);

      // Update status to 'active' and approval_stage to null
      await (supabase.from("users") as any)
        .update({ status: "active", approval_stage: null })
        .eq("id", user.id);

      // Insert approval log
      await (supabase.from("user_approval_log") as any).insert({
        user_email: user.email,
        user_name: user.full_name,
        action: "approved",
        stage: stage,
        actor_email: currentUser.email,
        actor_role: currentUser.role
      });

      // Notify creator
      if (user.created_by_email) {
        await (supabase.from("assignment_notifications") as any).insert({
          user_email: user.created_by_email,
          message: `Your new user ${user.full_name} was approved`,
          link: "/users",
          is_read: false,
        });
      }

      // Reload users and decisions
      await fetchUsers(supabase, currentUser.role, currentUser.department, currentUser.email);
      await fetchDecisions(supabase, currentUser.email);
      setActionLoading(null);
    } catch (err) {
      console.error("Approve Principal error:", err);
      setActionLoading(null);
    }
  };

  const handleReject = async (user: User) => {
    if (!currentUser) return;

    // Prompt for rejection reason
    const reason = window.prompt('Reason for rejection (required)');
    if (!reason || !reason.trim()) {
      return; // Cancel if empty
    }

    setActionLoading(user.id);

    try {
      const supabase = createBrowserClient();

      // Get stage before change
      const stage = getApprovalStage(user);

      // Update status to 'rejected' and approval_stage to null
      await (supabase.from("users") as any)
        .update({ status: "rejected", approval_stage: null })
        .eq("id", user.id);

      // Insert approval log with comment
      await (supabase.from("user_approval_log") as any).insert({
        user_email: user.email,
        user_name: user.full_name,
        action: "rejected",
        stage: stage,
        actor_email: currentUser.email,
        actor_role: currentUser.role,
        comment: reason.trim()
      });

      // Notify creator with reason
      if (user.created_by_email) {
        await (supabase.from("assignment_notifications") as any).insert({
          user_email: user.created_by_email,
          message: `Your new user ${user.full_name} was rejected. Reason: ${reason.trim()}`,
          link: "/users",
          is_read: false,
        });
      }

      // Reload users and decisions
      await fetchUsers(supabase, currentUser.role, currentUser.department, currentUser.email);
      await fetchDecisions(supabase, currentUser.email);
      setActionLoading(null);
    } catch (err) {
      console.error("Reject error:", err);
      setActionLoading(null);
    }
  };

  const handleSuspend = async (userId: string) => {
    if (!currentUser) return;
    setActionLoading(userId);

    try {
      const supabase = createBrowserClient();

      // Update user status to suspended
      await (supabase.from("users") as any)
        .update({ status: "suspended" })
        .eq("id", userId);

      // Reload users
      await fetchUsers(supabase, currentUser.role, currentUser.department, currentUser.email);
      setActionLoading(null);
    } catch (err) {
      console.error("Suspend error:", err);
      setActionLoading(null);
    }
  };

  const handleActivate = async (userId: string) => {
    if (!currentUser) return;
    setActionLoading(userId);

    try {
      const supabase = createBrowserClient();

      // Update user status to active
      await (supabase.from("users") as any)
        .update({ status: "active" })
        .eq("id", userId);

      // Reload users
      await fetchUsers(supabase, currentUser.role, currentUser.department, currentUser.email);
      setActionLoading(null);
    } catch (err) {
      console.error("Activate error:", err);
      setActionLoading(null);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
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

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getApprovalStage = (user: User): "hod" | "principal" => {
    // Null approval_stage is treated as 'principal'
    return (user.approval_stage as "hod" | "principal") || "principal";
  };

  const canApproveAtHOD = (user: User): boolean => {
    if (!currentUser) return false;
    const stage = getApprovalStage(user);
    if (stage !== "hod") return false;
    
    // HOD can approve if department matches, or admin can approve
    return (
      (currentUser.role === "hod" && currentUser.department === user.department) ||
      currentUser.role === "admin"
    );
  };

  const canApproveAtPrincipal = (user: User): boolean => {
    if (!currentUser) return false;
    const stage = getApprovalStage(user);
    if (stage !== "principal") return false;
    
    // Principal or admin can approve
    return currentUser.role === "principal" || currentUser.role === "admin";
  };

  const canReject = (user: User): boolean => {
    if (!currentUser) return false;
    const stage = getApprovalStage(user);
    
    if (stage === "hod") {
      return (
        (currentUser.role === "hod" && currentUser.department === user.department) ||
        currentUser.role === "admin"
      );
    } else {
      return currentUser.role === "principal" || currentUser.role === "admin";
    }
  };

  const pendingUsers = users.filter((u) => u.status === "pending");
  const canManageUsers = currentUser?.role === "principal" || currentUser?.role === "admin";
  const showCreateButton = currentUser && ["faculty", "hod", "coe", "principal", "admin"].includes(currentUser.role);

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

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header with Create User Button */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="page-heading">Users</h1>
            <p className="text-sm text-gray-500 font-poppins mt-1">
              Manage user accounts and permissions
            </p>
          </div>
          {showCreateButton && (
            <Link href="/users/new" className="btn-primary">
              + Create User
            </Link>
          )}
        </div>

        {/* Tabs */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <button
            onClick={() => setActiveTab("pending")}
            className={`px-4 py-2 rounded-lg font-poppins text-sm font-medium transition-colors ${
              activeTab === "pending"
                ? "bg-college-secondary text-white"
                : "bg-white text-college-text border border-college-peach hover:bg-college-peach"
            }`}
          >
            Pending Approval
          </button>
          <button
            onClick={() => setActiveTab("all")}
            className={`px-4 py-2 rounded-lg font-poppins text-sm font-medium transition-colors ${
              activeTab === "all"
                ? "bg-college-secondary text-white"
                : "bg-white text-college-text border border-college-peach hover:bg-college-peach"
            }`}
          >
            All Users
          </button>
          <button
            onClick={() => setActiveTab("decisions")}
            className={`px-4 py-2 rounded-lg font-poppins text-sm font-medium transition-colors ${
              activeTab === "decisions"
                ? "bg-college-secondary text-white"
                : "bg-white text-college-text border border-college-peach hover:bg-college-peach"
            }`}
          >
            My Decisions
          </button>
        </div>

        {/* Pending Approval Tab */}
        {activeTab === "pending" && (
          <div className="card">
            {pendingUsers.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 font-poppins text-center">
                No users found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Name</th>
                      <th className="table-header">Email</th>
                      <th className="table-header">Role</th>
                      <th className="table-header">Department</th>
                      <th className="table-header">Designation</th>
                      <th className="table-header">Waiting For</th>
                      <th className="table-header">Created By</th>
                      <th className="table-header">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingUsers.map((user) => {
                      const stage = getApprovalStage(user);
                      const canApproveHOD = canApproveAtHOD(user);
                      const canApprovePrincipal = canApproveAtPrincipal(user);
                      const canRejectUser = canReject(user);
                      const showButtons = canApproveHOD || canApprovePrincipal || canRejectUser;

                      return (
                        <tr key={user.id} className="table-row">
                          <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                            <Link href={`/users/${user.id}`} className="text-college-secondary hover:underline">
                              {user.full_name}
                            </Link>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                            {user.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 font-poppins capitalize">
                            {user.role}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                            {user.department ?? "—"}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                            {user.designation ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            <span className="badge-pending">
                              Waiting for: {stage === "hod" ? "HOD" : "Principal"}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                            {user.created_by_email ?? "—"}
                          </td>
                          <td className="px-4 py-3">
                            {showButtons ? (
                              <div className="flex gap-2">
                                {canApproveHOD && (
                                  <button
                                    onClick={() => handleApproveHOD(user)}
                                    disabled={actionLoading === user.id}
                                    className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-poppins font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === user.id ? "..." : "Approve"}
                                  </button>
                                )}
                                {canApprovePrincipal && (
                                  <button
                                    onClick={() => handleApprovePrincipal(user)}
                                    disabled={actionLoading === user.id}
                                    className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-poppins font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === user.id ? "..." : "Approve"}
                                  </button>
                                )}
                                {canRejectUser && (
                                  <button
                                    onClick={() => handleReject(user)}
                                    disabled={actionLoading === user.id}
                                    className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-poppins font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === user.id ? "..." : "Reject"}
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-xs text-gray-400 font-poppins">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* All Users Tab */}
        {activeTab === "all" && (
          <div className="card">
            {users.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 font-poppins text-center">
                No users found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Name</th>
                      <th className="table-header">Email</th>
                      <th className="table-header">Role</th>
                      <th className="table-header">Department</th>
                      <th className="table-header">Designation</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Created By</th>
                      {canManageUsers && <th className="table-header">Actions</th>}
                    </tr>
                  </thead>
                  <tbody>
                    {users.map((user) => (
                      <tr key={user.id} className="table-row">
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          <Link href={`/users/${user.id}`} className="text-college-secondary hover:underline">
                            {user.full_name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {user.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins capitalize">
                          {user.role}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {user.department ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {user.designation ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <span className={getStatusBadgeClass(user.status || "active")}>
                            {user.status || "active"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {user.created_by_email ?? "—"}
                        </td>
                        {canManageUsers && (
                          <td className="px-4 py-3">
                            {(user.status || "active") === "active" && user.id !== currentUser.id && (
                              <button
                                onClick={() => handleSuspend(user.id)}
                                disabled={actionLoading === user.id}
                                className="bg-orange-500 text-white px-3 py-1 rounded-lg text-xs font-poppins font-semibold hover:bg-orange-600 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === user.id ? "..." : "Suspend"}
                              </button>
                            )}
                            {(user.status === "suspended" || user.status === "rejected") && (
                              <button
                                onClick={() => handleActivate(user.id)}
                                disabled={actionLoading === user.id}
                                className="bg-green-500 text-white px-3 py-1 rounded-lg text-xs font-poppins font-semibold hover:bg-green-600 transition-colors disabled:opacity-50"
                              >
                                {actionLoading === user.id ? "..." : "Activate"}
                              </button>
                            )}
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* My Decisions Tab */}
        {activeTab === "decisions" && (
          <div className="card">
            {decisions.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 font-poppins text-center">
                No approval decisions found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">User</th>
                      <th className="table-header">Email</th>
                      <th className="table-header">Action</th>
                      <th className="table-header">Stage</th>
                      <th className="table-header">Date</th>
                      <th className="table-header">View</th>
                    </tr>
                  </thead>
                  <tbody>
                    {decisions.map((decision) => (
                      <tr key={decision.id} className="table-row">
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {decision.user_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {decision.user_email}
                        </td>
                        <td className="px-4 py-3">
                          <span className={decision.action === "approved" ? "badge-approved" : "bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold"}>
                            {decision.action}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins capitalize">
                          {decision.stage ?? "—"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {formatDate(decision.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Link 
                            href={`/users?email=${decision.user_email}`}
                            className="text-college-secondary hover:underline text-xs font-poppins font-semibold"
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
        )}
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
