"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

// Helper function to find active season
function findActiveSeason(seasons: any[], department: string, section: string) {
  if (!seasons || seasons.length === 0) return null;

  // First try exact match on both department and section
  const exact = seasons.find(s =>
    s.department === department && s.section === section && s.status === 'open'
  );
  if (exact) return exact;

  // Then try department match with no section restriction (season covers whole department)
  const deptWide = seasons.find(s =>
    s.department === department && (!s.section || s.section === '') && s.status === 'open'
  );
  return deptWide ?? null;
}

interface CurrentUser {
  email: string;
  role: string;
  full_name: string;
  department: string | null;
  section: string | null;
}

interface AdmissionForm {
  id: string;
  form_type: string;
  student_email: string;
  student_name: string;
  department: string;
  section: string;
  current_year: number;
  current_semester: number;
  target_semester: number;
  status: string;
  created_at: string;
  remarks: any;
}

interface AdmissionSeason {
  id: string;
  department: string;
  section: string;
  academic_year: string;
  target_semester: number;
  status: string;
}

export default function AdmissionsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [forms, setForms] = useState<AdmissionForm[]>([]);
  const [openSeason, setOpenSeason] = useState<AdmissionSeason | null>(null);
  const [activeTab, setActiveTab] = useState<"promotion" | "fresh">("promotion");
  const [departmentFilter, setDepartmentFilter] = useState<string>("");
  const [departments, setDepartments] = useState<string[]>([]);

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

        // Fetch current user
        const { data: userData } = await (supabase.from("users") as any)
          .select("*")
          .eq("email", userEmail)
          .single();

        if (!userData) {
          router.push("/login");
          return;
        }

        setCurrentUser({
          email: userData.email,
          role: userData.role,
          full_name: userData.full_name,
          department: userData.department || null,
          section: userData.section || null,
        });

        // Fetch forms based on role
        await fetchForms(supabase, userData.role, userData.email, userData.department, userData.section);

        // For students, check for open season
        if (userData.role === "student") {
          const { data: allSeasons } = await (supabase.from("admission_seasons") as any)
            .select("*")
            .eq("status", "open");

          const activeSeason = findActiveSeason(allSeasons ?? [], userData.department, userData.section);

          setOpenSeason(activeSeason);
        }

        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        router.push("/login");
      }
    };

    fetchData();
  }, [router]);

  const fetchForms = async (
    supabase: any,
    role: string,
    email: string,
    department: string | null,
    section: string | null
  ) => {
    let query = (supabase.from("admission_forms") as any).select("*");

    if (role === "student") {
      query = query.eq("form_type", "promotion").eq("student_email", email);
    } else if (role === "faculty") {
      query = query
        .eq("form_type", "promotion")
        .eq("department", department)
        .eq("section", section);
    } else if (role === "hod") {
      query = query
        .eq("form_type", "promotion")
        .eq("department", department);
    } else if (role === "accountant" || role === "librarian") {
      query = query.eq("status", "in_progress");
    } else if (role === "principal" || role === "admin") {
      // Show all forms
    } else if (role === "admission_incharge") {
      // Show all forms
    }

    query = query.order("created_at", { ascending: false });

    const { data } = await query;
    const formData = (data || []) as AdmissionForm[];
    setForms(formData);

    // Extract unique departments for filter
    const uniqueDepts = Array.from(new Set(formData.map((f) => f.department)));
    setDepartments(uniqueDepts);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "in_progress":
        return "bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold";
      case "completed":
        return "bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold";
      case "rejected":
        return "bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold";
      case "draft":
        return "bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold";
      default:
        return "bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold";
    }
  };

  const getPRN = (remarks: any) => {
    try {
      const parsed = typeof remarks === "string" ? JSON.parse(remarks) : remarks;
      return parsed?.prn || "—";
    } catch {
      return "—";
    }
  };

  // Filter forms based on active tab and department filter
  const getFilteredForms = () => {
    let filtered = forms;

    // Filter by tab
    if (currentUser?.role === "hod" || currentUser?.role === "principal" || currentUser?.role === "admin" || currentUser?.role === "admission_incharge") {
      filtered = forms.filter((f) => f.form_type === activeTab);
    }

    // Filter by department
    if (departmentFilter && (currentUser?.role === "principal" || currentUser?.role === "admin")) {
      filtered = filtered.filter((f) => f.department === departmentFilter);
    }

    return filtered;
  };

  const filteredForms = getFilteredForms();

  // Calculate counts
  const totalCount = filteredForms.length;
  const pendingCount = filteredForms.filter((f) => f.status === "in_progress").length;
  const completedCount = filteredForms.filter((f) => f.status === "completed").length;
  const rejectedCount = filteredForms.filter((f) => f.status === "rejected").length;

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

  // STUDENT VIEW
  if (currentUser.role === "student") {
    const myForm = forms[0] || null;

    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="page-heading">My Admission Form</h1>
          </div>

          {myForm ? (
            <div className="card">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h3 className="text-lg font-semibold text-college-accent font-poppins">
                    Semester Promotion
                  </h3>
                  <p className="text-sm text-gray-500 font-poppins mt-1">
                    {myForm.department} • Section {myForm.section}
                  </p>
                  <p className="text-sm text-gray-500 font-poppins">
                    Current Semester: {myForm.current_semester} → Target Semester: {myForm.target_semester}
                  </p>
                </div>
                <span className={getStatusBadgeClass(myForm.status)}>{myForm.status}</span>
              </div>

              <p className="text-xs text-gray-500 font-poppins mb-4">
                Submitted on {formatDate(myForm.created_at)}
              </p>

              <Link
                href={`/admissions/promote/${myForm.id}`}
                className="btn-primary inline-block"
              >
                View Form
              </Link>
            </div>
          ) : (
            <div>
              {openSeason ? (
                <div>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-4">
                    <p className="text-green-700 font-poppins text-sm font-medium">
                      ✅ Admissions are open for your section — Academic Year {openSeason.academic_year}
                    </p>
                  </div>
                  <Link href="/admissions/promote/new" className="btn-primary inline-block">
                    Fill Admission Form
                  </Link>
                </div>
              ) : (
                <div className="card text-center py-8">
                  <p className="text-gray-500 font-poppins">
                    Admissions are not open for your section yet.
                  </p>
                </div>
              )}
            </div>
          )}
        </main>

        <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
          © MGM University SOET | EduSphere AI
        </footer>
      </div>
    );
  }

  // FACULTY VIEW
  if (currentUser.role === "faculty") {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="page-heading">My Students' Promotion Forms</h1>
            <p className="text-sm text-gray-500 font-poppins mt-1">
              {currentUser.department} • Section {currentUser.section}
            </p>
          </div>

          {/* Summary Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <div className="card text-center">
              <p className="text-2xl font-bold text-college-secondary font-poppins">{totalCount}</p>
              <p className="text-xs text-gray-500 font-poppins mt-1">Total</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-blue-600 font-poppins">{pendingCount}</p>
              <p className="text-xs text-gray-500 font-poppins mt-1">Pending</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-green-600 font-poppins">{completedCount}</p>
              <p className="text-xs text-gray-500 font-poppins mt-1">Completed</p>
            </div>
            <div className="card text-center">
              <p className="text-2xl font-bold text-red-600 font-poppins">{rejectedCount}</p>
              <p className="text-xs text-gray-500 font-poppins mt-1">Rejected</p>
            </div>
          </div>

          {/* Table */}
          <div className="card">
            {forms.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 font-poppins text-center">
                No admission forms found.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Student Name</th>
                      <th className="table-header">PRN</th>
                      <th className="table-header">Semester</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Submitted Date</th>
                      <th className="table-header">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forms.map((form) => (
                      <tr key={form.id} className="table-row">
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {form.student_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {getPRN(form.remarks)}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {form.current_semester} → {form.target_semester}
                        </td>
                        <td className="px-4 py-3">
                          <span className={getStatusBadgeClass(form.status)}>{form.status}</span>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {formatDate(form.created_at)}
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={`/admissions/promote/${form.id}`}
                            className="text-college-secondary text-xs font-poppins font-semibold hover:underline"
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
        </main>

        <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
          © MGM University SOET | EduSphere AI
        </footer>
      </div>
    );
  }

  // HOD, PRINCIPAL, ADMIN, ADMISSION_INCHARGE VIEW (with tabs)
  if (["hod", "principal", "admin", "admission_incharge"].includes(currentUser.role)) {
    const showTabs = currentUser.role !== "hod"; // HOD doesn't use tabs, shows promotion first then fresh below
    const showDepartmentFilter = currentUser.role === "principal" || currentUser.role === "admin";
    const showNewFreshButton = currentUser.role === "admission_incharge" && activeTab === "fresh";

    // For HOD: separate promotion and fresh forms
    const promotionForms = currentUser.role === "hod" 
      ? forms.filter((f) => f.form_type === "promotion")
      : [];
    const freshForms = currentUser.role === "hod"
      ? forms.filter((f) => f.form_type === "fresh")
      : [];

    // For Principal/Admin: calculate tab counts
    const promotionCount = forms.filter((f) => f.form_type === "promotion").length;
    const freshCount = forms.filter((f) => f.form_type === "fresh").length;

    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between mb-6">
            <div>
              <h1 className="page-heading">Admissions Dashboard</h1>
              {currentUser.role === "hod" && (
                <p className="text-sm text-gray-500 font-poppins mt-1">{currentUser.department}</p>
              )}
            </div>
            {showNewFreshButton && (
              <Link href="/admissions/fresh/new" className="btn-primary">
                + New Fresh Admission
              </Link>
            )}
          </div>

          {/* Tabs (for Principal, Admin, admission_incharge) */}
          {showTabs && (
            <div className="flex gap-2 mb-6">
              <button
                onClick={() => setActiveTab("promotion")}
                className={`px-4 py-2 rounded-lg font-poppins text-sm font-medium transition-colors ${
                  activeTab === "promotion"
                    ? "bg-college-secondary text-white"
                    : "bg-white text-college-text border border-college-peach hover:bg-college-peach"
                }`}
              >
                Promotion ({promotionCount})
              </button>
              <button
                onClick={() => setActiveTab("fresh")}
                className={`px-4 py-2 rounded-lg font-poppins text-sm font-medium transition-colors ${
                  activeTab === "fresh"
                    ? "bg-college-secondary text-white"
                    : "bg-white text-college-text border border-college-peach hover:bg-college-peach"
                }`}
              >
                Fresh ({freshCount})
              </button>
            </div>
          )}

          {/* Department Filter (for Principal, Admin) */}
          {showDepartmentFilter && departments.length > 0 && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
                Filter by Department
              </label>
              <select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                className="input-field max-w-xs"
              >
                <option value="">All Departments</option>
                {departments.map((dept) => (
                  <option key={dept} value={dept}>
                    {dept}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* HOD VIEW - Promotion Forms */}
          {currentUser.role === "hod" && (
            <>
              {/* Promotion Forms Section */}
              <div className="mb-8">
                <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
                  Promotion Forms
                </h2>

                {/* Summary Cards for Promotion */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="card text-center">
                    <p className="text-2xl font-bold text-college-secondary font-poppins">{promotionForms.length}</p>
                    <p className="text-xs text-gray-500 font-poppins mt-1">Total</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-2xl font-bold text-blue-600 font-poppins">
                      {promotionForms.filter((f) => f.status === "in_progress").length}
                    </p>
                    <p className="text-xs text-gray-500 font-poppins mt-1">Pending</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-2xl font-bold text-green-600 font-poppins">
                      {promotionForms.filter((f) => f.status === "completed").length}
                    </p>
                    <p className="text-xs text-gray-500 font-poppins mt-1">Completed</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-2xl font-bold text-red-600 font-poppins">
                      {promotionForms.filter((f) => f.status === "rejected").length}
                    </p>
                    <p className="text-xs text-gray-500 font-poppins mt-1">Rejected</p>
                  </div>
                </div>

                {/* Promotion Table */}
                <div className="card">
                  {promotionForms.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 font-poppins text-center">
                      No promotion forms found.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="table-header">Student Name</th>
                            <th className="table-header">Section</th>
                            <th className="table-header">Semester</th>
                            <th className="table-header">Status</th>
                            <th className="table-header">Submitted Date</th>
                            <th className="table-header">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {promotionForms.map((form) => (
                            <tr key={form.id} className="table-row">
                              <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                                {form.student_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                                {form.section}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                                {form.current_semester} → {form.target_semester}
                              </td>
                              <td className="px-4 py-3">
                                <span className={getStatusBadgeClass(form.status)}>{form.status}</span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                                {formatDate(form.created_at)}
                              </td>
                              <td className="px-4 py-3">
                                <Link
                                  href={`/admissions/promote/${form.id}`}
                                  className="text-college-secondary text-xs font-poppins font-semibold hover:underline"
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
              </div>

              {/* Fresh Admission Forms Section */}
              <div>
                <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
                  Fresh Admission Forms
                </h2>

                {/* Summary Cards for Fresh */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                  <div className="card text-center">
                    <p className="text-2xl font-bold text-college-secondary font-poppins">{freshForms.length}</p>
                    <p className="text-xs text-gray-500 font-poppins mt-1">Total</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-2xl font-bold text-blue-600 font-poppins">
                      {freshForms.filter((f) => f.status === "in_progress").length}
                    </p>
                    <p className="text-xs text-gray-500 font-poppins mt-1">Pending</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-2xl font-bold text-green-600 font-poppins">
                      {freshForms.filter((f) => f.status === "completed").length}
                    </p>
                    <p className="text-xs text-gray-500 font-poppins mt-1">Completed</p>
                  </div>
                  <div className="card text-center">
                    <p className="text-2xl font-bold text-red-600 font-poppins">
                      {freshForms.filter((f) => f.status === "rejected").length}
                    </p>
                    <p className="text-xs text-gray-500 font-poppins mt-1">Rejected</p>
                  </div>
                </div>

                {/* Fresh Table */}
                <div className="card">
                  {freshForms.length === 0 ? (
                    <p className="text-sm text-gray-400 py-6 font-poppins text-center">
                      No fresh admission forms found.
                    </p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead>
                          <tr>
                            <th className="table-header">Student Name</th>
                            <th className="table-header">Section</th>
                            <th className="table-header">Target Semester</th>
                            <th className="table-header">Status</th>
                            <th className="table-header">Submitted Date</th>
                            <th className="table-header">Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {freshForms.map((form) => (
                            <tr key={form.id} className="table-row">
                              <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                                {form.student_name}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                                {form.section}
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                                Semester {form.target_semester}
                              </td>
                              <td className="px-4 py-3">
                                <span className={getStatusBadgeClass(form.status)}>{form.status}</span>
                              </td>
                              <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                                {formatDate(form.created_at)}
                              </td>
                              <td className="px-4 py-3">
                                <Link
                                  href={`/admissions/fresh/${form.id}`}
                                  className="text-college-secondary text-xs font-poppins font-semibold hover:underline"
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
              </div>
            </>
          )}

          {/* PRINCIPAL, ADMIN, ADMISSION_INCHARGE VIEW - Tabbed View */}
          {currentUser.role !== "hod" && (
            <>
              {/* Summary Cards */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="card text-center">
                  <p className="text-2xl font-bold text-college-secondary font-poppins">{totalCount}</p>
                  <p className="text-xs text-gray-500 font-poppins mt-1">Total</p>
                </div>
                <div className="card text-center">
                  <p className="text-2xl font-bold text-blue-600 font-poppins">{pendingCount}</p>
                  <p className="text-xs text-gray-500 font-poppins mt-1">Pending</p>
                </div>
                <div className="card text-center">
                  <p className="text-2xl font-bold text-green-600 font-poppins">{completedCount}</p>
                  <p className="text-xs text-gray-500 font-poppins mt-1">Completed</p>
                </div>
                <div className="card text-center">
                  <p className="text-2xl font-bold text-red-600 font-poppins">{rejectedCount}</p>
                  <p className="text-xs text-gray-500 font-poppins mt-1">Rejected</p>
                </div>
              </div>

              {/* Table */}
              <div className="card">
                {filteredForms.length === 0 ? (
                  <p className="text-sm text-gray-400 py-6 font-poppins text-center">
                    No admission forms found.
                  </p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="table-header">Student Name</th>
                          <th className="table-header">Department</th>
                          <th className="table-header">Section</th>
                          <th className="table-header">Semester</th>
                          <th className="table-header">Status</th>
                          <th className="table-header">Submitted Date</th>
                          <th className="table-header">Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredForms.map((form) => (
                          <tr key={form.id} className="table-row">
                            <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                              {form.student_name}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                              {form.department}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                              {form.section}
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                              {form.current_semester} → {form.target_semester}
                            </td>
                            <td className="px-4 py-3">
                              <span className={getStatusBadgeClass(form.status)}>{form.status}</span>
                            </td>
                            <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                              {formatDate(form.created_at)}
                            </td>
                            <td className="px-4 py-3">
                              <Link
                                href={
                                  form.form_type === "promotion"
                                    ? `/admissions/promote/${form.id}`
                                    : `/admissions/fresh/${form.id}`
                                }
                                className="text-college-secondary text-xs font-poppins font-semibold hover:underline"
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
            </>
          )}
        </main>

        <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
          © MGM University SOET | EduSphere AI
        </footer>
      </div>
    );
  }

  // ACCOUNTANT / LIBRARIAN VIEW
  if (currentUser.role === "accountant" || currentUser.role === "librarian") {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

        <main className="max-w-7xl mx-auto px-6 py-8">
          <div className="mb-6">
            <h1 className="page-heading">Pending Admission Forms</h1>
            <p className="text-sm text-gray-500 font-poppins mt-1">
              Forms requiring your action
            </p>
          </div>

          <div className="card">
            {forms.length === 0 ? (
              <p className="text-sm text-gray-400 py-6 font-poppins text-center">
                No pending admission forms.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="table-header">Student Name</th>
                      <th className="table-header">Department</th>
                      <th className="table-header">Form Type</th>
                      <th className="table-header">Status</th>
                      <th className="table-header">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {forms.map((form) => (
                      <tr key={form.id} className="table-row">
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {form.student_name}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                          {form.department}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-700 font-poppins capitalize">
                          {form.form_type}
                        </td>
                        <td className="px-4 py-3">
                          <span className={getStatusBadgeClass(form.status)}>{form.status}</span>
                        </td>
                        <td className="px-4 py-3">
                          <Link
                            href={
                              form.form_type === "promotion"
                                ? `/admissions/promote/${form.id}`
                                : `/admissions/fresh/${form.id}`
                            }
                            className="text-college-secondary text-xs font-poppins font-semibold hover:underline"
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
        </main>

        <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
          © MGM University SOET | EduSphere AI
        </footer>
      </div>
    );
  }

  return null;
}
