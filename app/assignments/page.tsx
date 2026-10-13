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
  department?: string | null;
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

interface GroupedAssignments {
  [department: string]: {
    [section: string]: {
      [creatorEmail: string]: AssignmentWithSubmission[];
    };
  };
}

export default function AssignmentsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userSection, setUserSection] = useState<string | null>(null);
  const [userDepartment, setUserDepartment] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<AssignmentWithSubmission[]>([]);
  const [groupedAssignments, setGroupedAssignments] = useState<GroupedAssignments>({});
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
          .select("role, section, department")
          .eq("email", email)
          .single();

        const role = (userData as any)?.role || null;
        const section = (userData as any)?.section || null;
        const department = (userData as any)?.department || null;
        setUserRole(role);
        setUserSection(section);
        setUserDepartment(department);

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
              .maybeSingle();

            assignmentsWithSubmissions.push({
              ...assignment,
              latestSubmission: submissionData as any,
            });
          }

          setAssignments(assignmentsWithSubmissions);
        } else if (role === "hod") {
          // HOD: fetch faculty in their department, then their assignments
          const { data: facultyData } = await supabase
            .from("users")
            .select("email")
            .eq("role", "faculty")
            .eq("department", department);

          const facultyEmails = (facultyData ?? []).map((f: any) => f.email);

          if (facultyEmails.length > 0) {
            const { data: assignmentsData } = await supabase
              .from("assignments")
              .select("*")
              .in("created_by_email", facultyEmails)
              .order("created_at", { ascending: false });

            const assignmentsList = (assignmentsData ?? []) as Assignment[];

            // Group by section, then by creator
            const grouped: GroupedAssignments = {};
            for (const assignment of assignmentsList) {
              const dept = department || "Unknown";
              const sect = assignment.section || "Unknown";
              const creator = assignment.created_by_email;

              if (!grouped[dept]) grouped[dept] = {};
              if (!grouped[dept][sect]) grouped[dept][sect] = {};
              if (!grouped[dept][sect][creator]) grouped[dept][sect][creator] = [];

              grouped[dept][sect][creator].push(assignment);
            }

            setGroupedAssignments(grouped);
          }
        } else if (role === "coe" || role === "principal" || role === "admin") {
          // CoE, Principal, Admin: fetch all assignments from all faculty
          const { data: facultyData } = await supabase
            .from("users")
            .select("email, department")
            .eq("role", "faculty");

          const facultyMap = new Map<string, string>();
          (facultyData ?? []).forEach((f: any) => {
            facultyMap.set(f.email, f.department || "Unknown");
          });

          const facultyEmails = Array.from(facultyMap.keys());

          if (facultyEmails.length > 0) {
            const { data: assignmentsData } = await supabase
              .from("assignments")
              .select("*")
              .in("created_by_email", facultyEmails)
              .order("created_at", { ascending: false });

            const assignmentsList = (assignmentsData ?? []) as Assignment[];

            // Group by department, then section, then creator
            const grouped: GroupedAssignments = {};
            for (const assignment of assignmentsList) {
              const dept = facultyMap.get(assignment.created_by_email) || "Unknown";
              const sect = assignment.section || "Unknown";
              const creator = assignment.created_by_email;

              if (!grouped[dept]) grouped[dept] = {};
              if (!grouped[dept][sect]) grouped[dept][sect] = {};
              if (!grouped[dept][sect][creator]) grouped[dept][sect][creator] = [];

              grouped[dept][sect][creator].push({ ...assignment, department: dept });
            }

            setGroupedAssignments(grouped);
          }
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
                : userRole === "student"
                ? `Assignments for Section ${userSection}`
                : userRole === "hod"
                ? `Assignments from faculty in ${userDepartment} department`
                : "All assignments across departments"}
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
        {(userRole === "hod" || userRole === "coe" || userRole === "principal" || userRole === "admin") ? (
          // Grouped view for HOD, CoE, Principal, Admin
          <div className="space-y-8">
            {Object.keys(groupedAssignments).length === 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500 font-poppins">No assignments available</p>
              </div>
            ) : (
              Object.keys(groupedAssignments).sort().map((department) => (
                <div key={department} className="space-y-6">
                  {(userRole === "coe" || userRole === "principal" || userRole === "admin") && (
                    <h2 className="text-xl font-bold text-college-secondary font-poppins border-b-2 border-college-peach pb-2">
                      {department}
                    </h2>
                  )}
                  {Object.keys(groupedAssignments[department]).sort().map((section) => (
                    <div key={section} className="space-y-4">
                      <h3 className="text-lg font-semibold text-college-accent font-poppins">
                        Section {section}
                      </h3>
                      {Object.keys(groupedAssignments[department][section]).sort().map((creatorEmail) => (
                        <div key={creatorEmail} className="space-y-3">
                          <p className="text-sm text-gray-600 font-poppins ml-4">
                            Faculty: <span className="font-semibold">{creatorEmail}</span>
                          </p>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 ml-8">
                            {groupedAssignments[department][section][creatorEmail].map((assignment) => (
                              <Link
                                key={assignment.id}
                                href={`/assignments/${assignment.id}`}
                                className="card hover:shadow-lg transition-shadow cursor-pointer"
                              >
                                <div className="flex flex-col h-full">
                                  <div className="flex items-start justify-between gap-2 mb-2">
                                    <h4 className="text-lg font-semibold text-college-accent font-poppins">
                                      {assignment.title}
                                    </h4>
                                    <div className="flex flex-col gap-1">
                                      {assignment.type === "code" && (
                                        <span className="text-xs font-semibold px-2 py-1 rounded bg-purple-100 text-purple-700 whitespace-nowrap">
                                          Code
                                        </span>
                                      )}
                                      {assignment.type === "project" && assignment.project_category && (
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
                                      Deadline:
                                    </span>
                                    <span className="text-xs font-semibold text-college-accent font-poppins">
                                      {formatDate(assignment.deadline)}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    <span className="text-xs text-gray-500 font-poppins">
                                      Max Marks:
                                    </span>
                                    <span className="text-xs font-semibold text-college-secondary font-poppins">
                                      {assignment.max_marks}
                                    </span>
                                  </div>
                                </div>
                              </Link>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
              ))
            )}
          </div>
        ) : (
          // Standard grid view for Faculty and Student
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
        )}
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
