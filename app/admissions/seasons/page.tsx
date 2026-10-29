"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface CurrentUser {
  email: string;
  role: string;
  department: string | null;
  section: string | null;
}

interface Department {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
  department_id: string;
}

interface AdmissionSeason {
  id: string;
  department: string;
  section: string | null;
  academic_year: string;
  target_semester: number;
  status: string;
  opened_by_email: string;
  created_at: string;
  closed_at: string | null;
  student_count?: number;
}

export default function AdmissionSeasonsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Form state
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [selectedDeptId, setSelectedDeptId] = useState("");
  const [selectedDeptName, setSelectedDeptName] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSectionName, setSelectedSectionName] = useState("");
  const [academicYear, setAcademicYear] = useState("");
  const [targetSemester, setTargetSemester] = useState("");

  // Seasons data
  const [seasons, setSeasons] = useState<AdmissionSeason[]>([]);

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
          .select("email, role, department, section")
          .eq("email", userEmail)
          .single();

        if (!userData) {
          router.push("/login");
          return;
        }

        // Check role access
        if (!["faculty", "hod", "principal", "admission_incharge"].includes(userData.role)) {
          router.replace("/admissions");
          return;
        }

        setCurrentUser({
          email: userData.email,
          role: userData.role,
          department: userData.department || null,
          section: userData.section || null,
        });

        // Fetch departments
        const { data: deptData } = await (supabase.from("departments") as any).select("*");
        setDepartments((deptData || []) as Department[]);

        // For faculty: auto-select their department and section
        if (userData.role === "faculty" && userData.department) {
          const dept = (deptData || []).find((d: Department) => d.name === userData.department);
          if (dept) {
            setSelectedDeptId(dept.id);
            setSelectedDeptName(dept.name);
            
            // Fetch and select their section
            const { data: sectionData } = await (supabase.from("sections") as any)
              .select("*")
              .eq("department_id", dept.id);
            setSections((sectionData || []) as Section[]);
            
            if (userData.section) {
              const section = (sectionData || []).find((s: Section) => s.name === userData.section);
              if (section) {
                setSelectedSectionId(section.id);
                setSelectedSectionName(section.name);
              }
            }
          }
        }

        // For hod: auto-select their department
        if (userData.role === "hod" && userData.department) {
          const dept = (deptData || []).find((d: Department) => d.name === userData.department);
          if (dept) {
            setSelectedDeptId(dept.id);
            setSelectedDeptName(dept.name);
            
            // Fetch sections for their department
            const { data: sectionData } = await (supabase.from("sections") as any)
              .select("*")
              .eq("department_id", dept.id);
            setSections((sectionData || []) as Section[]);
          }
        }

        // Fetch seasons
        await fetchSeasons(supabase, userData.role, userData.department);

        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        router.push("/login");
      }
    };

    fetchData();
  }, [router]);

  const fetchSeasons = async (supabase: any, role: string, department: string | null) => {
    let query = (supabase.from("admission_seasons") as any).select("*").order("created_at", { ascending: false });

    // Filter for HOD and Faculty
    if ((role === "hod" || role === "faculty") && department) {
      query = query.eq("department", department);
    }

    const { data } = await query;
    const seasonsData = (data || []) as AdmissionSeason[];

    // For each season, fetch student count
    const seasonsWithCounts = await Promise.all(
      seasonsData.map(async (season) => {
        let countQuery = (supabase.from("users") as any)
          .select("email", { count: "exact", head: true })
          .eq("role", "student")
          .eq("department", season.department);

        // If season has a specific section, filter by it; otherwise all sections match
        if (season.section) {
          countQuery = countQuery.eq("section", season.section);
        }

        const { count } = await countQuery;
        return { ...season, student_count: count || 0 };
      })
    );

    setSeasons(seasonsWithCounts);
  };

  const handleDepartmentChange = async (deptId: string) => {
    setSelectedDeptId(deptId);
    const dept = departments.find((d) => d.id === deptId);
    setSelectedDeptName(dept?.name || "");
    setSelectedSectionId("");
    setSelectedSectionName("");

    if (deptId) {
      const supabase = createBrowserClient();
      const { data: sectionData } = await (supabase.from("sections") as any)
        .select("*")
        .eq("department_id", deptId);
      setSections((sectionData || []) as Section[]);
    } else {
      setSections([]);
    }
  };

  const handleSectionChange = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    const section = sections.find((s) => s.id === sectionId);
    setSelectedSectionName(section?.name || "");
  };

  const handleOpenSeason = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!currentUser || !selectedDeptName || !academicYear || !targetSemester) {
      alert("Please fill all required fields");
      return;
    }

    const semesterNum = parseInt(targetSemester);
    if (isNaN(semesterNum) || semesterNum < 1 || semesterNum > 8) {
      alert("Target semester must be between 1 and 8");
      return;
    }

    setActionLoading(true);

    try {
      const supabase = createBrowserClient();

      await (supabase.from("admission_seasons") as any).insert({
        department: selectedDeptName,
        section: selectedSectionName || null,
        academic_year: academicYear,
        target_semester: semesterNum,
        opened_by_email: currentUser.email,
        status: "open",
      });

      // Reset form
      setSelectedDeptId("");
      setSelectedDeptName("");
      setSelectedSectionId("");
      setSelectedSectionName("");
      setAcademicYear("");
      setTargetSemester("");
      setSections([]);

      // Reload seasons
      await fetchSeasons(supabase, currentUser.role, currentUser.department);

      setActionLoading(false);
    } catch (err) {
      console.error("Open season error:", err);
      alert("Failed to open admission season");
      setActionLoading(false);
    }
  };

  const handleCloseSeason = async (seasonId: string) => {
    if (!confirm("Are you sure you want to close this admission season?")) {
      return;
    }

    setActionLoading(true);

    try {
      const supabase = createBrowserClient();

      await (supabase.from("admission_seasons") as any)
        .update({ status: "closed", closed_at: new Date().toISOString() })
        .eq("id", seasonId);

      // Reload seasons
      if (currentUser) {
        await fetchSeasons(supabase, currentUser.role, currentUser.department);
      }

      setActionLoading(false);
    } catch (err) {
      console.error("Close season error:", err);
      alert("Failed to close season");
      setActionLoading(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, "0");
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();
    return `${day}/${month}/${year}`;
  };

  const getStatusBadgeClass = (status: string) => {
    return status === "open"
      ? "bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold"
      : "bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold";
  };

  const canOpenSeason = currentUser && ["faculty", "hod", "principal", "admission_incharge"].includes(currentUser.role);
  const canCloseSeason = currentUser && ["faculty", "hod", "principal", "admission_incharge"].includes(currentUser.role);
  const isFaculty = currentUser?.role === "faculty";
  const isHod = currentUser?.role === "hod";

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

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">Admission Seasons</h1>
          <p className="text-sm text-gray-500 font-poppins mt-1">
            Manage admission periods for departments and sections
          </p>
        </div>

        {/* Section 1: Open New Season */}
        {canOpenSeason && (
          <div className="card mb-8">
            <h2 className="text-lg font-semibold text-college-accent font-poppins mb-4">
              Open Admissions for a Section
            </h2>

            <form onSubmit={handleOpenSeason} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Department */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                    Department *
                  </label>
                  <select
                    value={selectedDeptId}
                    onChange={(e) => handleDepartmentChange(e.target.value)}
                    className="input-field"
                    required
                    disabled={isFaculty || isHod}
                  >
                    <option value="">Select Department</option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                  {(isFaculty || isHod) && (
                    <p className="text-xs text-gray-500 mt-1 font-poppins">
                      Auto-filled with your department
                    </p>
                  )}
                </div>

                {/* Section */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                    Section {!isFaculty && "(optional)"}
                  </label>
                  <select
                    value={selectedSectionId}
                    onChange={(e) => handleSectionChange(e.target.value)}
                    className="input-field"
                    required={isFaculty}
                    disabled={!selectedDeptId || isFaculty}
                  >
                    <option value="">All Sections</option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                  {isFaculty && (
                    <p className="text-xs text-gray-500 mt-1 font-poppins">
                      Auto-filled with your section
                    </p>
                  )}
                  {!isFaculty && (
                    <p className="text-xs text-gray-500 mt-1 font-poppins">
                      Leave blank to apply to all sections
                    </p>
                  )}
                </div>

                {/* Academic Year */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                    Academic Year *
                  </label>
                  <input
                    type="text"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                    placeholder="e.g. 2025-26"
                    className="input-field"
                    required
                  />
                </div>

                {/* Target Semester */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                    Target Semester *
                  </label>
                  <input
                    type="number"
                    value={targetSemester}
                    onChange={(e) => setTargetSemester(e.target.value)}
                    placeholder="1-8"
                    min="1"
                    max="8"
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={actionLoading}
                className="btn-primary disabled:opacity-50"
              >
                {actionLoading ? "Opening..." : "Open Admissions"}
              </button>
            </form>
          </div>
        )}

        {/* Section 2: Active Seasons */}
        <div className="card">
          <h2 className="text-lg font-semibold text-college-accent font-poppins mb-4">
            Active Seasons
          </h2>

          {seasons.length === 0 ? (
            <p className="text-sm text-gray-400 py-6 font-poppins text-center">
              No admission seasons found.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr>
                    <th className="table-header">Department</th>
                    <th className="table-header">Section</th>
                    <th className="table-header">Academic Year</th>
                    <th className="table-header">Target Semester</th>
                    <th className="table-header">Students in Scope</th>
                    <th className="table-header">Status</th>
                    <th className="table-header">Opened By</th>
                    <th className="table-header">Opened Date</th>
                    <th className="table-header">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {seasons.map((season) => (
                    <tr key={season.id} className="table-row">
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        {season.department}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        {season.section || "All Sections"}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        {season.academic_year}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        Semester {season.target_semester}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        {season.student_count !== undefined ? season.student_count : "—"} students
                      </td>
                      <td className="px-4 py-3">
                        <span className={getStatusBadgeClass(season.status)}>
                          {season.status}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        {season.opened_by_email}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-700 font-poppins">
                        {formatDate(season.created_at)}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {season.status === "open" && canCloseSeason && (
                            <button
                              onClick={() => handleCloseSeason(season.id)}
                              disabled={actionLoading}
                              className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-poppins font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                            >
                              Close
                            </button>
                          )}
                          <Link
                            href={`/admissions?season=${season.id}`}
                            className="bg-blue-500 text-white px-3 py-1 rounded-lg text-xs font-poppins font-semibold hover:bg-blue-600 transition-colors"
                          >
                            View Forms
                          </Link>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
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
