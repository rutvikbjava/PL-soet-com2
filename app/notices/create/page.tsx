"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import { NOTICE_CATEGORIES, RECIPIENT_ROLES, DEPARTMENTS } from "@/lib/notice-categories";
import Navbar from "@/components/Navbar";

export default function CreateNoticePage() {
  const router = useRouter();
  const [userEmail, setUserEmail] = useState("");
  const [userRole, setUserRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Form fields
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [documentType, setDocumentType] = useState("");
  const [department, setDepartment] = useState("");
  const [scope, setScope] = useState("");
  const [noticeContent, setNoticeContent] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [publicationDate, setPublicationDate] = useState("");
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedDepartments, setSelectedDepartments] = useState<string[]>([]);

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

        // Fetch user role
        const { data: userData } = await (supabase.from("users") as any)
          .select("role")
          .eq("email", email)
          .single();

        const role = (userData as any)?.role || null;
        setUserRole(role);

        // Check if user has permission
        if (!["faculty", "hod", "principal"].includes(role)) {
          setLoading(false);
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

  const toggleRole = (value: string) => {
    setSelectedRoles((prev) =>
      prev.includes(value) ? prev.filter((r) => r !== value) : [...prev, value]
    );
  };

  const toggleDepartment = (value: string) => {
    setSelectedDepartments((prev) =>
      prev.includes(value) ? prev.filter((d) => d !== value) : [...prev, value]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!title.trim() || !category || !documentType || !department.trim() || !scope) {
      setError("Please fill in all required fields");
      return;
    }

    if (selectedRoles.length === 0 && selectedDepartments.length === 0) {
      setError("Please select at least one recipient (role or department)");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("Session expired. Please log in again.");
        setSubmitting(false);
        return;
      }

      // Build FormData
      const formData = new FormData();
      formData.append("title", title.trim());
      formData.append("type", documentType);
      formData.append("department", department.trim());
      formData.append("scope", scope);
      formData.append("category", category);
      formData.append("notice_content", noticeContent.trim());
      formData.append("publication_date", publicationDate || "");
      formData.append("recipient_roles", JSON.stringify(selectedRoles));
      formData.append("recipient_departments", JSON.stringify(selectedDepartments));

      if (file) {
        formData.append("file", file);
      }

      // Submit to API
      const response = await fetch("/api/notices/create", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
        body: formData,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to create notice");
      }

      // Redirect to document page
      router.push(`/documents/${result.documentId}`);
    } catch (err: any) {
      console.error("Create notice error:", err);
      setError(err.message || "Failed to create notice");
      setSubmitting(false);
    }
  };

  // Get today's date for min attribute
  const today = new Date().toISOString().split("T")[0];

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading...</p>
      </div>
    );
  }

  // Access denied
  if (userRole && !["faculty", "hod", "principal"].includes(userRole)) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={userEmail} userRole={userRole} />
        <div className="max-w-3xl mx-auto px-6 py-8">
          <div className="card text-center">
            <h2 className="text-2xl font-bold text-red-600 font-poppins mb-4">
              Access Denied
            </h2>
            <p className="text-gray-600 font-poppins mb-4">
              You do not have permission to create notices.
            </p>
            <Link href="/dashboard" className="btn-secondary">
              Back to Dashboard
            </Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={userEmail} userRole={userRole} />

      <main className="max-w-3xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/dashboard"
          className="text-college-secondary text-sm mb-4 inline-block font-poppins hover:underline"
        >
          ← Back to Dashboard
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">Create Notice</h1>
          <p className="text-sm text-gray-500 font-poppins">
            Create and submit a notice for approval and publication
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="card">
          {/* SECTION 1 — Notice Details */}
          <div className="mb-8">
            <h2 className="section-heading mb-4">Notice Information</h2>

            {/* Notice Title */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Notice Title <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. Holiday Notice - Diwali 2027"
                className="input-field"
                required
              />
            </div>

            {/* Category */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Category <span className="text-red-500">*</span>
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Select category</option>
                {NOTICE_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            {/* Document Type */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Document Type <span className="text-red-500">*</span>
              </label>
              <select
                value={documentType}
                onChange={(e) => setDocumentType(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Select document type</option>
                <option value="notice">Notice</option>
                <option value="circular">Circular</option>
                <option value="policy">Policy</option>
              </select>
            </div>

            {/* Department */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Department <span className="text-red-500">*</span>
              </label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                placeholder="e.g. Computer Science or All Departments"
                className="input-field"
                required
              />
            </div>

            {/* Scope */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Scope <span className="text-red-500">*</span>
              </label>
              <select
                value={scope}
                onChange={(e) => setScope(e.target.value)}
                className="input-field"
                required
              >
                <option value="">Select scope</option>
                <option value="department">Department</option>
                <option value="college">College</option>
                <option value="institution">Institution</option>
              </select>
            </div>

            {/* Notice Content */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Notice Content
              </label>
              <textarea
                value={noticeContent}
                onChange={(e) => setNoticeContent(e.target.value)}
                placeholder="Type the notice content here (optional if uploading a file)"
                rows={4}
                className="input-field resize-none"
              />
            </div>

            {/* Attach File */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Attach File
              </label>
              <input
                type="file"
                onChange={(e) => setFile(e.target.files?.[0] || null)}
                accept=".pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx"
                className="input-field"
              />
              {file && (
                <p className="text-sm text-gray-600 font-poppins mt-2">
                  Selected: {file.name}
                </p>
              )}
              <p className="text-xs text-gray-400 font-poppins mt-1">
                Optional: PDF, Word, Excel, PowerPoint accepted
              </p>
            </div>

            {/* Publication Date */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                Schedule Publication Date
              </label>
              <input
                type="date"
                value={publicationDate}
                onChange={(e) => setPublicationDate(e.target.value)}
                min={today}
                className="input-field"
              />
              <p className="text-xs text-gray-400 font-poppins mt-1">
                Leave blank to publish immediately upon approval
              </p>
            </div>
          </div>

          {/* SECTION 2 — Recipients */}
          <div className="mb-6">
            <h2 className="section-heading mb-2">Select Recipients</h2>
            <p className="text-sm text-gray-500 font-poppins mb-4">
              Choose who will see this notice after publication
            </p>

            <div className="grid grid-cols-2 gap-6">
              {/* By Role */}
              <div>
                <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                  Recipient Roles
                </label>
                <div className="space-y-2">
                  {RECIPIENT_ROLES.map((role) => (
                    <label
                      key={role.value}
                      className="bg-college-peach rounded-lg px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-opacity-80"
                    >
                      <input
                        type="checkbox"
                        checked={selectedRoles.includes(role.value)}
                        onChange={() => toggleRole(role.value)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-college-text font-poppins">
                        {role.label}
                      </span>
                    </label>
                  ))}
                </div>
              </div>

              {/* By Department */}
              <div>
                <label className="block text-sm font-medium text-gray-700 font-poppins mb-2">
                  Recipient Departments
                </label>
                <div className="space-y-2">
                  {DEPARTMENTS.map((dept) => (
                    <label
                      key={dept}
                      className="bg-college-peach rounded-lg px-3 py-2 flex items-center gap-2 cursor-pointer hover:bg-opacity-80"
                    >
                      <input
                        type="checkbox"
                        checked={selectedDepartments.includes(dept)}
                        onChange={() => toggleDepartment(dept)}
                        className="w-4 h-4"
                      />
                      <span className="text-sm text-college-text font-poppins">
                        {dept}
                      </span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            {/* Info Box */}
            <div className="bg-college-peach border border-college-secondary rounded-lg p-4 mt-4">
              <p className="text-sm text-college-accent font-poppins">
                The approval workflow will be automatically generated based on document
                type and scope.
              </p>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="mb-4">
              <p className="text-red-500 text-sm font-poppins">{error}</p>
            </div>
          )}

          {/* Submit Button */}
          <button
            type="submit"
            disabled={submitting}
            className="btn-primary w-full"
          >
            {submitting ? "Submitting..." : "Submit Notice for Approval"}
          </button>
        </form>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
