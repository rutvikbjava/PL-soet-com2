"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface CurrentUser {
  email: string;
  role: string;
  department: string;
}

export default function CreateUserPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);

  // Form fields
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("");
  const [department, setDepartment] = useState("");
  const [section, setSection] = useState("");
  const [employeeId, setEmployeeId] = useState("");
  const [designation, setDesignation] = useState("");

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

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

        const userEmail = session.user.email || "";

        // Fetch current user's role and department
        const { data: userData } = await (supabase.from("users") as any)
          .select("email, role, department")
          .eq("email", userEmail)
          .single();

        if (!userData) {
          router.push("/login");
          return;
        }

        const userRole = userData.role;

        // Redirect students
        if (userRole === "student") {
          router.replace("/assignments");
          return;
        }

        // Set current user
        setCurrentUser({
          email: userData.email,
          role: userData.role,
          department: userData.department || "",
        });

        // Pre-fill department for faculty and HoD
        if ((userRole === "faculty" || userRole === "hod") && userData.department) {
          setDepartment(userData.department);
        }

        setLoading(false);
      } catch (err) {
        console.error("Auth check error:", err);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  const getAllowedRoles = (): string[] => {
    if (!currentUser) return [];

    switch (currentUser.role) {
      case "faculty":
        return ["student"];
      case "hod":
        return ["faculty"];
      case "coe":
        return ["faculty"];
      case "principal":
        return ["hod", "coe", "faculty"];
      case "admin":
        return ["faculty", "hod", "coe", "principal", "student"];
      default:
        return [];
    }
  };

  const getApprovalNote = (): string => {
    if (!currentUser) return "";

    if (currentUser.role === "faculty") {
      return "This student account needs approval from the HOD and then the Principal before the student can log in.";
    } else if (currentUser.role === "hod" || currentUser.role === "coe") {
      return "This account needs Principal approval before the user can log in.";
    } else {
      return "This account will be active immediately.";
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    // Validate required fields
    if (!fullName.trim()) {
      setError("Full Name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!password || password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    if (!role) {
      setError("Role is required.");
      return;
    }
    if (!department.trim()) {
      setError("Department is required.");
      return;
    }
    // Section required for students
    if (role === "student" && !section.trim()) {
      setError("Section is required for students.");
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

      // Build request body
      const requestBody: any = {
        email: email.trim(),
        full_name: fullName.trim(),
        password: password,
        role: role,
        department: department.trim(),
        employee_id: employeeId.trim() || undefined,
        designation: designation.trim() || undefined,
      };

      // Add section if role is student
      if (role === "student") {
        requestBody.section = section.trim();
      }

      // POST to API
      const response = await fetch("/api/users/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create user.");
        setSubmitting(false);
        return;
      }

      // Success
      const statusText = data.status || "created";
      setSuccess(
        `User created. Share the temporary password with them. Status: ${statusText}`
      );

      // Clear form
      setFullName("");
      setEmail("");
      setPassword("");
      setRole("");
      setSection("");
      if (currentUser?.role !== "hod" && currentUser?.role !== "faculty") {
        setDepartment("");
      }
      setEmployeeId("");
      setDesignation("");

      setSubmitting(false);
    } catch (err) {
      console.error("Create user error:", err);
      setError("An unexpected error occurred.");
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

  if (!currentUser) {
    return null;
  }

  const allowedRoles = getAllowedRoles();
  const isFacultyOrHod = currentUser.role === "faculty" || currentUser.role === "hod";
  const showSection = role === "student";

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

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
          <h1 className="page-heading">Create User</h1>
          <p className="text-sm text-gray-500 font-poppins mt-1">
            Add a new user to the system
          </p>
        </div>

        {/* Form Card */}
        <div className="card">
          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Full Name */}
            <div>
              <label htmlFor="fullName" className="label">
                Full Name
              </label>
              <input
                type="text"
                id="fullName"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={submitting}
                className="input-field"
                placeholder="Enter full name"
              />
            </div>

            {/* Email */}
            <div>
              <label htmlFor="email" className="label">
                Email
              </label>
              <input
                type="email"
                id="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={submitting}
                className="input-field"
                placeholder="Enter email address"
              />
            </div>

            {/* Temporary Password */}
            <div>
              <label htmlFor="password" className="label">
                Temporary Password
              </label>
              <input
                type="text"
                id="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={submitting}
                className="input-field"
                placeholder="Enter temporary password (min 6 characters)"
                minLength={6}
              />
              <p className="text-xs text-gray-400 font-poppins mt-1">
                Minimum 6 characters
              </p>
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="label">
                Role
              </label>
              <select
                id="role"
                value={role}
                onChange={(e) => setRole(e.target.value)}
                disabled={submitting}
                className="input-field"
              >
                <option value="">Select role</option>
                {allowedRoles.map((r) => (
                  <option key={r} value={r}>
                    {r.charAt(0).toUpperCase() + r.slice(1)}
                  </option>
                ))}
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
                disabled={submitting || isFacultyOrHod}
                className="input-field"
                placeholder="Enter department"
              />
              {isFacultyOrHod && (
                <p className="text-xs text-gray-400 font-poppins mt-1">
                  Pre-filled with your department
                </p>
              )}
            </div>

            {/* Section (shown only for students) */}
            {showSection && (
              <div>
                <label htmlFor="section" className="label">
                  Section
                </label>
                <input
                  type="text"
                  id="section"
                  value={section}
                  onChange={(e) => setSection(e.target.value)}
                  disabled={submitting}
                  className="input-field"
                  placeholder="Enter section (e.g. A, B)"
                  required
                />
                <p className="text-xs text-gray-400 font-poppins mt-1">
                  Required for students
                </p>
              </div>
            )}

            {/* Employee ID */}
            <div>
              <label htmlFor="employeeId" className="label">
                Employee ID <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="text"
                id="employeeId"
                value={employeeId}
                onChange={(e) => setEmployeeId(e.target.value)}
                disabled={submitting}
                className="input-field"
                placeholder="Enter employee ID"
              />
            </div>

            {/* Designation */}
            <div>
              <label htmlFor="designation" className="label">
                Designation <span className="text-gray-400">(Optional)</span>
              </label>
              <input
                type="text"
                id="designation"
                value={designation}
                onChange={(e) => setDesignation(e.target.value)}
                disabled={submitting}
                className="input-field"
                placeholder="e.g. Assistant Professor"
              />
            </div>

            {/* Approval Note */}
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
                {getApprovalNote()}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="text-red-500 text-sm text-center font-poppins">
                {error}
              </div>
            )}

            {/* Success Message */}
            {success && (
              <div className="text-green-600 text-sm text-center font-poppins">
                {success}
              </div>
            )}

            {/* Submit Button */}
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary w-full"
            >
              {submitting ? "Creating user..." : "Create User"}
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
