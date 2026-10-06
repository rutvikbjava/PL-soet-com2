"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { LANGUAGES } from "@/lib/languages";
import Navbar from "@/components/Navbar";
import { detectLinkType, isValidUrl } from "@/lib/link-detector";
import { PROJECT_CATEGORIES } from "@/lib/project-categories";

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
  type?: string;
  language_id?: number | null;
  language_name?: string | null;
  submission_link?: string | null;
  submission_link_type?: string | null;
  project_category?: string | null;
}

interface TestCase {
  id: string;
  assignment_id: string;
  input: string;
  expected_output: string;
  sort_order: number;
}

interface TestResult {
  index: number;
  passed: boolean;
  status: string;
  input: string;
  expected: string;
  actual: string;
  error: string;
  time: number;
  memory: number;
  match_reason?: string;
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
  code_text?: string | null;
  tests_passed?: number | null;
  tests_total?: number | null;
  test_results?: TestResult[] | null;
  compile_error?: string | null;
  max_time?: number | null;
  max_memory?: number | null;
  link_opened_at?: string | null;
  submitted_via?: string | null;
  team_members?: string | null;
  abstract?: string | null;
  github_link?: string | null;
  report_url?: string | null;
  report_name?: string | null;
  code_zip_url?: string | null;
  code_zip_name?: string | null;
  ppt_url?: string | null;
  ppt_name?: string | null;
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
  const [testCases, setTestCases] = useState<TestCase[]>([]);
  const [studentsWithSubmissions, setStudentsWithSubmissions] = useState<StudentWithSubmission[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [gradingMarks, setGradingMarks] = useState<number>(0);
  const [gradingFeedback, setGradingFeedback] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [runningTests, setRunningTests] = useState(false);
  const [grading, setGrading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [gradingError, setGradingError] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  
  // Link assignment states
  const [hasOpened, setHasOpened] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [linkSubmitting, setLinkSubmitting] = useState(false);
  
  // Faculty re-run and custom test states
  const [rerunning, setRerunning] = useState<string | null>(null);
  const [customTestExpanded, setCustomTestExpanded] = useState<string | null>(null);
  const [customInput, setCustomInput] = useState<string>("");
  const [customRunning, setCustomRunning] = useState(false);
  const [customResult, setCustomResult] = useState<any>(null);
  
  // Project submission states
  const [teamMembers, setTeamMembers] = useState<string>("");
  const [abstract, setAbstract] = useState<string>("");
  const [githubLink, setGithubLink] = useState<string>("");
  const [reportFile, setReportFile] = useState<File | null>(null);
  const [codeZipFile, setCodeZipFile] = useState<File | null>(null);
  const [pptFile, setPptFile] = useState<File | null>(null);

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

      // If code assignment and student, fetch test cases
      if (role === "student" && (assignmentData as any).type === "code") {
        const { data: testCasesData } = await supabase
          .from("test_cases")
          .select("*")
          .eq("assignment_id", assignmentId)
          .order("sort_order", { ascending: true });

        setTestCases((testCasesData ?? []) as TestCase[]);
      }

      // If student, fetch submissions
      if (role === "student") {
        const { data: submissionsData } = await supabase
          .from("submissions")
          .select("*")
          .eq("assignment_id", assignmentId)
          .eq("student_email", email)
          .order("submitted_at", { ascending: false });

        const subs = (submissionsData ?? []) as Submission[];
        setSubmissions(subs);
        
        // Initialize link assignment states
        if (subs.length > 0 && (assignmentData as any).type === "link") {
          const latestSub = subs[0];
          setHasOpened(!!latestSub.link_opened_at);
          setIsSubmitted(latestSub.submitted_via === "link");
        }
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

      // For code assignments, run tests first
      let codeText: string | null = null;
      let testsPassed: number | null = null;
      let testsTotal: number | null = null;
      let testResults: TestResult[] | null = null;
      let compileError: string | null = null;
      let maxTime: number | null = null;
      let maxMemory: number | null = null;

      if (assignment.type === "code" && assignment.language_id) {
        setRunningTests(true);

        try {
          // Read file as text
          codeText = await file.text();

          // Run code against test cases
          const runResponse = await fetch("/api/run-code", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              language_id: assignment.language_id,
              code: codeText,
              tests: testCases.map((tc) => ({
                input: tc.input,
                expected_output: tc.expected_output,
              })),
            }),
          });

          if (!runResponse.ok) {
            const errorData = await runResponse.json();
            throw new Error(errorData.error || "Code execution failed");
          }

          const runResult = await runResponse.json();
          testsPassed = runResult.passed;
          testsTotal = runResult.total;
          testResults = runResult.results;
          compileError = runResult.compile_error;
          maxTime = runResult.max_time;
          maxMemory = runResult.max_memory;
        } catch (runError: any) {
          setRunningTests(false);
          setSubmitError(runError.message || "Failed to run tests");
          setSubmitting(false);
          return;
        } finally {
          setRunningTests(false);
        }
      }

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

      // Prepare submission data
      const submissionData: any = {
        assignment_id: assignmentId,
        student_email: userEmail,
        file_url: fileUrl,
        file_name: file.name,
        attempt: attemptNumber,
        status: "submitted",
      };

      // Add code assignment fields if applicable
      if (assignment.type === "code") {
        submissionData.code_text = codeText;
        submissionData.tests_passed = testsPassed;
        submissionData.tests_total = testsTotal;
        submissionData.test_results = testResults;
        submissionData.compile_error = compileError;
        submissionData.max_time = maxTime;
        submissionData.max_memory = maxMemory;
      }

