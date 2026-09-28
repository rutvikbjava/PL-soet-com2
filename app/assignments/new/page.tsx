"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!title.trim() || !section.trim() || !deadline) {
      setError("Please fill in all required fields");
      return;
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
          created_by: userId,
          created_by_email: userEmail,
        })
        .select()
        .single();

      if (insertError) {
        throw new Error("Failed to create assignment: " + insertError.message);
      }

      const assignmentId = (assignmentData as any)?.id;

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
