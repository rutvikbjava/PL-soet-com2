"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { PROJECT_CATEGORIES } from "@/lib/project-categories";

interface Assignment {
  id: string;
  title: string;
  description: string;
  section: string;
  deadline: string;
  max_marks: number;
  created_by_email: string;
  created_at: string;
  type?: string;
  language_name?: string | null;
  project_category?: string | null;
}

interface AssignmentWithSubmission extends Assignment {
  submissionCount?: number;
  latestSubmission?: {
    id: string;
    status: string;
    marks: number | null;
    submitted_at: string;
    tests_passed?: number | null;
    tests_total?: number | null;
  } | null;
}

export default function AssignmentsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userSection, setUserSection] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithSubmission[]>([]);
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

        const email = session.user.email || "";
        setUserEmail(email);

        // Fetch user profile
        const { data: userData } = await supabase
          .from("users")
          .select("role, section")
          .eq("email", email)
          .single();

        const role = (userData as any)?.role || null;
        const section = (userData as any)?.section || null;
        setUserRole(role);
        setUserSection(section);

        if (role === "faculty") {
          // Faculty: fetch assignments they created
          const { data: assignmentsData } = await supabase
            .from("assignments")
            .select("*")
            .eq("created_by_email", email)
            .order("created_at", { ascending: false });

          const assignmentsList = (assignmentsData ?? []) as Assignment[];

          // Fetch submission counts
          const assignmentsWithCounts: AssignmentWithSubmission[] = [];
          for (const assignment of assignmentsList) {
            const { data: submissionsData } = await supabase
              .from("submissions")
              .select("id")
              .eq("assignment_id", assignment.id);

            assignmentsWithCounts.push({
              ...assignment,
              submissionCount: (submissionsData ?? []).length,
            });
          }

          setAssignments(assignmentsWithCounts);
        } else if (role === "student") {
          // Student: fetch assignments for their section
          const { data: assignmentsData } = await supabase
            .from("assignments")
            .select("*")
            .eq("section", section)
            .order("created_at", { ascending: false });

          const assignmentsList = (assignmentsData ?? []) as Assignment[];

          // Fetch latest submission for each assignment
          const assignmentsWithSubmissions: AssignmentWithSubmission[] = [];
          for (const assignment of assignmentsList) {
            const { data: submissionData } = await supabase
              .from("submissions")
              .select("id, status, marks, submitted_at, tests_passed, tests_total")
              .eq("assignment_id", assignment.id)
              .eq("student_email", email)
              .order("submitted_at", { ascending: false })
              .limit(1)
              .single();

            assignmentsWithSubmissions.push({
              ...assignment,
              latestSubmission: submissionData as any,
            });
          }

          setAssignments(assignmentsWithSubmissions);
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Assignments fetch error:", err);
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
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getSubmissionStatus = (assignment: AssignmentWithSubmission) => {
    const submission = assignment.latestSubmission;
    const deadline = new Date(assignment.deadline);
    const now = new Date();

    if (!submission) {
      if (now > deadline) {
        return { text: "Overdue", class: "bg-red-100 text-red-700" };
      }
      return { text: "Not Submitted", class: "bg-red-100 text-red-700" };
    }

    if (submission.status === "graded") {
      return {
        text: `Graded (${submission.marks ?? 0}/${assignment.max_marks})`,
        class: "bg-green-100 text-green-700",
      };
    }

    if (submission.status === "returned") {
      return { text: "Returned", class: "bg-orange-100 text-orange-700" };
    }

    return { text: "Submitted", class: "bg-blue-100 text-blue-700" };
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">
          Loading assignments...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="card text-center">
            <p className="text-red-500 font-poppins">{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-8">
          <div>
            <h1 className="page-heading">Assignments</h1>
            <p className="text-sm text-gray-500 font-poppins mt-1">
              {userRole === "faculty"
                ? "Manage and track your assignments"
                : `Assignments for Section ${userSection}`}
            </p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
            {userRole === "faculty" && (
              <>
                <Link href="/assignments/analytics" className="btn-secondary">
                  Assignment Analytics
                </Link>
                <Link href="/assignments/new" className="btn-primary">
                  + New Assignment
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Assignments Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {assignments.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <p className="text-gray-500 font-poppins">
                {userRole === "faculty"
                  ? "No assignments created yet"
                  : "No assignments available"}
              </p>
            </div>
          ) : (
            assignments.map((assignment) => {
              const status =
                userRole === "student"
                  ? getSubmissionStatus(assignment)
                  : null;

              return (
                <Link
                  key={assignment.id}
                  href={`/assignments/${assignment.id}`}
                  className="card hover:shadow-lg transition-shadow cursor-pointer"
                >
                  <div className="flex flex-col h-full">
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <h3 className="text-lg font-semibold text-college-accent font-poppins">
                        {assignment.title}
                      </h3>
                      <div className="flex flex-col gap-1">
                        {assignment.type === "code" && (
                          <span className="text-xs font-semibold px-2 py-1 rounded bg-purple-100 text-purple-700 whitespace-nowrap">
                            Code
                          </span>
                        )}
                        {assignment.type === "project" && userRole === "faculty" && assignment.project_category && (
                          <span className="text-xs font-semibold px-2 py-1 rounded bg-blue-100 text-blue-700 whitespace-nowrap">
                            {PROJECT_CATEGORIES.find(cat => cat.id === assignment.project_category)?.label || assignment.project_category}
                          </span>
                        )}
                      </div>
                    </div>
                    <p className="text-sm text-gray-600 font-poppins mb-3 line-clamp-2">
                      {assignment.description}
                    </p>

                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-xs text-gray-500 font-poppins">
                        Section:
                      </span>
                      <span className="text-xs font-semibold text-college-secondary font-poppins">
                        {assignment.section}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 mb-3">
                      <span className="text-xs text-gray-500 font-poppins">
                        Deadline:
                      </span>
                      <span className="text-xs font-semibold text-college-accent font-poppins">
                        {formatDate(assignment.deadline)}
                      </span>
                    </div>

                    <div className="mt-auto pt-3 border-t border-college-peach">
                      {userRole === "faculty" ? (
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-gray-500 font-poppins">
                            Submissions:
                          </span>
                          <span className="text-sm font-bold text-college-secondary font-poppins">
                            {assignment.submissionCount ?? 0}
                          </span>
                        </div>
                      ) : (
                        <div className="space-y-2">
                          {status && (
                            <span
                              className={`text-xs font-semibold px-3 py-1 rounded-full ${status.class}`}
                            >
                              {status.text}
                            </span>
                          )}
                          {assignment.type === "code" &&
                            assignment.latestSubmission &&
                            assignment.latestSubmission.tests_passed !== null &&
                            assignment.latestSubmission.tests_passed !== undefined &&
                            assignment.latestSubmission.tests_total !== null &&
                            assignment.latestSubmission.tests_total !== undefined && (
                              <div className="text-xs font-poppins">
                                <span className="text-gray-500">Tests: </span>
                                <span
                                  className={
                                    assignment.latestSubmission.tests_passed ===
                                    assignment.latestSubmission.tests_total
                                      ? "text-green-600 font-semibold"
                                      : "text-orange-600 font-semibold"
                                  }
                                >
                                  {assignment.latestSubmission.tests_passed}/
                                  {assignment.latestSubmission.tests_total}
                                </span>
                              </div>
                            )}
                        </div>
                      )}
                    </div>
                  </div>
                </Link>
              );
            })
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