      // Insert submission
      const { error: insertError } = await (supabase.from("submissions") as any)
        .insert(submissionData);

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

  const handleProjectSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!reportFile || !codeZipFile) {
      setSubmitError("Please provide both Project Report and Code ZIP");
      return;
    }

    if (!teamMembers.trim() || !abstract.trim()) {
      setSubmitError("Please fill in Team Members and Abstract");
      return;
    }

    if (!assignment) {
      setSubmitError("Invalid session");
      return;
    }

    setSubmitting(true);
    setSubmitError(null);

    try {
      const supabase = createBrowserClient();
      const timestamp = Date.now();

      // Upload report
      const reportFileName = `${userEmail}-${timestamp}-report-${reportFile.name}`;
      const reportPath = `projects/${assignmentId}/${reportFileName}`;

      const { error: reportUploadError } = await supabase.storage
        .from("assignments")
        .upload(reportPath, reportFile);

      if (reportUploadError) {
        throw new Error("Failed to upload report: " + reportUploadError.message);
      }

      const { data: reportUrlData } = supabase.storage
        .from("assignments")
        .getPublicUrl(reportPath);

      // Upload code ZIP
      const codeFileName = `${userEmail}-${timestamp}-code-${codeZipFile.name}`;
      const codePath = `projects/${assignmentId}/${codeFileName}`;

      const { error: codeUploadError } = await supabase.storage
        .from("assignments")
        .upload(codePath, codeZipFile);

      if (codeUploadError) {
        throw new Error("Failed to upload code: " + codeUploadError.message);
      }

      const { data: codeUrlData } = supabase.storage
        .from("assignments")
        .getPublicUrl(codePath);

      // Upload PPT if provided
      let pptUrl: string | null = null;
      let pptName: string | null = null;

      if (pptFile) {
        const pptFileName = `${userEmail}-${timestamp}-ppt-${pptFile.name}`;
        const pptPath = `projects/${assignmentId}/${pptFileName}`;

        const { error: pptUploadError } = await supabase.storage
          .from("assignments")
          .upload(pptPath, pptFile);

        if (pptUploadError) {
          throw new Error("Failed to upload presentation: " + pptUploadError.message);
        }

        const { data: pptUrlData } = supabase.storage
          .from("assignments")
          .getPublicUrl(pptPath);

        pptUrl = pptUrlData.publicUrl;
        pptName = pptFile.name;
      }

      // Calculate attempt number
      const attemptNumber = submissions.length + 1;

      // Insert submission
      const { error: insertError } = await (supabase.from("submissions") as any)
        .insert({
          assignment_id: assignmentId,
          student_email: userEmail,
          team_members: teamMembers.trim(),
          abstract: abstract.trim(),
          github_link: githubLink.trim() || null,
          report_url: reportUrlData.publicUrl,
          report_name: reportFile.name,
          code_zip_url: codeUrlData.publicUrl,
          code_zip_name: codeZipFile.name,
          ppt_url: pptUrl,
          ppt_name: pptName,
          attempt: attemptNumber,
          status: "submitted",
          file_url: reportUrlData.publicUrl,
          file_name: reportFile.name,
        });

      if (insertError) {
        throw new Error("Failed to submit: " + insertError.message);
      }

      // Notify faculty
      await (supabase.from("assignment_notifications") as any).insert({
        user_email: assignment.created_by_email,
        message: `${userEmail} submitted a project for ${assignment.title}`,
        link: `/assignments/${assignmentId}`,
        is_read: false,
      });

      // Reset form and reload data
      setTeamMembers("");
      setAbstract("");
      setGithubLink("");
      setReportFile(null);
      setCodeZipFile(null);
      setPptFile(null);
      await fetchData();
    } catch (err: any) {
      console.error("Project submit error:", err);
      setSubmitError(err.message || "Failed to submit project");
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
      setCustomTestExpanded(null);
      setCustomResult(null);
      setCustomInput("");
    } else {
      setExpandedRow(email);
      setCustomTestExpanded(null);
      setCustomResult(null);
      setCustomInput("");

      // For code assignments, pre-fill with suggested marks if marks is empty
      if (
        assignment?.type === "code" &&
        submission &&
        (submission.marks === null || submission.marks === undefined) &&
        !submission.compile_error &&
        submission.tests_passed !== null &&
        submission.tests_passed !== undefined &&
        submission.tests_total !== null &&
        submission.tests_total !== undefined &&
        submission.tests_total > 0
      ) {
        const suggestedMarks = Math.round(
          (submission.tests_passed / submission.tests_total) * assignment.max_marks
        );
        setGradingMarks(suggestedMarks);
      } else {
        setGradingMarks(submission?.marks ?? 0);
      }

      setGradingFeedback(submission?.feedback ?? "");
      setGradingError(null);
    }
  };

  const handleRerunTests = async (submissionId: string) => {
    if (!assignment || !assignment.language_id) return;

    setRerunning(submissionId);
    setGradingError(null);

    try {
      const supabase = createBrowserClient();

      // Fetch test cases
      const { data: testCasesData } = await supabase
        .from("test_cases")
        .select("*")
        .eq("assignment_id", assignmentId)
        .order("sort_order", { ascending: true });

      const cases = (testCasesData ?? []) as TestCase[];

      // Get submission code
      const sub = studentsWithSubmissions
        .flatMap((s) => (s.latestSubmission ? [s.latestSubmission] : []))
        .find((s) => s.id === submissionId);

      if (!sub || !sub.code_text) {
        throw new Error("No code found for this submission");
      }

      // Run tests
      const response = await fetch("/api/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_code: sub.code_text,
          language_id: assignment.language_id,
          assignment_id: assignmentId,
          test_cases: cases.map((tc) => ({
            input: tc.input,
            expected_output: tc.expected_output,
          })),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to run tests");
      }

      const result = await response.json();

      // Update submission in database
      const { error: updateError } = await (supabase.from("submissions") as any)
        .update({
          tests_passed: result.passed,
          tests_total: result.total,
          test_results: result.results,
          compile_error: result.compile_error,
          max_time: result.max_time,
          max_memory: result.max_memory,
        })
        .eq("id", submissionId);

      if (updateError) {
        throw new Error("Failed to update submission: " + updateError.message);
      }

      // Refresh data
      await fetchData();

      // Update suggested marks if applicable
      if (
        result.compile_error === null &&
        result.passed !== null &&
        result.total > 0
      ) {
        const suggestedMarks = Math.round(
          (result.passed / result.total) * assignment.max_marks
        );
        setGradingMarks(suggestedMarks);
      }
    } catch (err: any) {
      console.error("Rerun error:", err);
      setGradingError(err.message || "Failed to rerun tests");
    } finally {
      setRerunning(null);
    }
  };

  const handleCustomTest = async (submissionId: string) => {
    if (!assignment || !assignment.language_id) return;

    setCustomRunning(true);
    setGradingError(null);

    try {
      // Get submission code
      const sub = studentsWithSubmissions
        .flatMap((s) => (s.latestSubmission ? [s.latestSubmission] : []))
        .find((s) => s.id === submissionId);

      if (!sub || !sub.code_text) {
        throw new Error("No code found for this submission");
      }

      // Run with custom input
      const response = await fetch("/api/run-code", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          source_code: sub.code_text,
          language_id: assignment.language_id,
          assignment_id: assignmentId,
          test_cases: [
            {
              input: customInput,
              expected_output: "",
            },
          ],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to run code");
      }

      const result = await response.json();
      setCustomResult(result);
    } catch (err: any) {
      console.error("Custom test error:", err);
      setGradingError(err.message || "Failed to run custom test");
    } finally {
      setCustomRunning(false);
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

          {/* Project Submissions (Panel View) */}
          {assignment.type === "project" ? (
            <div className="space-y-4 mb-6">
              {studentsWithSubmissions.map((student) => {
                const sub = student.latestSubmission;
                const isExpanded = expandedRow === student.email;

                if (!sub) return null;

                const teamMembersList = (sub.team_members || "").split("\n").filter((line) => line.trim());

                return (
                  <div key={student.email} className="card">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <h3 className="text-base font-semibold text-college-secondary font-poppins">
                          {student.full_name || student.email}
                        </h3>
                        <p className="text-xs text-gray-500 font-poppins">{student.email}</p>
                        <div className="flex items-center gap-3 mt-2">
                          <span
                            className={`text-xs font-semibold px-3 py-1 rounded-full ${getStatusBadgeClass(
                              sub.status
                            )}`}
                          >
                            {sub.status}
                          </span>
                          <span className="text-xs text-gray-500 font-poppins">
                            Submitted: {formatDateTime(sub.submitted_at)}
                          </span>
                          {sub.marks !== null && sub.marks !== undefined && (
                            <span className="text-xs font-semibold text-college-accent font-poppins">
                              {sub.marks}/{assignment.max_marks}
                            </span>
                          )}
                        </div>
                      </div>
                      <button
                        onClick={() => toggleRow(student.email, sub)}
                        className="text-college-secondary text-sm font-poppins hover:underline"
                      >
                        {isExpanded ? "Close" : "Grade"}
                      </button>
                    </div>

                    {/* Team Members */}
                    {teamMembersList.length > 0 && (
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-gray-700 font-poppins mb-1">
                          Team Members:
                        </h4>
                        <ul className="list-disc list-inside text-sm text-gray-600 font-poppins space-y-0.5">
                          {teamMembersList.map((member, idx) => (
                            <li key={idx}>{member}</li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Abstract */}
                    {sub.abstract && (
                      <div className="mb-3">
                        <h4 className="text-xs font-semibold text-gray-700 font-poppins mb-1">
                          Abstract:
                        </h4>
                        <p className="text-sm text-gray-600 font-poppins whitespace-pre-wrap">
                          {sub.abstract}
                        </p>
                      </div>
                    )}

                    {/* GitHub Link */}
                    {sub.github_link && (
                      <div className="mb-3">
                        <a
                          href={sub.github_link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-gray-800 text-white px-4 py-2 rounded-lg font-poppins text-sm hover:bg-gray-900 transition-colors"
                        >
                          🔗 Open GitHub / Demo Link
                        </a>
                      </div>
                    )}

                    {/* File Links */}
                    <div className="flex flex-wrap gap-2 mb-3">
                      {sub.report_url && (
                        <a
                          href={sub.report_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-blue-500 text-white px-4 py-2 rounded-lg font-poppins text-sm hover:bg-blue-600 transition-colors"
                        >
                          📄 Report
                        </a>
                      )}
                      {sub.code_zip_url && (
                        <a
                          href={sub.code_zip_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-green-500 text-white px-4 py-2 rounded-lg font-poppins text-sm hover:bg-green-600 transition-colors"
                        >
                          📦 Code (ZIP)
                        </a>
                      )}
                      {sub.ppt_url && (
                        <a
                          href={sub.ppt_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-block bg-orange-500 text-white px-4 py-2 rounded-lg font-poppins text-sm hover:bg-orange-600 transition-colors"
                        >
                          📊 Presentation
                        </a>
                      )}
                    </div>

                    {/* Grading Form (Expanded) */}
                    {isExpanded && (
                      <div className="border-t border-gray-200 pt-4 mt-4">
                        <h4 className="text-sm font-semibold text-college-accent font-poppins mb-3">
                          Grade Submission
                        </h4>
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
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            /* Submissions Table (Document/Code/Link) */
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
                      {assignment.type === "code" && (
                        <th className="table-header">Auto Result</th>
                      )}
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
                          {assignment.type === "code" && (
                            <td className="px-4 py-3 text-sm font-poppins">
                              {sub ? (
                                sub.compile_error ? (
                                  <span className="text-red-600 font-semibold">
                                    Compile error
                                  </span>
                                ) : sub.tests_passed !== null &&
                                  sub.tests_total !== null ? (
                                  <span
                                    className={
                                      sub.tests_passed === sub.tests_total
                                        ? "text-green-600 font-semibold"
                                        : sub.tests_passed === 0
                                        ? "text-red-600 font-semibold"
                                        : "text-orange-600 font-semibold"
                                    }
                                  >
                                    {sub.tests_passed}/{sub.tests_total} tests
                                  </span>
                                ) : (
                                  "—"
                                )
                              ) : (
                                <span className="text-gray-400 text-sm">—</span>
                              )}
                            </td>
                          )}
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
                            <td
                              colSpan={assignment.type === "code" ? 8 : 7}
                              className="px-4 py-4 bg-college-peach"
                            >
                              <div className="max-w-4xl">
                                <h3 className="text-sm font-semibold text-college-accent font-poppins mb-3">
                                  Grade Submission
                                </h3>

                                {/* Code Display (Code Assignments Only) */}
                                {assignment.type === "code" && sub.code_text && (
                                  <div className="mb-4">
                                    <h4 className="text-xs font-semibold text-gray-700 font-poppins mb-2">
                                      Submitted Code
                                    </h4>
                                    <pre className="text-xs font-mono bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto max-h-64 overflow-y-auto">
                                      {sub.code_text}
                                    </pre>
                                  </div>
                                )}

                                {/* Test Results (Code Assignments Only) */}
                                {assignment.type === "code" && (
                                  <div className="mb-4">
                                    <h4 className="text-xs font-semibold text-gray-700 font-poppins mb-2">
                                      Auto-Grading Result
                                    </h4>
                                    {sub.compile_error ? (
                                      <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                                        <p className="text-xs font-semibold text-red-700 font-poppins mb-1">
                                          Compilation Error
                                        </p>
                                        <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap overflow-x-auto">
                                          {sub.compile_error}
                                        </pre>
                                      </div>
                                    ) : (
                                      <>
                                        <div className="grid grid-cols-3 gap-3 mb-3">
                                          <div className="text-center p-2 bg-blue-50 rounded">
                                            <p className="text-xs text-gray-600 font-poppins">
                                              Tests Passed
                                            </p>
                                            <p className="text-lg font-bold text-college-secondary font-poppins">
                                              {sub.tests_passed} / {sub.tests_total}
                                            </p>
                                          </div>
                                          <div className="text-center p-2 bg-green-50 rounded">
                                            <p className="text-xs text-gray-600 font-poppins">
                                              Max Time
                                            </p>
                                            <p className="text-lg font-bold text-green-600 font-poppins">
                                              {sub.max_time?.toFixed(3)} s
                                            </p>
                                          </div>
                                          <div className="text-center p-2 bg-purple-50 rounded">
                                            <p className="text-xs text-gray-600 font-poppins">
                                              Max Memory
                                            </p>
                                            <p className="text-lg font-bold text-purple-600 font-poppins">
                                              {sub.max_memory} KB
                                            </p>
                                          </div>
                                        </div>

                                        {sub.test_results &&
                                          sub.test_results.length > 0 && (
                                            <div className="overflow-x-auto max-h-48 overflow-y-auto border border-gray-300 rounded">
                                              <table className="w-full text-xs">
                                                <thead className="bg-gray-100 sticky top-0">
                                                  <tr>
                                                    <th className="px-2 py-1 text-left">#</th>
                                                    <th className="px-2 py-1 text-left">
                                                      Status
                                                    </th>
                                                    <th className="px-2 py-1 text-left">
                                                      Expected
                                                    </th>
                                                    <th className="px-2 py-1 text-left">
                                                      Actual
                                                    </th>
                                                    <th className="px-2 py-1 text-left">
                                                      Error
                                                    </th>
                                                    <th className="px-2 py-1 text-left">
                                                      Time
                                                    </th>
                                                    <th className="px-2 py-1 text-left">
                                                      Memory
                                                    </th>
                                                  </tr>
                                                </thead>
                                                <tbody>
                                                  {sub.test_results.map(
                                                    (result: TestResult) => (
                                                      <tr
                                                        key={result.index}
                                                        className="border-t"
                                                      >
                                                        <td className="px-2 py-1 font-semibold">
                                                          {result.index + 1}
                                                        </td>
                                                        <td className="px-2 py-1">
                                                          <span
                                                            className={`text-xs px-2 py-0.5 rounded ${
                                                              result.passed
                                                                ? "bg-green-100 text-green-700"
                                                                : "bg-red-100 text-red-700"
                                                            }`}
                                                          >
                                                            {result.status}
                                                          </span>
                                                        </td>
                                                        <td className="px-2 py-1">
                                                          <pre className="font-mono text-xs max-w-xs overflow-x-auto">
                                                            {result.expected || "—"}
                                                          </pre>
                                                        </td>
                                                        <td className="px-2 py-1">
                                                          <pre className="font-mono text-xs max-w-xs overflow-x-auto">
                                                            {result.actual || "—"}
                                                          </pre>
                                                        </td>
                                                        <td className="px-2 py-1">
                                                          <pre className="font-mono text-xs text-red-600 max-w-xs overflow-x-auto">
                                                            {result.error || "—"}
                                                          </pre>
                                                        </td>
                                                        <td className="px-2 py-1">
                                                          {result.time?.toFixed(3)}s
                                                        </td>
                                                        <td className="px-2 py-1">
                                                          {result.memory}KB
                                                        </td>
                                                      </tr>
                                                    )
                                                  )}
                                                </tbody>
                                              </table>
                                            </div>
                                          )}
                                      </>
                                    )}
                                  </div>
                                )}

                                {/* Re-run Test Cases and Custom Test - Code Assignments Only */}
                                {assignment.type === "code" && sub.code_text && (
                                  <div className="mb-4 space-y-3">
                                    {/* Re-run Test Cases Button */}
                                    <div>
                                      <button
                                        onClick={() => handleRerunTests(sub.id)}
                                        disabled={rerunning === sub.id}
                                        className="bg-blue-500 text-white px-4 py-2 rounded-lg font-poppins font-semibold text-sm hover:bg-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                      >
                                        {rerunning === sub.id ? "Running..." : "🔄 Re-run Test Cases"}
                                      </button>
                                    </div>

                                    {/* Custom Test Panel */}
                                    <div>
                                      <button
                                        onClick={() => {
                                          setCustomTestExpanded(
                                            customTestExpanded === sub.id ? null : sub.id
                                          );
                                          setCustomResult(null);
                                          setCustomInput("");
                                        }}
                                        className="text-sm text-college-secondary hover:text-college-accent font-poppins font-medium"
                                      >
                                        {customTestExpanded === sub.id ? "− Hide Custom Input" : "+ Run Custom Input"}
                                      </button>

                                      {customTestExpanded === sub.id && (
                                        <div className="mt-3 border-2 border-gray-200 rounded-lg p-4 bg-gray-50">
                                          <div className="mb-3">
                                            <label className="block text-xs font-medium text-gray-700 font-poppins mb-1">
                                              Custom Input (stdin)
                                            </label>
                                            <textarea
                                              value={customInput}
                                              onChange={(e) => setCustomInput(e.target.value)}
                                              placeholder="Enter custom input for testing..."
                                              className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg font-mono text-sm focus:outline-none focus:border-college-secondary resize-none"
                                              rows={4}
                                            />
                                          </div>

                                          <button
                                            onClick={() => handleCustomTest(sub.id)}
                                            disabled={customRunning}
                                            className="bg-purple-500 text-white px-4 py-2 rounded-lg font-poppins font-semibold text-sm hover:bg-purple-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                                          >
                                            {customRunning ? "Running..." : "▶ Run"}
                                          </button>

                                          {customResult && (
                                            <div className="mt-4 space-y-3">
                                              {customResult.compile_error ? (
                                                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                                                  <p className="text-xs font-semibold text-red-700 font-poppins mb-1">
                                                    Compilation Error
                                                  </p>
                                                  <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap overflow-x-auto">
                                                    {customResult.compile_error}
                                                  </pre>
                                                </div>
                                              ) : (
                                                <>
                                                  {customResult.results && customResult.results[0] && (
                                                    <>
                                                      {/* Output */}
                                                      <div>
                                                        <label className="block text-xs font-semibold text-gray-700 font-poppins mb-1">
                                                          Output:
                                                        </label>
                                                        <pre className="text-xs font-mono bg-white border-2 border-gray-300 p-3 rounded-lg overflow-x-auto max-h-40 overflow-y-auto">
                                                          {customResult.results[0].actual || "(no output)"}
                                                        </pre>
                                                      </div>

                                                      {/* Errors (only if non-empty) */}
                                                      {customResult.results[0].error && (
                                                        <div>
                                                          <label className="block text-xs font-semibold text-red-700 font-poppins mb-1">
                                                            Errors:
                                                          </label>
                                                          <pre className="text-xs font-mono bg-red-50 border-2 border-red-300 text-red-600 p-3 rounded-lg overflow-x-auto max-h-40 overflow-y-auto">
                                                            {customResult.results[0].error}
                                                          </pre>
                                                        </div>
                                                      )}

                                                      {/* Time and Memory */}
                                                      <div className="flex gap-4">
                                                        <div className="flex-1 bg-green-50 border border-green-300 rounded p-2">
                                                          <p className="text-xs text-gray-600 font-poppins">
                                                            Time: <span className="font-semibold text-green-700">{customResult.results[0].time?.toFixed(3)} s</span>
                                                          </p>
                                                        </div>
                                                        <div className="flex-1 bg-purple-50 border border-purple-300 rounded p-2">
                                                          <p className="text-xs text-gray-600 font-poppins">
                                                            Memory: <span className="font-semibold text-purple-700">{customResult.results[0].memory} KB</span>
                                                          </p>
                                                        </div>
                                                      </div>
                                                    </>
                                                  )}
                                                </>
                                              )}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}

                                {/* Suggested Marks (Code Assignments Only) */}
                                {assignment.type === "code" &&
                                  !sub.compile_error &&
                                  sub.tests_passed !== null &&
                                  sub.tests_passed !== undefined &&
                                  sub.tests_total !== null &&
                                  sub.tests_total !== undefined &&
                                  sub.tests_total > 0 && (
                                    <div className="mb-4">
                                      <p className="text-xs text-blue-600 font-poppins font-semibold">
                                        Suggested marks:{" "}
                                        {Math.round(
                                          (sub.tests_passed / sub.tests_total) *
                                            assignment.max_marks
                                        )}{" "}
                                        / {assignment.max_marks}
                                      </p>
                                    </div>
                                  )}

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
          )}

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

          {/* Project Category Display */}
          {assignment.type === "project" && assignment.project_category && (
            <div className="mb-4 pb-4 border-b border-college-peach">
              <span className="text-xs text-gray-500 font-poppins">Project Category:</span>
              <p className="text-base font-bold text-college-accent font-poppins mt-1">
                {PROJECT_CATEGORIES.find(cat => cat.id === assignment.project_category)?.label || assignment.project_category}
              </p>
            </div>
          )}

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

          {/* Code Assignment Info */}
          {assignment.type === "code" && assignment.language_name && (
            <div className="border-t border-college-peach pt-4 mb-4">
              <div className="flex items-center gap-4">
                <div>
                  <span className="text-xs text-gray-500 font-poppins">Language:</span>
                  <p className="text-sm font-semibold text-college-secondary font-poppins">
                    {assignment.language_name}
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-poppins">Grading:</span>
                  <p className="text-sm font-semibold text-green-600 font-poppins">
                    Auto-graded with test cases
                  </p>
                </div>
                <div>
                  <span className="text-xs text-gray-500 font-poppins">Test Cases:</span>
                  <p className="text-sm font-semibold text-college-accent font-poppins">
                    {testCases.length} test cases
                  </p>
                </div>
              </div>
            </div>
          )}

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
                    {assignment.type !== "project" && (
                      <th className="table-header">File</th>
                    )}
                    {assignment.type === "project" && (
                      <>
                        <th className="table-header">Report</th>
                        <th className="table-header">Code</th>
                        <th className="table-header">PPT</th>
                      </>
                    )}
                    <th className="table-header">Submitted At</th>
                    <th className="table-header">Status</th>
                    {assignment.type === "code" && (
                      <th className="table-header">Tests</th>
                    )}
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
                      {assignment.type !== "project" && (
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
                      )}
                      {assignment.type === "project" && (
                        <>
                          <td className="px-4 py-3">
                            {submission.report_url ? (
                              <a
                                href={submission.report_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-college-secondary text-sm font-poppins hover:underline"
                              >
                                📄 {submission.report_name}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {submission.code_zip_url ? (
                              <a
                                href={submission.code_zip_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-college-secondary text-sm font-poppins hover:underline"
                              >
                                📦 {submission.code_zip_name}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {submission.ppt_url ? (
                              <a
                                href={submission.ppt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="text-college-secondary text-sm font-poppins hover:underline"
                              >
                                📊 {submission.ppt_name}
                              </a>
                            ) : (
                              "—"
                            )}
                          </td>
                        </>
                      )}
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
                      {assignment.type === "code" && (
                        <td className="px-4 py-3 text-sm font-poppins">
                          {submission.tests_passed !== null &&
                          submission.tests_total !== null ? (
                            <span
                              className={
                                submission.tests_passed === submission.tests_total
                                  ? "text-green-600 font-semibold"
                                  : "text-orange-600 font-semibold"
                              }
                            >
                              {submission.tests_passed}/{submission.tests_total}
                            </span>
                          ) : (
                            "—"
                          )}
                        </td>
                      )}
                      <td className="px-4 py-3 text-sm text-gray-600 font-poppins">
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

        {/* Latest Submission Result (Code Assignment) */}
        {assignment.type === "code" && submissions.length > 0 && (
          <div className="card mb-6">
            <h2 className="section-heading mb-4">Latest Submission Result</h2>
            {submissions[0].compile_error ? (
              <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-red-700 font-poppins mb-2">
                  Compilation Error
                </h3>
                <pre className="text-xs text-red-600 font-mono whitespace-pre-wrap overflow-x-auto">
                  {submissions[0].compile_error}
                </pre>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-3 gap-4 mb-4">
                  <div className="text-center p-3 bg-blue-50 rounded-lg">
                    <p className="text-xs text-gray-600 font-poppins mb-1">
                      Tests Passed
                    </p>
                    <p className="text-2xl font-bold text-college-secondary font-poppins">
                      {submissions[0].tests_passed} / {submissions[0].tests_total}
                    </p>
                  </div>
                  <div className="text-center p-3 bg-green-50 rounded-lg">
                    <p className="text-xs text-gray-600 font-poppins mb-1">
                      Max Time
                    </p>
                    <p className="text-2xl font-bold text-green-600 font-poppins">
                      {submissions[0].max_time?.toFixed(3)} s
                    </p>
                  </div>
                  <div className="text-center p-3 bg-purple-50 rounded-lg">
                    <p className="text-xs text-gray-600 font-poppins mb-1">
                      Max Memory
                    </p>
                    <p className="text-2xl font-bold text-purple-600 font-poppins">
                      {submissions[0].max_memory} KB
                    </p>
                  </div>
                </div>

                {submissions[0].test_results &&
                  submissions[0].test_results.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="table-header">#</th>
                            <th className="table-header">Status</th>
                            <th className="table-header">Expected</th>
                            <th className="table-header">Actual</th>
                            <th className="table-header">Error</th>
                            <th className="table-header">Time (s)</th>
                            <th className="table-header">Memory (KB)</th>
                            <th className="table-header">Match Info</th>
                          </tr>
                        </thead>
                        <tbody>
                          {submissions[0].test_results.map((result: TestResult) => (
                            <tr key={result.index} className="table-row">
                              <td className="px-4 py-3 text-sm font-semibold text-college-text font-poppins">
                                {result.index + 1}
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`text-xs font-semibold px-3 py-1 rounded-full ${
                                    result.passed
                                      ? "bg-green-100 text-green-700"
                                      : "bg-red-100 text-red-700"
                                  }`}
                                >
                                  {result.status}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <pre className="text-xs font-mono text-gray-700 max-w-xs overflow-x-auto">
                                  {result.expected || "—"}
                                </pre>
                              </td>
                              <td className="px-4 py-3">
                                <pre className="text-xs font-mono text-gray-700 max-w-xs overflow-x-auto">
                                  {result.actual || "—"}
                                </pre>
                              </td>
                              <td className="px-4 py-3">
                                <pre className="text-xs font-mono text-red-600 max-w-xs overflow-x-auto">
                                  {result.error || "—"}
                                </pre>
                              </td>
                              <td className="px-4 py-3 text-sm font-poppins text-gray-600">
                                {result.time?.toFixed(3)}
                              </td>
                              <td className="px-4 py-3 text-sm font-poppins text-gray-600">
                                {result.memory}
                              </td>
                              <td className="px-4 py-3 text-xs text-gray-500 font-poppins">
                                {result.match_reason ?? '—'}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
              </>
            )}
          </div>
        )}

        {/* Submit Form or Message */}
        {canSubmit() ? (
          <div className="card">
            <h2 className="section-heading mb-4">
              {submissions.length > 0 ? "Resubmit Assignment" : "Submit Assignment"}
            </h2>
            
            {/* Link Assignment UI */}
            {assignment.type === "link" && assignment.submission_link ? (
              <div className="space-y-4">
                {/* Link Info Card */}
                <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-4">
                  <div className="flex items-start gap-3">
                    <div className="text-3xl">🔗</div>
                    <div className="flex-1">
                      <h3 className="text-sm font-semibold text-college-secondary font-poppins mb-1">
                        {detectLinkType(assignment.submission_link).label}
                      </h3>
                      <p className="text-xs text-gray-600 font-poppins mb-3">
                        {assignment.submission_link_type === "google_form" 
                          ? "Complete this Google Form to submit your assignment"
                          : assignment.submission_link_type === "google_drive"
                          ? "Access the shared Google Drive link"
                          : "Open the external link to complete your assignment"
                        }
                      </p>
                      <a
                        href={assignment.submission_link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-college-secondary font-poppins hover:underline break-all"
                      >
                        {assignment.submission_link}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Action Button */}
                {!hasOpened && (
                  <button
                    onClick={async () => {
                      try {
                        setLinkSubmitting(true);
                        setSubmitError(null);
                        
                        // Track link opening
                        const response = await fetch(`/api/assignments/${assignmentId}/open-link`, {
                          method: "POST",
                          headers: { "Content-Type": "application/json" },
                        });

                        if (!response.ok) {
                          const errorData = await response.json();
                          throw new Error(errorData.message || "Failed to track link opening");
                        }

                        // Open link in new tab
                        window.open(assignment.submission_link!, "_blank");
                        
                        // Update state
                        setHasOpened(true);
                        
                        // Refresh data
                        await fetchData();
                      } catch (err: any) {
                        console.error("Error opening link:", err);
                        setSubmitError(err.message || "Failed to open link");
                      } finally {
                        setLinkSubmitting(false);
                      }
                    }}
                    disabled={linkSubmitting}
                    className="w-full bg-college-secondary text-white px-6 py-4 rounded-lg font-poppins font-semibold text-base hover:bg-college-accent transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {linkSubmitting ? "Opening..." : detectLinkType(assignment.submission_link).buttonText}
                  </button>
                )}

                {/* Success Box After Opening */}
                {hasOpened && !isSubmitted && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4 space-y-3">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">✅</div>
                      <div className="flex-1">
                        <h3 className="text-sm font-semibold text-green-700 font-poppins mb-1">
                          Link Opened Successfully
                        </h3>
                        <p className="text-xs text-gray-600 font-poppins">
                          {assignment.submission_link_type === "google_form"
                            ? "After submitting the form, click the button below to notify your teacher."
                            : "After completing your work, click the button below to mark as submitted."
                          }
                        </p>
                      </div>
                    </div>
                    
                    <button
                      onClick={async () => {
                        try {
                          setLinkSubmitting(true);
                          setSubmitError(null);
                          
                          const response = await fetch(`/api/assignments/${assignmentId}/mark-submitted`, {
                            method: "POST",
                            headers: { "Content-Type": "application/json" },
                          });

                          if (!response.ok) {
                            const errorData = await response.json();
                            throw new Error(errorData.message || "Failed to mark as submitted");
                          }

                          // Update state
                          setIsSubmitted(true);
                          
                          // Refresh data
                          await fetchData();
                        } catch (err: any) {
                          console.error("Error marking as submitted:", err);
                          setSubmitError(err.message || "Failed to mark as submitted");
                        } finally {
                          setLinkSubmitting(false);
                        }
                      }}
                      disabled={linkSubmitting}
                      className="w-full bg-green-600 text-white px-6 py-3 rounded-lg font-poppins font-semibold hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {linkSubmitting ? "Submitting..." : "Mark as Submitted"}
                    </button>
                  </div>
                )}

                {/* Already Submitted Message */}
                {isSubmitted && (
                  <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                    <div className="flex items-start gap-3">
                      <div className="text-2xl">🎉</div>
                      <div>
                        <h3 className="text-sm font-semibold text-green-700 font-poppins mb-1">
                          Assignment Submitted
                        </h3>
                        <p className="text-xs text-gray-600 font-poppins">
                          Your teacher has been notified of your submission.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* Error Message */}
                {submitError && (
                  <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                    <p className="text-sm text-red-700 font-poppins">{submitError}</p>
                  </div>
                )}

                {/* Helper Text for Google Forms */}
                {assignment.submission_link_type === "google_form" && hasOpened && !isSubmitted && (
                  <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-3">
                    <div className="flex items-start gap-2">
                      <div className="text-lg">💡</div>
                      <p className="text-xs text-gray-700 font-poppins">
                        <strong>Note:</strong> After submitting the form, click "Mark as Submitted" to notify your teacher.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : assignment.type === "project" ? (
              /* Project Submission Form */
              <form onSubmit={handleProjectSubmit}>
                <div className="space-y-4">
                  {/* Team Members */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                      Team Members <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={teamMembers}
                      onChange={(e) => setTeamMembers(e.target.value)}
                      placeholder="Enter team member names and roll numbers (one per line)&#10;Example:&#10;John Doe - 12345&#10;Jane Smith - 12346"
                      className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary resize-none"
                      rows={4}
                      required
                    />
                  </div>

                  {/* Abstract */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                      Abstract / Project Description <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      value={abstract}
                      onChange={(e) => setAbstract(e.target.value)}
                      placeholder="Provide a brief description of your project, objectives, and key features"
                      className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary resize-none"
                      rows={6}
                      required
                    />
                  </div>

                  {/* GitHub Link */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                      GitHub / Live Demo Link (Optional)
                    </label>
                    <input
                      type="text"
                      value={githubLink}
                      onChange={(e) => setGithubLink(e.target.value)}
                      placeholder="https://github.com/username/project or https://demo-link.com"
                      className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
                    />
                  </div>

                  {/* Project Report */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                      Project Report <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setReportFile(e.target.files?.[0] || null)}
                      accept=".pdf,.doc,.docx"
                      className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
                      required
                    />
                    {reportFile && (
                      <p className="text-xs text-gray-500 font-poppins mt-2">
                        Selected: {reportFile.name}
                      </p>
                    )}
                  </div>

                  {/* Code ZIP */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                      Code (ZIP) <span className="text-red-500">*</span>
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setCodeZipFile(e.target.files?.[0] || null)}
                      accept=".zip,.rar"
                      className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
                      required
                    />
                    {codeZipFile && (
                      <p className="text-xs text-gray-500 font-poppins mt-2">
                        Selected: {codeZipFile.name}
                      </p>
                    )}
                  </div>

                  {/* Presentation */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                      Presentation (Optional)
                    </label>
                    <input
                      type="file"
                      onChange={(e) => setPptFile(e.target.files?.[0] || null)}
                      accept=".ppt,.pptx,.pdf"
                      className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
                    />
                    {pptFile && (
                      <p className="text-xs text-gray-500 font-poppins mt-2">
                        Selected: {pptFile.name}
                      </p>
                    )}
                  </div>

                  {submitError && (
                    <div className="bg-red-50 border-2 border-red-300 rounded-lg p-3">
                      <p className="text-red-700 text-sm font-poppins">{submitError}</p>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="btn-primary"
                  >
                    {submitting ? "Submitting..." : "Submit Project"}
                  </button>
                </div>
              </form>
            ) : (
              /* Regular File Upload Form for Code/Document Assignments */
              <form onSubmit={handleSubmit}>
                <div className="mb-4">
                  <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                    Upload File{" "}
                    {assignment.type === "code" &&
                      assignment.language_name &&
                      LANGUAGES.find((l) => l.id === assignment.language_id)?.ext && (
                        <span className="text-xs text-gray-500">
                          (
                          {
                            LANGUAGES.find((l) => l.id === assignment.language_id)
                              ?.ext
                          }{" "}
                          file)
                        </span>
                      )}{" "}
                    <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="file"
                    onChange={(e) => setFile(e.target.files?.[0] || null)}
                    accept={
                      assignment.type === "code" && assignment.language_id
                        ? LANGUAGES.find((l) => l.id === assignment.language_id)?.ext
                        : ".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,.zip,.py,.java,.js,.c,.cpp,.txt"
                    }
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

                <button
                  type="submit"
                  disabled={submitting || runningTests}
                  className="btn-primary"
                >
                  {runningTests
                    ? "Running tests..."
                    : submitting
                    ? "Submitting..."
                    : assignment.type === "code"
                    ? "Run & Submit"
                    : "Submit Assignment"}
                </button>
              </form>
            )}
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
