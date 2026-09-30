"use client";

import { useState, useEffect, FormEvent, ChangeEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

export default function UploadPage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [type, setType] = useState("");
  const [department, setDepartment] = useState("");
  const [scope, setScope] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
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

        // Fetch user role by email
        const { data: userData } = await (supabase.from("users") as any)
          .select("role")
          .eq("email", email)
          .single();

        const role = (userData as any)?.role || null;

        // Redirect students to /assignments
        if (role === "student") {
          router.replace("/assignments");
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error("Auth check error:", err);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  const handleFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setFileName(selectedFile.name);
    } else {
      setFile(null);
      setFileName("");
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // Validate all fields
    if (!title.trim()) {
      setError("Document title is required.");
      return;
    }
    if (!type) {
      setError("Document type is required.");
      return;
    }
    if (!department.trim()) {
      setError("Department is required.");
      return;
    }
    if (!scope) {
      setError("Scope is required.");
      return;
    }
    if (!file) {
      setError("File is required.");
      return;
    }

    setUploading(true);

    try {
      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Session expired. Please log in again.");
        setUploading(false);
        return;
      }

      // Build FormData
      const formData = new FormData();
      formData.append("title", title);
      formData.append("type", type);
      formData.append("department", department);
      formData.append("scope", scope);
      formData.append("file", file);

      // POST to API
      const response = await fetch("/api/documents/upload", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session?.access_token ?? ''}`,
        },
        body: formData,
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to upload document.");
        setUploading(false);
        return;
      }

      // Redirect to document detail page
      if (data.document?.id) {
        router.push(`/documents/${data.document.id}`);
      } else {
        setError("Document uploaded but no ID returned.");
        setUploading(false);
      }
    } catch (err) {
      console.error("Upload error:", err);
      setError("An unexpected error occurred during upload.");
      setUploading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-2xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="text-college-secondary text-sm font-poppins mb-4 inline-block hover:underline"
        >
          ← Back to Dashboard
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">Upload Document</h1>
          <p className="text-sm text-gray-500 font-poppins mt-1">
            Submit a new document for workflow approval
          </p>
        </div>

        {/* Form Card */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Document Title */}
            <div>
              <label htmlFor="title" className="label">
                Document Title
              </label>
              <input
                type="text"
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                disabled={uploading}
                className="input-field"
                placeholder="Enter document title"
              />
            </div>

            {/* Document Type */}
            <div>
              <label htmlFor="type" className="label">
                Document Type
              </label>
              <select
                id="type"
                value={type}
                onChange={(e) => setType(e.target.value)}
                disabled={uploading}
                className="input-field"
              >
                <option value="">Select document type</option>
                <option value="timetable">Timetable</option>
                <option value="exam_schedule">Examination Schedule</option>
                <option value="policy">Policy Document</option>
              </select>
            </div>

            {/* Department */}
            <div>
              <label htmlFor="department" className="label">
                Department
              </label>
              <input
                type="text"
                id="department"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                disabled={uploading}
                className="input-field"
                placeholder="e.g. Computer Science"
              />
            </div>

            {/* Scope */}
            <div>
              <label htmlFor="scope" className="label">
                Scope
              </label>
              <select
                id="scope"
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                disabled={uploading}
                className="input-field"
              >
                <option value="">Select scope</option>
                <option value="department">Department Level</option>
                <option value="college">College Level</option>
                <option value="institution">Institution Level</option>
              </select>
            </div>

            {/* Upload File */}
            <div>
              <label htmlFor="file" className="label">
                Upload File
              </label>
              <input
                type="file"
                id="file"
                accept=".pdf,.doc,.docx,.ppt,.pptx"
                onChange={handleFileChange}
                disabled={uploading}
                className="input-field"
              />
              {fileName && (
                <p className="text-sm text-college-secondary mt-1 font-poppins">
                  Selected: {fileName}
                </p>
              )}
              <p className="text-xs text-gray-400 font-poppins mt-1">
                Accepted: PDF, DOC, DOCX, PPT, PPTX
              </p>
            </div>

            {/* Info Box */}
            <div className="bg-college-peach border border-college-secondary rounded-lg p-4 flex gap-3">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 text-college-accent flex-shrink-0 mt-0.5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="text-sm text-college-accent font-poppins">
                The workflow approval chain will be automatically generated based
                on your document type and scope.
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-500 text-sm text-center font-poppins">
                {error}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={uploading}
              className="btn-primary w-full"
            >
              {uploading
                ? "Uploading document..."
                : "Submit for Workflow Approval"}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
