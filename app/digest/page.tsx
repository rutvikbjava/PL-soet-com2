"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Submission {
  id: string;
  assignment_id: string;
  status: string;
  grade: number | null;
  created_at: string;
  assignments?: {
    title: string;
  };
}

interface Assignment {
  id: string;
  title: string;
  deadline: string;
  creator_id?: string;
}

interface Approval {
  id: string;
  status: string;
  acted_at: string | null;
  workflow_id: string;
  workflows?: {
    document_id: string;
    generated_steps: any;
    documents?: {
      title: string;
    };
  };
}

interface Notification {
  id: string;
  message: string;
  document_id: string | null;
  created_at: string;
  read: boolean;
}

export default function DigestPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState<string>("");
  const [userId, setUserId] = useState<string>("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  // Data states
  const [recentSubmissions, setRecentSubmissions] = useState<Submission[]>([]);
  const [upcomingDeadlines, setUpcomingDeadlines] = useState<Assignment[]>([]);
  const [submissionsReceived, setSubmissionsReceived] = useState<Submission[]>([]);
  const [gradedCount, setGradedCount] = useState<number>(0);
  const [pendingApprovalsCount, setPendingApprovalsCount] = useState<number>(0);
  const [actedApprovals, setActedApprovals] = useState<Approval[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState<Notification[]>([]);

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const sevenDaysLater = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  useEffect(() => {
    const fetchData = async () => {
      const supabase = createBrowserClient();

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const email = session.user.email ?? "";
      setUserEmail(email);

      // Get user id and role
      const { data: userData } = await (supabase.from("users") as any)
        .select("id, role")
        .eq("email", email)
        .single();

      if (!userData) {
        router.push("/login");
        return;
      }

      const currentUserId = userData.id;
      const currentRole = userData.role;
      setUserId(currentUserId);
      setUserRole(currentRole);

      // Fetch unread notifications (all roles)
      const { data: notificationsData } = await (supabase.from("notifications") as any)
        .select("id, message, document_id, created_at, read")
        .eq("user_id", currentUserId)
        .eq("read", false)
        .gte("created_at", sevenDaysAgo);

      setUnreadNotifications(notificationsData ?? []);

      // Role-specific fetching
      if (currentRole === "student" || currentRole === "faculty") {
        // Recent submissions (last 7 days)
        const { data: submissionsData } = await (supabase.from("submissions") as any)
          .select("id, assignment_id, status, grade, created_at, assignments(title)")
          .eq("student_id", currentUserId)
          .gte("created_at", sevenDaysAgo);

        setRecentSubmissions(submissionsData ?? []);

        // Upcoming assignment deadlines (next 7 days)
        const { data: assignmentsData } = await (supabase.from("assignments") as any)
          .select("id, title, deadline")
          .gte("deadline", new Date().toISOString())
          .lte("deadline", sevenDaysLater);

        setUpcomingDeadlines(assignmentsData ?? []);
      }

      if (currentRole === "faculty") {
        // Submissions received on their assignments (last 7 days)
        const { data: allSubmissions } = await (supabase.from("submissions") as any)
          .select("id, student_id, created_at, assignment_id, status, assignments(title, creator_id)")
          .gte("created_at", sevenDaysAgo);

        const filtered = (allSubmissions ?? []).filter(
          (sub: any) => sub.assignments?.creator_id === currentUserId
        );

        setSubmissionsReceived(filtered);

        // Count graded vs total
        const graded = filtered.filter((sub: any) => sub.status === "graded").length;
        setGradedCount(graded);
      }

      if (["hod", "coe", "principal"].includes(currentRole)) {
        // Fetch all workflows with pending approvals
        const { data: workflowsData } = await (supabase.from("workflows") as any)
          .select("id, document_id, generated_steps, approvals(id, status, approver_id, step_order)");

        let pendingCount = 0;

        for (const workflow of workflowsData ?? []) {
          const steps = workflow.generated_steps || [];
          const approvals = workflow.approvals || [];

          for (const approval of approvals) {
            if (approval.status === "pending") {
              const stepIndex = approval.step_order;
              if (stepIndex >= 0 && stepIndex < steps.length) {
                const step = steps[stepIndex];
                if (step.role === currentRole) {
                  pendingCount++;
                }
              }
            }
          }
        }

        setPendingApprovalsCount(pendingCount);

        // Approvals acted on in last 7 days
        const { data: actedApprovalsData } = await (supabase.from("approvals") as any)
          .select("id, status, acted_at, workflow_id, workflows(document_id, generated_steps, documents(title))")
          .not("acted_at", "is", null)
          .gte("acted_at", sevenDaysAgo);

        const actedFiltered: Approval[] = [];

        for (const approval of actedApprovalsData ?? []) {
          const workflow = approval.workflows;
          if (workflow && workflow.generated_steps) {
            const steps = workflow.generated_steps;
            // Find this approval's step
            const { data: fullApproval } = await (supabase.from("approvals") as any)
              .select("step_order")
              .eq("id", approval.id)
              .single();

            if (fullApproval) {
              const stepIndex = fullApproval.step_order;
              if (stepIndex >= 0 && stepIndex < steps.length) {
                const step = steps[stepIndex];
                if (step.role === currentRole) {
                  actedFiltered.push(approval);
                }
              }
            }
          }
        }

        setActedApprovals(actedFiltered);
      }

      setLoading(false);
    };

    fetchData();
  }, [router, sevenDaysAgo, sevenDaysLater]);

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDateOnly = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="text-center text-gray-400">Loading...</div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="page-heading">This Week</h1>
        <p className="text-sm text-gray-500 font-poppins mb-6">
          {formatDateOnly(sevenDaysAgo)} → Today
        </p>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          {(userRole === "student" || userRole === "faculty") && (
            <>
              <div className="card text-center">
                <p className="text-4xl font-bold text-college-secondary font-poppins">
                  {recentSubmissions.length}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-poppins">
                  Submissions Made
                </p>
              </div>
              <div className="card text-center">
                <p className="text-4xl font-bold text-orange-500 font-poppins">
                  {upcomingDeadlines.length}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-poppins">
                  Upcoming Deadlines
                </p>
              </div>
              <div className="card text-center">
                <p className="text-4xl font-bold text-green-600 font-poppins">
                  {unreadNotifications.length}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-poppins">
                  Unread Notifications
                </p>
              </div>
            </>
          )}

          {userRole === "faculty" && submissionsReceived.length > 0 && (
            <>
              <div className="card text-center">
                <p className="text-4xl font-bold text-purple-600 font-poppins">
                  {submissionsReceived.length}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-poppins">
                  Submissions Received
                </p>
              </div>
              <div className="card text-center">
                <p className="text-4xl font-bold text-green-600 font-poppins">
                  {gradedCount}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-poppins">
                  Graded
                </p>
              </div>
              <div className="card text-center">
                <p className="text-4xl font-bold text-college-accent font-poppins">
                  {unreadNotifications.length}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-poppins">
                  Notifications
                </p>
              </div>
            </>
          )}

          {["hod", "coe", "principal"].includes(userRole ?? "") && (
            <>
              <div className="card text-center">
                <p className="text-4xl font-bold text-orange-500 font-poppins">
                  {pendingApprovalsCount}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-poppins">
                  Pending Approvals
                </p>
              </div>
              <div className="card text-center">
                <p className="text-4xl font-bold text-green-600 font-poppins">
                  {actedApprovals.length}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-poppins">
                  Acted This Week
                </p>
              </div>
              <div className="card text-center">
                <p className="text-4xl font-bold text-college-accent font-poppins">
                  {unreadNotifications.length}
                </p>
                <p className="text-xs text-gray-500 mt-1 font-poppins">
                  Notifications
                </p>
              </div>
            </>
          )}
        </div>

        {/* Recent Submissions (Student/Faculty) */}
        {(userRole === "student" || userRole === "faculty") && (
          <div className="mb-6">
            <h2 className="section-heading">Recent Submissions</h2>
            {recentSubmissions.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">Nothing this week.</div>
            ) : (
              <div className="space-y-3">
                {recentSubmissions.map((submission) => (
                  <div key={submission.id} className="card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-college-text font-poppins">
                          {submission.assignments?.title ?? "Unknown Assignment"}
                        </p>
                        <p className="text-xs text-gray-500 font-poppins">
                          {formatDate(submission.created_at)} • {submission.status}
                          {submission.grade !== null && ` • ${submission.grade} marks`}
                        </p>
                      </div>
                      <Link
                        href={`/assignments/${submission.assignment_id}`}
                        className="btn-secondary text-xs"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Upcoming Deadlines (Student/Faculty) */}
        {(userRole === "student" || userRole === "faculty") && (
          <div className="mb-6">
            <h2 className="section-heading">Upcoming Deadlines</h2>
            {upcomingDeadlines.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">Nothing this week.</div>
            ) : (
              <div className="space-y-3">
                {upcomingDeadlines.map((assignment) => (
                  <div key={assignment.id} className="card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-college-text font-poppins">
                          {assignment.title}
                        </p>
                        <p className="text-xs text-gray-500 font-poppins">
                          Due: {formatDate(assignment.deadline)}
                        </p>
                      </div>
                      <Link
                        href={`/assignments/${assignment.id}`}
                        className="btn-secondary text-xs"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Submissions Received (Faculty only) */}
        {userRole === "faculty" && (
          <div className="mb-6">
            <h2 className="section-heading">Submissions Received</h2>
            {submissionsReceived.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">Nothing this week.</div>
            ) : (
              <div className="space-y-3">
                {submissionsReceived.slice(0, 10).map((submission) => (
                  <div key={submission.id} className="card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-college-text font-poppins">
                          {submission.assignments?.title ?? "Unknown Assignment"}
                        </p>
                        <p className="text-xs text-gray-500 font-poppins">
                          {formatDate(submission.created_at)} • {submission.status}
                        </p>
                      </div>
                      <Link
                        href={`/assignments/${submission.assignment_id}`}
                        className="btn-secondary text-xs"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Acted Approvals (Approver roles) */}
        {["hod", "coe", "principal"].includes(userRole ?? "") && (
          <div className="mb-6">
            <h2 className="section-heading">Approvals Acted On</h2>
            {actedApprovals.length === 0 ? (
              <div className="text-sm text-gray-400 py-2">Nothing this week.</div>
            ) : (
              <div className="space-y-3">
                {actedApprovals.map((approval) => (
                  <div key={approval.id} className="card">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-sm font-semibold text-college-text font-poppins">
                          {approval.workflows?.documents?.title ?? "Unknown Document"}
                        </p>
                        <p className="text-xs text-gray-500 font-poppins">
                          {approval.acted_at && formatDate(approval.acted_at)} • {approval.status}
                        </p>
                      </div>
                      <Link
                        href={`/documents/${approval.workflows?.document_id ?? ""}`}
                        className="btn-secondary text-xs"
                      >
                        View
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Unread Notifications (All roles) */}
        <div className="mb-6">
          <h2 className="section-heading">Unread Notifications</h2>
          {unreadNotifications.length === 0 ? (
            <div className="text-sm text-gray-400 py-2">Nothing this week.</div>
          ) : (
            <div className="space-y-3">
              {unreadNotifications.map((notification) => (
                <div key={notification.id} className="card">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-college-text font-poppins">
                        {notification.message}
                      </p>
                      <p className="text-xs text-gray-500 font-poppins">
                        {formatDate(notification.created_at)}
                      </p>
                    </div>
                    {notification.document_id && (
                      <Link
                        href={`/documents/${notification.document_id}`}
                        className="btn-secondary text-xs"
                      >
                        View
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
