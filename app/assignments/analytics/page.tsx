"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Assignment {
  id: string;
  title: string;
  section: string;
  max_marks: number;
  created_by_email: string;
}

interface Submission {
  id: string;
  assignment_id: string;
  student_email: string;
  status: string;
  marks: number | null;
  submitted_at: string;
}

interface AssignmentStats {
  id: string;
  title: string;
  section: string;
  maxMarks: number;
  submitted: number;
  total: number;
  submissionPercent: number;
  averageMarks: number | null;
}

interface StudentStats {
  email: string;
  submittedCount: number;
  gradedCount: number;
  averageScore: number | null;
}

export default function AssignmentAnalyticsPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overallSubmissionPercent, setOverallSubmissionPercent] = useState(0);
  const [pendingSubmissions, setPendingSubmissions] = useState(0);
  const [averageScorePercent, setAverageScorePercent] = useState(0);
  const [totalAssignments, setTotalAssignments] = useState(0);
  const [assignmentStats, setAssignmentStats] = useState<AssignmentStats[]>([]);
  const [studentStats, setStudentStats] = useState<StudentStats[]>([]);

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

        // Fetch user role
        const { data: userData } = await supabase
          .from("users")
          .select("role")
          .eq("email", email)
          .single();

        const role = (userData as any)?.role || null;
        setUserRole(role);

        // Redirect if not faculty
        if (role !== "faculty") {
          router.push("/assignments");
          return;
        }

        // Fetch faculty's assignments
        const { data: assignmentsData } = await supabase
          .from("assignments")
          .select("*")
          .eq("created_by_email", email);

        const assignments = (assignmentsData ?? []) as Assignment[];
        setTotalAssignments(assignments.length);

        if (assignments.length === 0) {
          setLoading(false);
          return;
        }

        // Fetch all submissions for these assignments
        const assignmentIds = assignments.map((a) => a.id);
        const { data: submissionsData } = await supabase
          .from("submissions")
          .select("*")
          .in("assignment_id", assignmentIds)
          .order("submitted_at", { ascending: false });

        const allSubmissions = (submissionsData ?? []) as Submission[];

        // Build assignment stats
        const assignmentStatsMap: Record<string, AssignmentStats> = {};
        let totalExpected = 0;
        let totalSubmitted = 0;
        let totalMarks = 0;
        let totalMaxMarks = 0;
        let gradedCount = 0;

        for (const assignment of assignments) {
          // Fetch students in this section
          const { data: studentsData } = await supabase
            .from("users")
            .select("email")
            .eq("role", "student")
            .eq("section", assignment.section);

          const students = (studentsData ?? []) as { email: string }[];
          const studentCount = students.length;
          totalExpected += studentCount;

          // Get latest submission per student for this assignment
          const assignmentSubmissions = allSubmissions.filter(
            (s) => s.assignment_id === assignment.id
          );

          const latestSubmissionsMap: Record<string, Submission> = {};
          for (const sub of assignmentSubmissions) {
            if (
              !latestSubmissionsMap[sub.student_email] ||
              new Date(sub.submitted_at) >
                new Date(latestSubmissionsMap[sub.student_email].submitted_at)
            ) {
              latestSubmissionsMap[sub.student_email] = sub;
            }
          }

          const latestSubmissions = Object.values(latestSubmissionsMap);
          const submittedCount = latestSubmissions.length;
          totalSubmitted += submittedCount;

          // Calculate average marks for graded submissions
          const gradedSubmissions = latestSubmissions.filter(
            (s) => s.status === "graded" && s.marks !== null
          );
          let avgMarks: number | null = null;

          if (gradedSubmissions.length > 0) {
            const sum = gradedSubmissions.reduce((acc, s) => acc + (s.marks ?? 0), 0);
            avgMarks = sum / gradedSubmissions.length;

            // Add to overall average calculation
            for (const sub of gradedSubmissions) {
              totalMarks += sub.marks ?? 0;
              totalMaxMarks += assignment.max_marks;
              gradedCount++;
            }
          }

          assignmentStatsMap[assignment.id] = {
            id: assignment.id,
            title: assignment.title,
            section: assignment.section,
            maxMarks: assignment.max_marks,
            submitted: submittedCount,
            total: studentCount,
            submissionPercent: studentCount > 0 ? (submittedCount / studentCount) * 100 : 0,
            averageMarks: avgMarks,
          };
        }

        setAssignmentStats(Object.values(assignmentStatsMap));

        // Calculate overall stats
        const overallPercent = totalExpected > 0 ? (totalSubmitted / totalExpected) * 100 : 0;
        setOverallSubmissionPercent(overallPercent);
        setPendingSubmissions(totalExpected - totalSubmitted);

        const avgScore = totalMaxMarks > 0 ? (totalMarks / totalMaxMarks) * 100 : 0;
        setAverageScorePercent(avgScore);

        // Build student performance stats
        const studentStatsMap: Record<string, StudentStats> = {};

        for (const sub of allSubmissions) {
          if (!studentStatsMap[sub.student_email]) {
            studentStatsMap[sub.student_email] = {
              email: sub.student_email,
              submittedCount: 0,
              gradedCount: 0,
              averageScore: null,
            };
          }

          // Count as submitted if it's the latest for this student-assignment pair
          const assignment = assignments.find((a) => a.id === sub.assignment_id);
          if (!assignment) continue;

          const assignmentSubmissions = allSubmissions.filter(
            (s) => s.assignment_id === sub.assignment_id && s.student_email === sub.student_email
          );

          // Check if this is the latest submission
          const isLatest = assignmentSubmissions.every(
            (s) =>
              s.id === sub.id || new Date(s.submitted_at) <= new Date(sub.submitted_at)
          );

          if (isLatest) {
            studentStatsMap[sub.student_email].submittedCount++;

            if (sub.status === "graded" && sub.marks !== null) {
              studentStatsMap[sub.student_email].gradedCount++;
            }
          }
        }

        // Calculate average score for each student
        for (const studentEmail in studentStatsMap) {
          const studentSubs = allSubmissions.filter((s) => s.student_email === studentEmail);

          // Get latest submission per assignment
          const latestByAssignment: Record<string, Submission> = {};
          for (const sub of studentSubs) {
            if (
              !latestByAssignment[sub.assignment_id] ||
              new Date(sub.submitted_at) >
                new Date(latestByAssignment[sub.assignment_id].submitted_at)
            ) {
              latestByAssignment[sub.assignment_id] = sub;
            }
          }

          const gradedSubs = Object.values(latestByAssignment).filter(
            (s) => s.status === "graded" && s.marks !== null
          );

          if (gradedSubs.length > 0) {
            let totalScore = 0;
            let totalMax = 0;

            for (const sub of gradedSubs) {
              const assignment = assignments.find((a) => a.id === sub.assignment_id);
              if (assignment) {
                totalScore += sub.marks ?? 0;
                totalMax += assignment.max_marks;
              }
            }

            studentStatsMap[studentEmail].averageScore =
              totalMax > 0 ? (totalScore / totalMax) * 100 : null;
          }
        }

        // Sort by average score descending
        const sortedStudents = Object.values(studentStatsMap).sort((a, b) => {
          if (a.averageScore === null && b.averageScore === null) return 0;
          if (a.averageScore === null) return 1;
          if (b.averageScore === null) return -1;
          return b.averageScore - a.averageScore;
        });

        setStudentStats(sortedStudents);
        setLoading(false);
      } catch (err: any) {
        console.error("Analytics fetch error:", err);
        setError(err.message || "An unexpected error occurred.");
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading analytics...</p>
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
            <Link href="/assignments" className="btn-secondary mt-4 inline-block">
              Back to Assignments
            </Link>
          </div>
        </div>
      </div>
    );
  }

  if (totalAssignments === 0) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <main className="max-w-6xl mx-auto px-6 py-8">
          <Link
            href="/assignments"
            className="text-college-secondary text-sm mb-4 inline-block font-poppins hover:underline"
          >
            ← Back to Assignments
          </Link>
          <div className="card text-center">
            <p className="text-gray-500 font-poppins">
              No assignments yet. Create your first assignment to see analytics.
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/assignments"
          className="text-college-secondary text-sm mb-4 inline-block font-poppins hover:underline"
        >
          ← Back to Assignments
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">Assignment Analytics</h1>
          <p className="text-sm text-gray-500 font-poppins">
            Overview of submissions and student performance
          </p>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <div className="card text-center">
            <p className="text-3xl font-bold text-college-secondary font-poppins">
              {overallSubmissionPercent.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 font-poppins mt-1">
              Overall Submission %
            </p>
          </div>

          <div className="card text-center">
            <p className="text-3xl font-bold text-orange-500 font-poppins">
              {pendingSubmissions}
            </p>
            <p className="text-xs text-gray-500 font-poppins mt-1">
              Pending Submissions
            </p>
          </div>

          <div className="card text-center">
            <p className="text-3xl font-bold text-green-600 font-poppins">
              {averageScorePercent.toFixed(1)}%
            </p>
            <p className="text-xs text-gray-500 font-poppins mt-1">
              Average Score %
            </p>
          </div>

          <div className="card text-center">
            <p className="text-3xl font-bold text-college-accent font-poppins">
              {totalAssignments}
            </p>
            <p className="text-xs text-gray-500 font-poppins mt-1">
              Total Assignments
            </p>
          </div>
        </div>

        {/* Assignment-wise Table */}
        <div className="card mb-8">
          <h2 className="section-heading mb-4">Assignment-wise Breakdown</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Title</th>
                  <th className="table-header">Section</th>
                  <th className="table-header">Submitted/Total</th>
                  <th className="table-header">Submission %</th>
                  <th className="table-header">Avg Marks</th>
                  <th className="table-header">Progress</th>
                </tr>
              </thead>
              <tbody>
                {assignmentStats.map((stat) => (
                  <tr key={stat.id} className="table-row">
                    <td className="px-4 py-3 text-sm font-medium text-college-text font-poppins">
                      {stat.title}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                      {stat.section}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                      {stat.submitted}/{stat.total}
                    </td>
                    <td className="px-4 py-3 text-sm font-semibold text-college-secondary font-poppins">
                      {stat.submissionPercent.toFixed(1)}%
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                      {stat.averageMarks !== null
                        ? `${stat.averageMarks.toFixed(1)}/${stat.maxMarks}`
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="w-full bg-gray-200 rounded-full h-2">
                        <div
                          className="bg-college-secondary h-2 rounded-full"
                          style={{ width: `${stat.submissionPercent}%` }}
                        ></div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Student Performance Table */}
        <div className="card">
          <h2 className="section-heading mb-4">Student Performance</h2>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr>
                  <th className="table-header">Student Email</th>
                  <th className="table-header">Submitted</th>
                  <th className="table-header">Graded</th>
                  <th className="table-header">Average Score %</th>
                </tr>
              </thead>
              <tbody>
                {studentStats.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-6 text-center text-gray-500 font-poppins text-sm">
                      No submissions yet
                    </td>
                  </tr>
                ) : (
                  studentStats.map((student) => (
                    <tr key={student.email} className="table-row">
                      <td className="px-4 py-3 text-sm text-college-text font-poppins">
                        {student.email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                        {student.submittedCount}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                        {student.gradedCount}
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-college-accent font-poppins">
                        {student.averageScore !== null
                          ? `${student.averageScore.toFixed(1)}%`
                          : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
