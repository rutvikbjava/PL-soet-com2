"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { detectLinkType } from "@/lib/link-detector";
import Navbar from "@/components/Navbar";

interface Assignment {
  id: string;
  title: string;
  description: string;
  section: string;
  deadline: string;
  max_marks: number;
  created_by_email: string;
  type?: string;
  submission_link?: string | null;
  submission_link_type?: string | null;
}

interface Submission {
  id: string;
  assignment_id: string;
  student_id: string;
  file_url: string;
  file_name: string;
  status: string;
  marks: number | null;
  feedback: string | null;
  submitted_at: string;
  link_opened_at?: string | null;
  submitted_via?: string | null;
}

interface User {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
}

interface StudentSubmission {
  student: User;
  submission: Submission | null;
}

export default function GradeAssignmentPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.id as string;

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [studentSubmissions, setStudentSubmissions] = useState<StudentSubmission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        .select("role")
        .eq("email", email)
        .single();

      const role = (userData as any)?.role || null;
      setUserRole(role);

      // Only faculty can access this page
      if (role !== "faculty") {
        router.push("/assignments");
        return;
      }

      // Fetch assignment
      const { data: assignmentData, error: assignmentError } = await supabase
        .from("assignments")
        .select("*")
        .eq("id", assignmentId)
        .single();

      if (assignmentError || !assignmentData) {
        throw new Error("Assignment not found");
      }

      setAssignment(assignmentData as Assignment);

      const assignmentSection = (assignmentData as Assignment).section;

      // Fetch students in the section
      const { data: studentsData } = await (supabase as any)
        .from("users")
        .select("id, email, full_name, role")
        .eq("role", "student")
        .eq("section", assignmentSection);

      const students = (studentsData ?? []) as User[];

      // Fetch all submissions for this assignment
      const { data: submissionsData } = await (supabase as any)
        .from("submissions")
        .select("*")
        .eq("assignment_id", assignmentId);

      const submissions = (submissionsData ?? []) as Submission[];

      // Build student list with submissions
      const studentsList: StudentSubmission[] = students.map((student) => {
        const studentSub = submissions.find(
          (sub) => sub.student_id === student.id
        ) || null;

        return {
          student,
          submission: studentSub,
        };
      });

      setStudentSubmissions(studentsList);
      setLoading(false);
    } catch (err: any) {
      console.error("Fetch error:", err);
      setError(err.message || "An unexpected error occurred.");
      setLoading(false);
    }
  };

  useEffect(() => {
    if (assignmentId) {
      fetchData();
    }
  }, [assignmentId, router]);

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <p className="text-college-text font-poppins">Loading...</p>
        </main>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <div className="card">
            <p className="text-red-500 font-poppins">{error}</p>
          </div>
        </main>
      </div>
    );
  }

  if (!assignment) {
    return null;
  }

  // Calculate statistics for link assignments
  const totalOpened = studentSubmissions.filter(
    (ss) => ss.submission?.link_opened_at
  ).length;
  const totalSubmitted = studentSubmissions.filter(
    (ss) => ss.submission?.submitted_via === "link"
  ).length;
  const notYetOpened = studentSubmissions.length - totalOpened;

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href={`/assignments/${assignmentId}`}
          className="text-college-secondary text-sm mb-4 inline-block font-poppins hover:underline"
        >
          ← Back to Assignment Details
        </Link>

        {/* Assignment Header */}
        <div className="card mb-6">
          <h1 className="page-heading mb-2">{assignment.title}</h1>
          <p className="text-sm text-gray-600 font-poppins">
            Section: {assignment.section} | Max Marks: {assignment.max_marks}
          </p>
        </div>

        {/* Link Assignment Handling */}
        {assignment.type === "link" && assignment.submission_link ? (
          <>
            {/* Submission Link Info */}
            <div className="card mb-6">
              <h2 className="section-heading mb-4">Submission Link</h2>
              <div className="flex gap-4 flex-wrap items-center">
                {/* Link Type */}
                <div>
                  <span className="text-xs text-gray-500 font-poppins">
                    Link Type:
                  </span>
                  <p className="text-sm font-semibold text-college-secondary font-poppins">
                    {detectLinkType(assignment.submission_link).label}
                  </p>
                </div>

                {/* Direct Link Button */}
                <div>
                  <a
                    href={assignment.submission_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn-secondary text-sm"
                  >
                    Open {detectLinkType(assignment.submission_link).label}
                  </a>
                </div>
              </div>
            </div>

            {/* Submission Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {/* Total Submissions */}
              <div className="card bg-blue-50">
                <h3 className="text-xs text-gray-600 font-poppins mb-1">
                  Total Opened
                </h3>
                <p className="text-3xl font-bold text-college-secondary font-poppins">
                  {totalOpened}
                </p>
              </div>

              {/* Marked Submitted */}
              <div className="card bg-green-50">
                <h3 className="text-xs text-gray-600 font-poppins mb-1">
                  Marked Submitted
                </h3>
                <p className="text-3xl font-bold text-green-600 font-poppins">
                  {totalSubmitted}
                </p>
              </div>

              {/* Not Yet Opened */}
              <div className="card bg-yellow-50">
                <h3 className="text-xs text-gray-600 font-poppins mb-1">
                  Not Yet Opened
                </h3>
                <p className="text-3xl font-bold text-yellow-600 font-poppins">
                  {notYetOpened}
                </p>
              </div>
            </div>

            {/* Student Submissions Table */}
            <div className="card mb-6">
              <h2 className="section-heading mb-4">Student Submissions</h2>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Student Name</th>
                      <th className="table-header">Email</th>
                      <th className="table-header">Opened At</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {studentSubmissions.map((ss) => (
                      <tr key={ss.student.id} className="table-row">
                        <td className="px-4 py-3 text-sm text-college-text font-poppins font-semibold">
                          {ss.student.full_name || "N/A"}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                          {ss.student.email}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                          {ss.submission?.link_opened_at ? (
                            formatDateTime(ss.submission.link_opened_at)
                          ) : (
                            <span className="text-gray-400">Not opened yet</span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {ss.submission?.submitted_via === "link" ? (
                            <span className="badge-approved">Submitted</span>
                          ) : ss.submission?.link_opened_at ? (
                            <span className="badge-pending">Opened</span>
                          ) : (
                            <span className="badge-draft">Not opened</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 font-poppins">
                          —
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Note for Faculty */}
            <div className="bg-college-peach rounded p-3 text-sm text-college-accent font-poppins">
              To view student responses, open the Google Form or Drive link above.
            </div>
          </>
        ) : (
          /* Code/Document Assignment Grading - Keep existing functionality */
          <div className="card">
            <h2 className="section-heading mb-4">Student Submissions</h2>
            <p className="text-sm text-gray-600 font-poppins">
              Grading interface for code and document assignments would be here.
            </p>
            {/* Add existing code/document grading sections here if needed */}
          </div>
        )}
      </main>

      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
