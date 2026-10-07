"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface DeadlineItem {
  title: string;
  date: string;
  type: "assignment" | "approval";
  link: string;
}

export default function DeadlinesPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [items, setItems] = useState<DeadlineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
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

        const currentUserId = session.user.id;
        const currentUserEmail = session.user.email || "";

        setUserId(currentUserId);
        setUserEmail(currentUserEmail);

        // Fetch user role
        const { data: userData } = await (supabase.from("users") as any)
          .select("role")
          .eq("id", currentUserId)
          .single();

        const role = userData?.role || null;
        setUserRole(role);

        const combinedItems: DeadlineItem[] = [];

        // Fetch upcoming assignments
        const now = new Date().toISOString();
        const { data: assignmentsData } = await (supabase.from(
          "assignments" as any
        ) as any)
          .select("id, title, deadline")
          .gte("deadline", now)
          .order("deadline", { ascending: true })
          .limit(20);

        const assignments = assignmentsData ?? [];

        assignments.forEach((assignment: any) => {
          combinedItems.push({
            title: assignment.title,
            date: assignment.deadline,
            type: "assignment",
            link: `/assignments/${assignment.id}`,
          });
        });

        // Fetch pending approvals for approver roles
        if (
          role === "hod" ||
          role === "coe" ||
          role === "principal" ||
          role === "faculty"
        ) {
          const { data: approvalsData } = await (supabase.from(
            "approvals"
          ) as any)
            .select(
              `id, step_order, status, created_at, workflow_id,
               workflows!inner(id, document_id, generated_steps,
               documents!inner(id, title))`
            )
            .eq("status", "pending");

          const approvals = approvalsData ?? [];

          // Filter by role match
          const matchingApprovals = approvals.filter((approval: any) => {
            const steps = approval.workflows?.generated_steps ?? [];
            const step = steps.find(
              (s: any) =>
                (s.stepOrder ?? s.step_order) === approval.step_order
            );
            return step?.requiredRole?.toLowerCase() === role?.toLowerCase();
          });

          matchingApprovals.forEach((approval: any) => {
            combinedItems.push({
              title: approval.workflows?.documents?.title || "Untitled Document",
              date: approval.created_at,
              type: "approval",
              link: `/documents/${approval.workflows?.document_id}`,
            });
          });
        }

        // Sort by date ascending
        combinedItems.sort(
          (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
        );

        setItems(combinedItems);
        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching deadlines:", err);
        setError(err.message || "An unexpected error occurred.");
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

  const getDateOnly = (dateString: string) => {
    const date = new Date(dateString);
    return new Date(date.getFullYear(), date.getMonth(), date.getDate());
  };

  const groupItems = () => {
    const today = getDateOnly(new Date().toISOString());
    const sevenDaysLater = new Date(today);
    sevenDaysLater.setDate(sevenDaysLater.getDate() + 7);

    const overdue: DeadlineItem[] = [];
    const thisWeek: DeadlineItem[] = [];
    const later: DeadlineItem[] = [];

    items.forEach((item) => {
      const itemDate = getDateOnly(item.date);

      if (itemDate < today) {
        overdue.push(item);
      } else if (itemDate >= today && itemDate <= sevenDaysLater) {
        thisWeek.push(item);
      } else {
        later.push(item);
      }
    });

    return { overdue, thisWeek, later };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading...</p>
      </div>
    );
  }

  const { overdue, thisWeek, later } = groupItems();

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        <h1 className="page-heading">Deadlines & Approvals</h1>
        <p className="text-sm text-gray-500 font-poppins mb-6">
          Your upcoming tasks and pending items
        </p>

        {error && (
          <div className="card bg-red-50 border-red-200 mb-6">
            <p className="text-red-600 text-sm font-poppins">{error}</p>
          </div>
        )}

        {/* Overdue Section */}
        <div className="mb-8">
          <h2 className="section-heading text-red-600">Overdue</h2>
          {overdue.length === 0 ? (
            <p className="text-sm text-gray-400 py-2 font-poppins">
              Nothing here.
            </p>
          ) : (
            <div className="space-y-2">
              {overdue.map((item, index) => (
                <div
                  key={index}
                  className="card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          item.type === "assignment"
                            ? "bg-blue-400"
                            : "bg-college-secondary"
                        }`}
                      ></div>
                      <span className="font-poppins text-sm text-college-text">
                        {item.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 font-poppins">
                        {formatDate(item.date)}
                      </span>
                      <Link href={item.link} className="btn-secondary text-xs">
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* This Week Section */}
        <div className="mb-8">
          <h2 className="section-heading text-college-secondary">This Week</h2>
          {thisWeek.length === 0 ? (
            <p className="text-sm text-gray-400 py-2 font-poppins">
              Nothing here.
            </p>
          ) : (
            <div className="space-y-2">
              {thisWeek.map((item, index) => (
                <div
                  key={index}
                  className="card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          item.type === "assignment"
                            ? "bg-blue-400"
                            : "bg-college-secondary"
                        }`}
                      ></div>
                      <span className="font-poppins text-sm text-college-text">
                        {item.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 font-poppins">
                        {formatDate(item.date)}
                      </span>
                      <Link href={item.link} className="btn-secondary text-xs">
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Later Section */}
        <div className="mb-8">
          <h2 className="section-heading text-college-accent">Later</h2>
          {later.length === 0 ? (
            <p className="text-sm text-gray-400 py-2 font-poppins">
              Nothing here.
            </p>
          ) : (
            <div className="space-y-2">
              {later.map((item, index) => (
                <div
                  key={index}
                  className="card hover:shadow-md transition-shadow"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-3 h-3 rounded-full ${
                          item.type === "assignment"
                            ? "bg-blue-400"
                            : "bg-college-secondary"
                        }`}
                      ></div>
                      <span className="font-poppins text-sm text-college-text">
                        {item.title}
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-gray-500 font-poppins">
                        {formatDate(item.date)}
                      </span>
                      <Link href={item.link} className="btn-secondary text-xs">
                        View
                      </Link>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
