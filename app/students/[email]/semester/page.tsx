"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Student {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string | null;
  section: string | null;
  current_year: number | null;
  current_semester: number | null;
  admission_type: string | null;
}

interface AdmissionForm {
  id: string;
  form_type: string;
  student_email: string;
  student_name: string;
  department: string;
  section: string | null;
  current_semester: number | null;
  target_semester: number | null;
  status: string;
  created_at: string;
  completed_at: string | null;
  steps?: AdmissionStep[];
}

interface AdmissionStep {
  id: string;
  form_id: string;
  step_order: number;
  step_name: string;
  required_role: string;
  status: string;
  signature_url: string | null;
  signed_at: string | null;
  verified_name: string | null;
  verified_role: string | null;
}

interface CurrentUser {
  email: string;
  role: string;
}

export default function StudentSemesterPage({
  params,
}: {
  params: { email: string };
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [admissionForms, setAdmissionForms] = useState<AdmissionForm[]>([]);
  const [expandedFormId, setExpandedFormId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    fetchData();
  }, [params.email]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const supabase = createBrowserClient();
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        router.push("/login");
        return;
      }

      const userEmail = session.user.email || "";

      // Fetch current user
      const { data: userData } = await (supabase.from("users") as any)
        .select("email, role")
        .eq("email", userEmail)
        .single();

      if (!userData) {
        router.push("/login");
        return;
      }

      // Check if user has permission to view
      const allowedRoles = ["faculty", "hod", "admin", "admission_incharge"];
      if (!allowedRoles.includes(userData.role)) {
        router.replace("/dashboard");
        return;
      }

      setCurrentUser({
        email: userData.email,
        role: userData.role,
      });

      // Decode email parameter
      const decodedEmail = decodeURIComponent(params.email);

      // Fetch student data
      const { data: studentData, error: studentError } = await (
        supabase.from("users") as any
      )
        .select("*")
        .eq("email", decodedEmail)
        .single();

      if (studentError || !studentData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setStudent(studentData as Student);

      // Fetch admission forms
      const { data: formsData } = await (supabase.from("admission_forms") as any)
        .select("*")
        .eq("student_email", decodedEmail)
        .order("created_at", { ascending: false });

      const forms = (formsData ?? []) as AdmissionForm[];

      // Fetch steps for each form
      const formsWithSteps = await Promise.all(
        forms.map(async (form) => {
          const { data: stepsData } = await (
            supabase.from("admission_steps") as any
          )
            .select("*")
            .eq("form_id", form.id)
            .order("step_order", { ascending: true });

          return {
            ...form,
            steps: (stepsData ?? []) as AdmissionStep[],
          };
        })
      );

      setAdmissionForms(formsWithSteps);
      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setNotFound(true);
      setLoading(false);
    }
  };

  const toggleExpand = (formId: string) => {
    setExpandedFormId(expandedFormId === formId ? null : formId);
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold";
      case "in_progress":
        return "bg-blue-100 text-blue-700 px-2 py-1 rounded-full text-xs font-semibold";
      case "completed":
        return "bg-green-100 text-green-700 px-2 py-1 rounded-full text-xs font-semibold";
      case "rejected":
        return "bg-red-100 text-red-700 px-2 py-1 rounded-full text-xs font-semibold";
      default:
        return "bg-gray-100 text-gray-700 px-2 py-1 rounded-full text-xs font-semibold";
    }
  };

  const getFormTypeBadge = (formType: string) => {
    if (formType === "promotion") {
      return "bg-purple-100 text-purple-700 px-3 py-1 rounded-full text-xs font-semibold";
    } else {
      return "bg-indigo-100 text-indigo-700 px-3 py-1 rounded-full text-xs font-semibold";
    }
  };

  const getStepStatusIcon = (status: string) => {
    if (status === "approved") {
      return (
        <svg
          className="w-5 h-5 text-green-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
      );
    } else if (status === "rejected") {
      return (
        <svg
          className="w-5 h-5 text-red-500"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
            clipRule="evenodd"
          />
        </svg>
      );
    } else {
      return (
        <svg
          className="w-5 h-5 text-gray-400"
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path
            fillRule="evenodd"
            d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
            clipRule="evenodd"
          />
        </svg>
      );
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const formatDateTime = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString("en-US", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading...</p>
      </div>
    );
  }

  if (notFound || !student) {
    return (
      <div className="min-h-screen bg-college-bg">
        {currentUser && (
          <Navbar userEmail={currentUser.email} userRole={currentUser.role} />
        )}
        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="card text-center py-12">
            <p className="text-gray-400 font-poppins text-lg">Student not found.</p>
            <Link href="/users" className="btn-secondary mt-4 inline-block">
              ← Back to Users
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/users"
          className="text-college-secondary text-sm font-poppins mb-4 inline-block hover:underline"
        >
          ← Back to Users
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">Student Semester & Admission History</h1>
          <p className="text-sm text-gray-500 font-poppins mt-1">
            View academic progression and admission records
          </p>
        </div>

        {/* SECTION 1 — STUDENT INFO */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
            Student Information
          </h2>

          <div className="space-y-3 mb-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm font-poppins">
              <div>
                <span className="text-gray-600">Full Name:</span>{" "}
                <span className="font-medium">{student.full_name}</span>
              </div>
              <div>
                <span className="text-gray-600">Email:</span>{" "}
                <span className="font-medium">{student.email}</span>
              </div>
              <div>
                <span className="text-gray-600">Department:</span>{" "}
                <span className="font-medium">{student.department || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-600">Section:</span>{" "}
                <span className="font-medium">{student.section || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-600">Role:</span>{" "}
                <span className="font-medium capitalize">{student.role}</span>
              </div>
            </div>
          </div>

          {/* Highlighted Stats */}
          <div className="bg-college-accent bg-opacity-10 border-2 border-college-accent rounded-lg p-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-center">
              <div>
                <p className="text-xs text-gray-600 font-poppins mb-1">Current Year</p>
                <p className="text-2xl font-bold text-college-accent font-poppins">
                  {student.current_year || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-poppins mb-1">
                  Current Semester
                </p>
                <p className="text-2xl font-bold text-college-accent font-poppins">
                  {student.current_semester || "N/A"}
                </p>
              </div>
              <div>
                <p className="text-xs text-gray-600 font-poppins mb-1">Admission Type</p>
                <p className="text-lg font-semibold text-college-accent font-poppins capitalize">
                  {student.admission_type || "N/A"}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* SECTION 2 — ADMISSION HISTORY */}
        <div className="card">
          <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
            Admission & Promotion History
          </h2>

          {admissionForms.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-400 font-poppins">
                No admission records found for this student.
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {admissionForms.map((form) => (
                <div
                  key={form.id}
                  className="border border-college-peach rounded-lg overflow-hidden"
                >
                  {/* Collapsible Header */}
                  <div
                    className="flex items-center justify-between p-4 bg-college-bg hover:bg-white cursor-pointer transition-colors"
                    onClick={() => toggleExpand(form.id)}
                  >
                    <div className="flex items-center gap-3 flex-wrap">
                      <span className={getFormTypeBadge(form.form_type)}>
                        {form.form_type === "promotion" ? "Promotion" : "Fresh"}
                      </span>
                      <span className="text-sm font-semibold text-college-text font-poppins">
                        → Semester {form.target_semester}
                      </span>
                      <span className={getStatusBadgeClass(form.status)}>
                        {form.status.replace("_", " ").toUpperCase()}
                      </span>
                      <span className="text-xs text-gray-500 font-poppins">
                        {form.completed_at
                          ? formatDate(form.completed_at)
                          : formatDate(form.created_at)}
                      </span>
                    </div>

                    <svg
                      className={`w-5 h-5 text-gray-500 transition-transform ${
                        expandedFormId === form.id ? "rotate-180" : ""
                      }`}
                      fill="currentColor"
                      viewBox="0 0 20 20"
                    >
                      <path
                        fillRule="evenodd"
                        d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                        clipRule="evenodd"
                      />
                    </svg>
                  </div>

                  {/* Expanded Content */}
                  {expandedFormId === form.id && (
                    <div className="p-4 bg-white border-t border-college-peach">
                      {/* Mini Step Timeline */}
                      <div className="mb-4">
                        <p className="text-sm font-semibold text-gray-600 font-poppins mb-3">
                          Approval Steps:
                        </p>
                        <div className="space-y-3">
                          {form.steps && form.steps.length > 0 ? (
                            form.steps.map((step) => (
                              <div
                                key={step.id}
                                className="flex items-start gap-3 text-sm font-poppins"
                              >
                                <div className="flex-shrink-0 mt-0.5">
                                  {getStepStatusIcon(step.status)}
                                </div>
                                <div className="flex-1">
                                  <p className="font-medium text-college-text">
                                    {step.step_name}
                                  </p>
                                  {step.status === "approved" && (
                                    <p className="text-xs text-gray-600">
                                      ✓ Verified by {step.verified_name || "N/A"} on{" "}
                                      {step.signed_at
                                        ? formatDateTime(step.signed_at)
                                        : "N/A"}
                                    </p>
                                  )}
                                  {step.status === "rejected" && (
                                    <p className="text-xs text-red-600">
                                      ✗ Rejected by {step.verified_name || "N/A"}
                                    </p>
                                  )}
                                  {step.status === "pending" && (
                                    <p className="text-xs text-gray-500">
                                      Pending ({step.required_role})
                                    </p>
                                  )}
                                </div>
                              </div>
                            ))
                          ) : (
                            <p className="text-xs text-gray-400 font-poppins">
                              No steps recorded.
                            </p>
                          )}
                        </div>
                      </div>

                      {/* View Full Form Link */}
                      <div className="pt-3 border-t border-college-peach">
                        <Link
                          href={
                            form.form_type === "promotion"
                              ? `/admissions/promote/${form.id}`
                              : `/admissions/fresh/${form.id}`
                          }
                          className="text-college-secondary hover:text-college-accent text-sm font-poppins font-medium inline-flex items-center gap-1"
                        >
                          View Full Form
                          <svg
                            className="w-4 h-4"
                            fill="none"
                            stroke="currentColor"
                            viewBox="0 0 24 24"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M9 5l7 7-7 7"
                            />
                          </svg>
                        </Link>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
