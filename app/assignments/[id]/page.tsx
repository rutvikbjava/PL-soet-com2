"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Assignment {
  id: string;
  title: string;
  description: string;
  section: string;
  deadline: string;
  max_marks: number;
  attachment_url: string | null;
  attachment_name: string | null;
  created_by_email: string;
}

interface Submission {
  id: string;
  assignment_id: string;
  student_email: string;
  file_url: string;
  file_name: string;
  attempt: number;
  status: string;
  marks: number | null;
  feedback: string | null;
  submitted_at: string;
  graded_at: string | null;
}

interface StudentWithSubmission {
  email: string;
  full_name: string | null;
  latestSubmission: Submission | null;
  attemptCount: number;
}

export default function AssignmentDetailPage() {
  const router = useRouter();
  const params = useParams();
  const assignmentId = params.id as string;

  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [studentsWithSubmissions, setStudentsWithSubmissions] = useState<StudentWithSubmission[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [gradingMarks, setGradingMarks] = useState<number>(0);
  const [gradingFeedback, setGradingFeedback] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);

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
      const id = session.user.id;
      setUserEmail(email);
      setUserId(id);

      // Fetch user profile
      const { data: userData } = await supabase
        .from("users")
        .select("role")
        .eq("email", email)
        .single();

      const role = (userData as any)?.role || null;
      setUserRole(role);

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

      // If student, fetch submissions
      if (role === "student") {
        const { data: submissionsData } = await supabase
          .from("submissions")
          .select("*")
          .eq("assignment_id", assignmentId)
          .eq("student_email", email)
          .order("submitted_at", { ascending: false });

        setSubmissions((submissionsData ?? []) as Submission[]);
      }

      // If faculty, fetch students and submissions
      if (role === "faculty") {
        const assignmentSection = (assignmentData as Assignment).section;

        // Fetch students in the section
        const { data: studentsData } = await supabase
          .from("users")
          .select("email, full_name")
          .eq("role", "student")
          .eq("section", assignmentSection);

        const students = (studentsData ?? []) as { email: string; full_name: string | null }[];

        // Fetch all submissions for this assignment
        const { data: allSubmissionsData } = await supabase
          .from("submissions")
          .select("*")
          .eq("assignment_id", assignmentId)
          .order("submitted_at", { ascending: false });

        const allSubmissions = (allSubmissionsData ?? []) as Submission[];

        // Build student list with latest submissions
        const studentsList: StudentWithSubmission[] = students.map((student) => {
          const studentSubmissions = allSubmissions.filter(
            (sub) => sub.student_email === student.email
          );
          const latestSubmission = studentSubmissions[0] || null;

          return {
            email: student.email,
            full_name: student.full_name,
            latestSubmission,
            attemptCount: studentSubmissions.length,
          };
        });

        setStudentsWithSubmissions(studentsList);
      }

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!file) {
      setSubmitError("Please select a file to submit");
      return;
    }

    if (!userId || !assignment) {
      setSubmitError("Invalid session");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const supabase = createBrowserClient();

      // Upload file
      const timestamp = Date.now();
      const fileName = `${userId}-${timestamp}-${file.name}`;
      const filePath = `submissions/${assignmentId}/${fileName}`;

      const { error: uploadError } = await supabase.storage
        .from("assignments")
        .upload(filePath, file);

      if (uploadError) {
        throw new Error("Failed to upload file: " + uploadError.message);
      }

      // Get public URL
      const { data: publicUrlData } = supabase.storage
        .from("assignments")
        .getPublicUrl(filePath);

      const fileUrl = publicUrlData.publicUrl;

      // Calculate attempt number
      const attemptNumber = submissions.length + 1;

      // Insert submission
      const { error: insertError } = await (supabase.from("submissions") as any)
        .insert({
          assignment_id: assignmentId,
          student_email: userEmail,
          file_url: fileUrl,
          file_name: file.name,
          attempt: attemptNumber,
          status: "submitted",
        });

      if (insertError) {
        throw new Error("Failed to submit: " + insertError.message);
      }

      // Notify faculty
      await (supabase.from("assignment_notifications") as any).insert({
        user_email: assignment.created_by_email,
        message: `${userEmail} submitted ${assignment.title}`,
        link: `/assignments/${assignmentId}`,
        is_read: false,
      });

      // Reset form and reload data
      setFile(null);
      await fetchData();
    } catch (err: any) {
      console.error("Submit error:", err);
      setSubmitError(err.message || "Failed to submit assignment");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGrade = async (submissionId: string, studentEmail: string) => {
    if (!assignment) return;

    setGrading(true);
    setGradingError(null);

    try {
      const supabase = createBrowserClient();
      const now = new Date().toISOString();

      // Update submission
      const { error: updateError } = await (supabase.from("submissions") as any)
        .update({
          marks: gradingMarks,
          feedback: gradingFeedback.trim() || null,
          status: "graded",
          graded_at: now,
        })
        .eq("id", submissionId);

      if (updateError) {
        throw new Error("Failed to save grade: " + updateError.message);
      }

      // Notify student
      await (supabase.from("assignment_notifications") as any).insert({
        user_email: studentEmail,
        message: `Your assignment ${assignment.title} was graded: ${gradingMarks}/${assignment.max_marks}`,
        link: `/assignments/${assignmentId}`,
        is_read: false,
      });

      // Reset and reload
      setExpandedRow(null);
      setGradingMarks(0);
      setGradingFeedback("");
      await fetchData();
    } catch (err: any) {
      console.error("Grading error:", err);
      setGradingError(err.message || "Failed to save grade");
    } finally {
      setGrading(false);
    }
  };

  const handleReturn = async (submissionId: string, studentEmail: string) => {
    if (!assignment) return;

    if (!gradingFeedback.trim()) {
      setGradingError("Feedback is required when returning for correction");
      return;
    }

    setGrading(true);
    setGradingError(null);

    try {
      const supabase = createBrowserClient();

      // Update submission
      const { error: updateError } = await (supabase.from("submissions") as any)
        .update({
          feedback: gradingFeedback.trim(),
          status: "returned",
        })
        .eq("id", submissionId);

      if (updateError) {
        throw new Error("Failed to return submission: " + updateError.message);
      }

      // Notify student
      await (supabase.from("assignment_notifications") as any).insert({
        user_email: studentEmail,
        message: `Your assignment ${assignment.title} was returned for correction`,
        link: `/assignments/${assignmentId}`,
        is_read: false,
      });

      // Reset and reload
      setExpandedRow(null);
      setGradingMarks(0);
      setGradingFeedback("");
      await fetchData();
    } catch (err: any) {
      console.error("Return error:", err);
      setGradingError(err.message || "Failed to return submission");
    } finally {
      setGrading(false);
    }
  };

  const toggleRow = (email: string, submission: Submission | null) => {
    if (expandedRow === email) {
      setExpandedRow(null);
      setGradingMarks(0);
      setGradingFeedback("");
      setGradingError(null);
    } else {
      setExpandedRow(email);
      setGradingMarks(submission?.marks ?? 0);
      setGradingFeedback(submission?.feedback ?? "");
      setGradingError(null);
    }
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  };

  const getDeadlineStatus = (): { text: string; class: string } => {
    if (!assignment) {
      return { text: "", class: "" };
    }

    const deadline = new Date(assignment.deadline);
    const now = new Date();

    if (now > deadline) {
      return { text: "Deadline passed", class: "text-red-600" };
    }

    const diff = deadline.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

    if (days > 0) {
      return {
        text: `${days} day${days > 1 ? "s" : ""} ${hours} hour${hours !== 1 ? "s" : ""} remaining`,
        class: "text-green-600",
      };
    } else if (hours > 0) {
      return { text: `${hours} hour${hours !== 1 ? "s" : ""} remaining`, class: "text-orange-600" };
    } else {
      return { text: "Less than 1 hour remaining", class: "text-red-600" };
    }
  };

  const canSubmit = () => {
    if (!assignment) return false;

    const deadline = new Date(assignment.deadline);
    const now = new Date();
    const latestSubmission = submissions[0];

    // No submission yet and deadline not passed
    if (submissions.length === 0 && now <= deadline) {
      return true;
    }

    // Latest submission was returned (resubmission allowed)
    if (latestSubmission && latestSubmission.status === "returned") {
      return true;
    }

    return false;
  };

  const getSubmitMessage = () => {
    if (!assignment) return "";

    const deadline = new Date(assignment.deadline);
    const now = new Date();
    const latestSubmission = submissions[0];

    if (submissions.length === 0 && now > deadline) {
      return "Submission closed (deadline passed)";
    }

    if (latestSubmission && latestSubmission.status === "submitted") {
      return "Waiting for grading";
    }

    if (latestSubmission && latestSubmission.status === "graded") {
      return "Submission graded";
    }

    return "";
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "submitted":
        return "bg-blue-100 text-blue-700";
      case "graded":
        return "bg-green-100 text-green-700";
      case "returned":
        return "bg-orange-100 text-orange-700";
      default:
        return "bg-gray-100 text-gray-700";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading...</p>
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

  // Faculty view placeholder
  if (userRole === "faculty") {
    if (!assignment) return null;

    const submittedCount = studentsWithSubmissions.filter((s) => s.latestSubmission).length;
    const totalCount = studentsWithSubmissions.length;
    const missingCount = totalCount - submittedCount;
    const missingStudents = studentsWithSubmissions.filter((s) => !s.latestSubmission);

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

          {/* Assignment Details */}
          <div className="card mb-6">
            <h1 className="page-heading mb-4">{assignment.title}</h1>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div>
                <span className="text-xs text-gray-500 font-poppins">Section:</span>
                <p className="text-sm font-semibold text-college-secondary font-poppins">
                  {assignment.section}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500 font-poppins">Deadline:</span>
                <p className="text-sm font-semibold text-college-accent font-poppins">
                  {formatDateTime(assignment.deadline)}
                </p>
              </div>
              <div>
                <span className="text-xs text-gray-500 font-poppins">Maximum Marks:</span>
                <p className="text-sm font-semibold text-college-secondary font-poppins">
                  {assignment.max_marks}
                </p>
              </div>
            </div>
          </div>

          {/* Summary */}
          <div className="card mb-6">
            <p className="text-sm font-poppins text-college-accent">
              <span className="font-semibold">{submittedCount}</span> of{" "}
              <span className="font-semibold">{totalCount}</span> submitted,{" "}
              <span className="font-semibold text-red-600">{missingCount}</span> missing
            </p>
          </div>

          {/* Submissions Table */}
          <div className="card mb-6">
            <h2 className="section-heading mb-4">Student Submissions</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Student Email</th>
                    <th className="table-header">Submitted At</th>
                    <th className="table-header">Attempts</th>
                    <th className="table-header">File</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Marks</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {studentsWithSubmissions.map((student) => {
                    const sub = student.latestSubmission;
                    const isExpanded = expandedRow === student.email;

                    return (
                      <>
                        <tr key={student.email} className="table-row">
                          <td className="px-4 py-3 text-sm text-college-text font-poppins">
                            {student.email}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                            {sub ? (
                              formatDateTime(sub.submitted_at)
                            ) : (
                              <span className="text-red-600 font-semibold">Missing</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                            {student.attemptCount}
                          </td>
                          <td className="px-4 py-3">
                            {sub ? (
                              <a
                                href={sub.file_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-college-secondary text-sm font-poppins hover:underline"
                              >
                                Open
                              </a>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {sub ? (
                              <span
                                className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusBadgeClass(
                                  sub.status
                                )}`}
                              >
                                {sub.status}
                              </span>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                          <td className="px-4 py-3 text-sm font-semibold text-college-accent font-poppins">
                            {sub?.marks !== null && sub?.marks !== undefined
                              ? `${sub.marks}/${assignment.max_marks}`
                              : "—"}
                          </td>
                          <td className="px-4 py-3">
                            {sub ? (
                              <button
                                onClick={() => toggleRow(student.email, sub)}
                                className="text-college-secondary text-sm font-poppins hover:underline"
                              >
                                {isExpanded ? "Close" : "Grade"}
                              </button>
                            ) : (
                              <span className="text-gray-400 text-sm">—</span>
                            )}
                          </td>
                        </tr>
                        {isExpanded && sub && (
                          <tr key={`${student.email}-form`}>
                            <td colSpan={7} className="px-4 py-4 bg-college-peach">
                              <div className="max-w-2xl">
                                <h3 className="text-sm font-semibold text-college-accent font-poppins mb-3">
                                  Grade Submission
                                </h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                                  <div>
                                    <label className="block text-xs font-medium text-gray-700 font-poppins mb-1">
                                      Marks (out of {assignment.max_marks})
                                    </label>
                                    <input
                                      type="number"
                                      value={gradingMarks}
                                      onChange={(e) =>
                                        setGradingMarks(parseInt(e.target.value) || 0)
                                      }
                                      min={0}
                                      max={assignment.max_marks}
                                      className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
                                    />
                                  </div>
                                </div>
                                <div className="mb-4">
                                  <label className="block text-xs font-medium text-gray-700 font-poppins mb-1">
                                    Feedback
                                  </label>
                                  <textarea
                                    value={gradingFeedback}
                                    onChange={(e) => setGradingFeedback(e.target.value)}
                                    placeholder="Enter feedback for the student"
                                    className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary resize-none"
                                    rows={3}
                                  />
                                </div>
                                {gradingError && (
                                  <p className="text-red-500 text-sm font-poppins mb-3">
                                    {gradingError}
                                  </p>
                                )}
                                <div className="flex gap-3">
                                  <button
                                    onClick={() => handleGrade(sub.id, student.email)}
                                    disabled={grading}
                                    className="bg-green-500 text-white px-4 py-2 rounded-full font-poppins font-semibold text-sm hover:bg-green-600 transition-colors"
                                  >
                                    {grading ? "Saving..." : "Save Grade"}
                                  </button>
                                  <button
                                    onClick={() => handleReturn(sub.id, student.email)}
                                    disabled={grading}
                                    className="bg-orange-500 text-white px-4 py-2 rounded-full font-poppins font-semibold text-sm hover:bg-orange-600 transition-colors"
                                  >
                                    {grading ? "Returning..." : "Return for Correction"}
                                  </button>
                                  <button
                                    onClick={() => toggleRow(student.email, sub)}
                                    className="btn-secondary text-sm"
                                  >
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            </td>
                          </tr>
                        )}
                      </>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Missing Submissions */}
          {missingStudents.length > 0 && (
            <div className="card">
              <h2 className="section-heading mb-4">Missing Submissions</h2>
              <div className="flex flex-wrap gap-2">
                {missingStudents.map((student) => (
                  <span
                    key={student.email}
                    className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-poppins"
                  >
                    {student.email}
                  </span>
                ))}
              </div>
            </div>
          )}
        </main>

        <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
          © MGM University SOET | EduSphere AI
        </footer>
      </div>
    );
  }

  if (!assignment) {
    return null;
  }

  const deadlineStatus = getDeadlineStatus();

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

        {/* Assignment Details */}
        <div className="card mb-6">
          <h1 className="page-heading mb-4">{assignment.title}</h1>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div>
              <span className="text-xs text-gray-500 font-poppins">Section:</span>
              <p className="text-sm font-semibold text-college-secondary font-poppins">
                {assignment.section}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500 font-poppins">Deadline:</span>
              <p className="text-sm font-semibold text-college-accent font-poppins">
                {formatDateTime(assignment.deadline)}
              </p>
              <p className={`text-xs font-semibold font-poppins mt-1 ${deadlineStatus.class}`}>
                {deadlineStatus.text}
              </p>
            </div>
            <div>
              <span className="text-xs text-gray-500 font-poppins">Maximum Marks:</span>
              <p className="text-sm font-semibold text-college-secondary font-poppins">
                {assignment.max_marks}
              </p>
            </div>
          </div>

          <div className="border-t border-college-peach pt-4 mb-4">
            <h3 className="text-sm font-semibold text-college-accent font-poppins mb-2">
              Description
            </h3>
            <p className="text-sm text-gray-600 font-poppins whitespace-pre-wrap">
              {assignment.description}
            </p>
          </div>

          {assignment.attachment_url && assignment.attachment_name && (
            <div className="border-t border-college-peach pt-4">
              <h3 className="text-sm font-semibold text-college-accent font-poppins mb-2">
                Instruction File
              </h3>
              <a
                href={assignment.attachment_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-college-secondary text-sm font-poppins hover:underline"
              >
                📎 {assignment.attachment_name}
              </a>
            </div>
          )}
        </div>

        {/* Submission History */}
        {submissions.length > 0 && (
          <div className="card mb-6">
            <h2 className="section-heading mb-4">Submission History</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Attempt</th>
                    <th className="table-header">File</th>
                    <th className="table-header">Submitted At</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Marks</th>
                    <th className="table-header">Feedback</th>
                  </tr>
                </thead>
                <tbody>
                  {submissions.map((submission) => (
                    <tr key={submission.id} className="table-row">
                      <td className="px-4 py-3 text-sm text-college-text font-poppins font-semibold">
                        #{submission.attempt}
                      </td>
                      <td className="px-4 py-3">
                        <a
                          href={submission.file_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-college-secondary text-sm font-poppins hover:underline"
                        >
                          {submission.file_name}
                        </a>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
                        {formatDateTime(submission.submitted_at)}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusBadgeClass(
                            submission.status
                          )}`}
                        >
                          {submission.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-college-accent font-poppins">
                        {submission.marks !== null
                          ? `${submission.marks}/${assignment.max_marks}`
                          : "—"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins italic">
                        {submission.feedback || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Submit Form or Message */}
        {canSubmit() ? (
          <div className="card">
            <h2 className="section-heading mb-4">
              {submissions.length > 0 ? "Resubmit Assignment" : "Submit Assignment"}
            </h2>
            <form onSubmit={handleSubmit}>
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                  Upload File <span className="text-red-500">*</span>
                </label>
                <input
                  type="file"
                  onChange={(e) => setFile(e.target.files?.[0] || null)}
                  accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.py,.java,.js,.c,.cpp,.txt"
                  className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
                  required
                />
                {file && (
                  <p className="text-xs text-gray-500 font-poppins mt-2">
                    Selected: {file.name}
                  </p>
                )}
              </div>

              {submitError && (
                <div className="mb-4">
                  <p className="text-red-500 text-sm font-poppins">{submitError}</p>
                </div>
              )}

              <button type="submit" disabled={submitting} className="btn-primary">
                {submitting ? "Submitting..." : "Submit Assignment"}
              </button>
            </form>
          </div>
        ) : (
          <div className="card">
            <p className="text-sm text-gray-600 font-poppins text-center">
              {getSubmitMessage()}
            </p>
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
