"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface AdmissionForm {
  id: string;
  form_type: string;
  student_email: string;
  student_name: string;
  department: string;
  section: string | null;
  current_year: number | null;
  current_semester: number | null;
  target_semester: number | null;
  status: string;
  created_by_email: string;
  created_at: string;
}

interface CurrentUser {
  email: string;
  role: string;
  department: string | null;
}

export default function AdmissionsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [promotionForms, setPromotionForms] = useState<AdmissionForm[]>([]);
  const [freshForms, setFreshForms] = useState<AdmissionForm[]>([]);
  const [activeTab, setActiveTab] = useState<"promotion" | "fresh">("promotion");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
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

        // Fetch current user's data
        const { data: userData } = await (supabase.from("users") as any)
          .select("email, role, department")
          .eq("email", userEmail)
          .single();

        if (!userData) {
          router.push("/login");
          return;
        }

        const userRole = userData.role;

        // Students redirect to /assignments
        if (userRole === "student") {
          router.replace("/assignments");
          return;
        }

        setCurrentUser({
          email: userData.email,
          role: userData.role,
          department: userData.department || null,
        });

        // Fetch promotion forms
        await fetchPromotionForms(supabase, userRole, userData.department, userEmail);

        // Fetch fresh admission forms
        await fetchFreshForms(supabase, userRole, userData.department);

        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        router.push("/login");
      }
    };

    fetchData();
  }, [router]);

  const fetchPromotionForms = async (
    supabase: any,
    role: string,
    department: string | null,
    email: string
  ) => {
    try {
      let query = (supabase.from("admission_forms") as any)
        .select("*")
        .eq("form_type", "promotion");

      // Apply role-based filters
      if (role === "faculty") {
        query = query.eq("created_by_email", email);
      } else if (role === "hod") {
        query = query.eq("department", department);
      }
      // accountant, librarian, admin see all

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      setPromotionForms((data ?? []) as AdmissionForm[]);
    } catch (err) {
      console.error("Fetch promotion forms error:", err);
      setPromotionForms([]);
    }
  };

  const fetchFreshForms = async (
    supabase: any,
    role: string,
    department: string | null
  ) => {
    try {
      let query = (supabase.from("admission_forms") as any)
        .select("*")
        .eq("form_type", "fresh");

      // Apply role-based filters
      if (role === "accountant") {
        query = query.eq("status", "in_progress");
      } else if (role === "hod") {
        query = query.eq("department", department);
      }
      // admission_incharge, admin see all

      query = query.order("created_at", { ascending: false });

      const { data, error } = await query;

      if (error) throw error;

      setFreshForms((data ?? []) as AdmissionForm[]);
    } catch (err) {
      console.error("Fetch fresh forms error:", err);
      setFreshForms([]);
    }
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-semibold";
      case "in_progress":
        return "bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full text-xs font-semibold";
      case "completed":
        return "bg-green-100 text-green-700 px-2 py-0.5 rounded-full text-xs font-semibold";
      case "rejected":
        return "bg-red-100 text-red-700 px-2 py-0.5 rounded-full text-xs font-semibold";
      default:
        return "bg-gray-100 text-gray-700 px-2 py-0.5 rounded-full text-xs font-semibold";
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
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

  const canCreatePromotion = currentUser.role === "faculty";
  const canCreateFresh = currentUser.role === "admission_incharge";

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">Admissions</h1>
          <p className="text-sm text-gray-500 font-poppins mt-1">
            Manage semester promotions and fresh admissions
          </p>
        </div>

        {/* Tabs */}
        <div className="flex items-center gap-4 mb-6 border-b border-college-peach">
          <button
            onClick={() => setActiveTab("promotion")}
            className={`pb-3 px-2 font-poppins text-sm font-medium transition-colors ${
              activeTab === "promotion"
                ? "text-college-accent border-b-2 border-college-accent"
                : "text-gray-400 hover:text-college-secondary"
            }`}
          >
            Semester Promotion
          </button>
          <button
            onClick={() => setActiveTab("fresh")}
            className={`pb-3 px-2 font-poppins text-sm font-medium transition-colors ${
              activeTab === "fresh"
                ? "text-college-accent border-b-2 border-college-accent"
                : "text-gray-400 hover:text-college-secondary"
            }`}
          >
            Fresh Admissions
          </button>
        </div>

        {/* SEMESTER PROMOTION TAB */}
        {activeTab === "promotion" && (
          <div>
            {/* Action Button */}
            {canCreatePromotion && (
              <div className="flex justify-end mb-4">
                <Link href="/admissions/promote/new" className="btn-primary">
                  + New Promotion Form
                </Link>
              </div>
            )}

            {/* Table */}
            {promotionForms.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-gray-400 font-poppins">
                  No semester promotion forms found.
                </p>
              </div>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-college-peach">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Student Name
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Department
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Section
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Semester
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Created Date
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {promotionForms.map((form) => (
                      <tr
                        key={form.id}
                        className="border-b border-college-peach hover:bg-college-bg transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-college-text font-poppins">
                          {form.student_name}
                        </td>
                        <td className="py-3 px-4 text-sm text-college-text font-poppins">
                          {form.department}
                        </td>
                        <td className="py-3 px-4 text-sm text-college-text font-poppins">
                          {form.section || "-"}
                        </td>
                        <td className="py-3 px-4 text-sm text-college-text font-poppins">
                          {form.current_semester} → {form.target_semester}
                        </td>
                        <td className="py-3 px-4">
                          <span className={getStatusBadgeClass(form.status)}>
                            {form.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500 font-poppins">
                          {formatDate(form.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/admissions/promote/${form.id}`}
                            className="text-college-secondary hover:text-college-accent text-sm font-poppins font-medium"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* FRESH ADMISSIONS TAB */}
        {activeTab === "fresh" && (
          <div>
            {/* Action Button */}
            {canCreateFresh && (
              <div className="flex justify-end mb-4">
                <Link href="/admissions/fresh/new" className="btn-primary">
                  + New Fresh Admission
                </Link>
              </div>
            )}

            {/* Table */}
            {freshForms.length === 0 ? (
              <div className="card text-center py-12">
                <p className="text-gray-400 font-poppins">
                  No fresh admission forms found.
                </p>
              </div>
            ) : (
              <div className="card overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-college-peach">
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Student Name
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Student Email
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Department
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Status
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Created Date
                      </th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-college-text font-poppins">
                        Action
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {freshForms.map((form) => (
                      <tr
                        key={form.id}
                        className="border-b border-college-peach hover:bg-college-bg transition-colors"
                      >
                        <td className="py-3 px-4 text-sm text-college-text font-poppins">
                          {form.student_name}
                        </td>
                        <td className="py-3 px-4 text-sm text-college-text font-poppins">
                          {form.student_email}
                        </td>
                        <td className="py-3 px-4 text-sm text-college-text font-poppins">
                          {form.department}
                        </td>
                        <td className="py-3 px-4">
                          <span className={getStatusBadgeClass(form.status)}>
                            {form.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-sm text-gray-500 font-poppins">
                          {formatDate(form.created_at)}
                        </td>
                        <td className="py-3 px-4">
                          <Link
                            href={`/admissions/fresh/${form.id}`}
                            className="text-college-secondary hover:text-college-accent text-sm font-poppins font-medium"
                          >
                            View
                          </Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
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
