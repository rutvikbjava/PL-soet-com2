"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { LANGUAGES } from "@/lib/languages";
import { detectLinkType, isValidUrl } from "@/lib/link-detector";
import Navbar from "@/components/Navbar";

interface TestCase {
  input: string;
  expected_output: string;
}

export default function NewAssignmentPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [section, setSection] = useState("");
  const [deadline, setDeadline] = useState("");
  const [maxMarks, setMaxMarks] = useState(100);
  const [file, setFile] = useState<File | null>(null);

  // Code assignment fields
  const [assignmentType, setAssignmentType] = useState<"document" | "code" | "link">("document");
  const [languageId, setLanguageId] = useState<number>(103); // Default to C
  const [smartGrading, setSmartGrading] = useState(true);
  const [testCases, setTestCases] = useState<TestCase[]>([
    { input: "", expected_output: "" },
    { input: "", expected_output: "" },
  ]);
  
  // Link assignment fields
  const [submissionLink, setSubmissionLink] = useState("");

  useEffect(() => {
    const checkAuth = async () => {
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

        // Redirect if not faculty
        if (role !== "faculty") {
          router.push("/assignments");
          return;
        }

        setLoading(false);
      } catch (err: any) {
        console.error("Auth check error:", err);
        setError(err.message || "An unexpected error occurred.");
        setLoading(false);
      }
    };

    checkAuth();
  }, [router]);

  const addTestCase = () => {
    setTestCases([...testCases, { input: "", expected_output: "" }]);
  };

  const removeTestCase = (index: number) => {
    if (testCases.length > 1) {
      setTestCases(testCases.filter((_, i) => i !== index));
    }
  };

  const updateTestCase = (
    index: number,
    field: "input" | "expected_output",
    value: string
  ) => {
    const updated = [...testCases];
    updated[index][field] = value;
    setTestCases(updated);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !section.trim() || !deadline) {
      setError("Please fill in all required fields");
      return;
    }

    // Validate code assignments have at least one non-empty test case
    if (assignmentType === "code") {
      const nonEmptyTests = testCases.filter(
        (tc) => tc.input.trim() || tc.expected_output.trim()
      );
      if (nonEmptyTests.length === 0) {
        setError("Code assignments must have at least one test case");
        return;
      }
    }

    setSubmitting(true);
    setError(null);

    try {
      const supabase = createBrowserClient();

      let attachmentUrl: string | null = null;
      let attachmentName: string | null = null;

      // Upload file if provided
      if (file) {
        const timestamp = Date.now();
        const fileName = `${timestamp}-${file.name}`;
        const filePath = `instructions/${fileName}`;

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

        attachmentUrl = publicUrlData.publicUrl;
        attachmentName = file.name;
      }

      // Get language name if code assignment
      const selectedLanguage = LANGUAGES.find((lang) => lang.id === languageId);
      const languageName = selectedLanguage ? selectedLanguage.name : null;

      // Detect submission link type for link assignments
      let submissionLinkType = null;
      if (assignmentType === "link" && submissionLink && isValidUrl(submissionLink)) {
        submissionLinkType = detectLinkType(submissionLink).type;
      }

      // Insert assignment
      const { data: assignmentData, error: insertError } = await (
        supabase.from("assignments") as any
      )
        .insert({
          title: title.trim(),
          description: description.trim(),
          section: section.trim(),
          deadline,
          max_marks: maxMarks,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
          created_by_email: userEmail,
          type: assignmentType,
          language_id: assignmentType === "code" ? languageId : null,
          language_name: assignmentType === "code" ? languageName : null,
          smart_grading: assignmentType === "code" ? smartGrading : null,
          submission_link: assignmentType === "link" ? submissionLink : null,
          submission_link_type: assignmentType === "link" ? submissionLinkType : null,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error("Failed to create assignment: " + insertError.message);
      }

      const assignmentId = (assignmentData as any)?.id;

      // Insert test cases for code assignments
      if (assignmentType === "code") {
        const nonEmptyTests = testCases.filter(
          (tc) => tc.input.trim() || tc.expected_output.trim()
        );

        if (nonEmptyTests.length > 0) {
          const testCaseRecords = nonEmptyTests.map((tc, index) => ({
            assignment_id: assignmentId,
            input: tc.input,
            expected_output: tc.expected_output,
            sort_order: index,
          }));

          const { error: testCaseError } = await (
            supabase.from("test_cases") as any
          ).insert(testCaseRecords);

          if (testCaseError) {
            console.error("Failed to insert test cases:", testCaseError);
            // Don't fail the whole operation, just log the error
          }
        }
      }

      // Fetch all students in the section
      const { data: studentsData } = await supabase
        .from("users")
        .select("email")
        .eq("role", "student")
        .eq("section", section.trim());

      const students = (studentsData ?? []) as { email: string }[];

      // Create notifications for each student
      if (students.length > 0) {
        const notifications = students.map((student) => ({
          user_email: student.email,
          message: `New assignment: ${title.trim()}`,
          link: `/assignments/${assignmentId}`,
          is_read: false,
        }));

        await (supabase.from("assignment_notifications") as any).insert(
          notifications
        );
      }

      // Redirect to assignments page
      router.push("/assignments");
    } catch (err: any) {
      console.error("Create assignment error:", err);
      setError(err.message || "Failed to create assignment");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading...</p>
      </div>
    );
  }

  if (error && !submitting) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <div className="max-w-4xl mx-auto px-6 py-8">
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

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/assignments"
          className="text-college-secondary text-sm mb-4 inline-block font-poppins hover:underline"
        >
          ← Back to Assignments
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">Create New Assignment</h1>
          <p className="text-sm text-gray-500 font-poppins">
            Fill in the details to create a new assignment
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card">
          {/* Assignment Type */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
              Assignment Type <span className="text-red-500">*</span>
            </label>
            <select
              value={assignmentType}
              onChange={(e) =>
                setAssignmentType(e.target.value as "document" | "code" | "link")
              }
              className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
            >
              <option value="document">Document Submission</option>
              <option value="code">Programming Assignment</option>
              <option value="link">External Link (Google Form / Drive)</option>
            </select>
          </div>

          {/* Language (only for code assignments) */}
          {assignmentType === "code" && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Language <span className="text-red-500">*</span>
              </label>
              <select
                value={languageId}
                onChange={(e) => setLanguageId(parseInt(e.target.value))}
                className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
              >
                {LANGUAGES.map((lang) => (
                  <option key={lang.id} value={lang.id}>
                    {lang.name}
                  </option>
                ))}
              </select>
              <p className="text-xs text-gray-500 font-poppins mt-2">
                Students read input from stdin and print output. Java class must
                be named Main.
              </p>
            </div>
          )}

          {/* Smart Grading (only for code assignments) */}
          {assignmentType === "code" && (
            <div className="mb-6">
              <div className="flex items-center gap-3">
                <input
                  type="checkbox"
                  id="smartGrading"
                  checked={smartGrading}
                  onChange={(e) => setSmartGrading(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="smartGrading" className="text-sm font-medium text-gray-700 font-poppins">
                  Enable Smart Output Matching
                </label>
              </div>
              <p className="text-xs text-gray-400 font-poppins mt-1 ml-7">
                Handles extra text, whitespace, and case differences in student output
              </p>
            </div>
          )}

          {/* Submission Link (only for link assignments) */}
          {assignmentType === "link" && (
            <div className="mb-6">
              <h3 className="section-heading mb-4">Submission Link</h3>
              
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Google Form or Drive URL <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={submissionLink}
                onChange={(e) => setSubmissionLink(e.target.value)}
                placeholder="https://forms.gle/... or https://drive.google.com/..."
                className="input-field"
                required={assignmentType === "link"}
              />
              
              {submissionLink && isValidUrl(submissionLink) && (
                <div className="bg-college-peach rounded px-3 py-2 text-sm text-college-accent font-poppins mt-2">
                  Detected: {detectLinkType(submissionLink).label} — Students will see a "{detectLinkType(submissionLink).buttonText}" button
                </div>
              )}
              
              {submissionLink && !isValidUrl(submissionLink) && (
                <p className="text-red-500 text-xs mt-1">Please enter a valid URL</p>
              )}
            </div>
          )}

          {/* Title */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
              Title <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Assignment title"
              className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
              required
            />
          </div>

          {/* Description */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
              Description <span className="text-red-500">*</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Assignment description and instructions"
              className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary resize-none"
              rows={6}
              required
            />
          </div>

          {/* Section and Deadline Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
            {/* Section */}
            <div>
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Section <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={section}
                onChange={(e) => setSection(e.target.value)}
                placeholder="e.g. A, B, C"
                className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
                required
              />
            </div>

            {/* Deadline */}
            <div>
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Deadline <span className="text-red-500">*</span>
              </label>
              <input
                type="datetime-local"
                value={deadline}
                onChange={(e) => setDeadline(e.target.value)}
                className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
                required
              />
            </div>
          </div>

          {/* Max Marks */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
              Maximum Marks
            </label>
            <input
              type="number"
              value={maxMarks}
              onChange={(e) => setMaxMarks(parseInt(e.target.value) || 100)}
              min={1}
              className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
            />
          </div>

          {/* Test Cases (only for code assignments) */}
          {assignmentType === "code" && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Test Cases <span className="text-red-500">*</span>
              </label>
              <div className="space-y-4">
                {testCases.map((testCase, index) => (
                  <div
                    key={index}
                    className="p-4 border-2 border-college-peach rounded-lg"
                  >
                    <div className="flex justify-between items-center mb-3">
                      <span className="text-sm font-semibold text-college-accent font-poppins">
                        Test Case {index + 1}
                      </span>
                      {testCases.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeTestCase(index)}
                          className="text-red-500 text-sm font-poppins hover:underline"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 font-poppins mb-1">
                          Input (stdin)
                        </label>
                        <textarea
                          value={testCase.input}
                          onChange={(e) =>
                            updateTestCase(index, "input", e.target.value)
                          }
                          placeholder="Input data"
                          className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs focus:outline-none focus:border-college-secondary resize-none"
                          rows={4}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 font-poppins mb-1">
                          Expected Output
                        </label>
                        <textarea
                          value={testCase.expected_output}
                          onChange={(e) =>
                            updateTestCase(
                              index,
                              "expected_output",
                              e.target.value
                            )
                          }
                          placeholder="Expected output"
                          className="w-full px-3 py-2 border border-gray-300 rounded font-mono text-xs focus:outline-none focus:border-college-secondary resize-none"
                          rows={4}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addTestCase}
                className="mt-3 text-college-secondary text-sm font-poppins hover:underline"
              >
                + Add Test Case
              </button>
            </div>
          )}

          {/* Instruction File */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
              Instruction File (Optional)
            </label>
            <input
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className="w-full px-4 py-3 border-2 border-college-peach rounded-lg font-poppins text-sm focus:outline-none focus:border-college-secondary"
            />
            {file && (
              <p className="text-xs text-gray-500 font-poppins mt-2">
                Selected: {file.name}
              </p>
            )}
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-6">
              <p className="text-red-500 text-sm font-poppins">{error}</p>
            </div>
          )}

          {/* Submit Buttons */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary"
            >
              {submitting ? "Creating..." : "Create Assignment"}
            </button>
            <Link href="/assignments" className="btn-secondary">
              Cancel
            </Link>
          </div>
        </form>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
