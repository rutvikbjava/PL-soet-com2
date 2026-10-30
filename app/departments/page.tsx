"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";

interface Department {
  id: string;
  name: string;
  code: string | null;
  created_at: string;
}

interface Section {
  id: string;
  department_id: string;
  name: string;
  created_at: string;
}

interface User {
  id: string;
  email: string;
  full_name: string;
  role: string;
  department: string | null;
  section: string | null;
  status: string | null;
}

export default function DepartmentsPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<{ email: string; role: string } | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [selectedDepartment, setSelectedDepartment] = useState<Department | null>(null);
  const [sections, setSections] = useState<Section[]>([]);
  const [hodUsers, setHodUsers] = useState<User[]>([]);
  const [facultyUsers, setFacultyUsers] = useState<User[]>([]);
  const [studentUsers, setStudentUsers] = useState<User[]>([]);
  const [adminStaffUsers, setAdminStaffUsers] = useState<User[]>([]);
  const [unassignedUsers, setUnassignedUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);

  // Form states
  const [newDeptName, setNewDeptName] = useState("");
  const [newDeptCode, setNewDeptCode] = useState("");
  const [newSectionName, setNewSectionName] = useState("");

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
          .select("email, role")
          .eq("email", userEmail)
          .single();

        if (!userData) {
          router.push("/login");
          return;
        }

        const userRole = userData.role;

        // Only principal and admin can access
        if (userRole !== "principal" && userRole !== "admin") {
          router.replace("/dashboard");
          return;
        }

        setCurrentUser({ email: userData.email, role: userData.role });

        // Fetch departments
        await loadDepartments(supabase);

        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        router.push("/login");
      }
    };

    fetchData();
  }, [router]);

  const loadDepartments = async (supabase: any) => {
    const { data } = await (supabase.from("departments") as any)
      .select("*")
      .order("name", { ascending: true });

    setDepartments((data ?? []) as Department[]);
  };

  const loadDepartmentDetails = async (supabase: any, dept: Department) => {
    // Load sections
    const { data: sectionsData } = await (supabase.from("sections") as any)
      .select("*")
      .eq("department_id", dept.id)
      .order("name", { ascending: true });

    setSections((sectionsData ?? []) as Section[]);

    // Load HOD users
    const { data: hodData } = await (supabase.from("users") as any)
      .select("*")
      .eq("department", dept.name)
      .eq("role", "hod")
      .or("status.is.null,status.eq.active");

    setHodUsers((hodData ?? []) as User[]);

    // Load faculty users
    const { data: facultyData } = await (supabase.from("users") as any)
      .select("*")
      .eq("department", dept.name)
      .eq("role", "faculty")
      .or("status.is.null,status.eq.active");

    setFacultyUsers((facultyData ?? []) as User[]);

    // Load student users
    const { data: studentData } = await (supabase.from("users") as any)
      .select("*")
      .eq("department", dept.name)
      .eq("role", "student")
      .or("status.is.null,status.eq.active");

    setStudentUsers((studentData ?? []) as User[]);

    // Load admin/staff users (admin, accountant, librarian, admission_incharge)
    const { data: adminStaffData } = await (supabase.from("users") as any)
      .select("*")
      .eq("department", dept.name)
      .in("role", ["admin", "accountant", "librarian", "admission_incharge"])
      .or("status.is.null,status.eq.active");

    setAdminStaffUsers((adminStaffData ?? []) as User[]);

    // Load unassigned users (all roles except principal, coe)
    const { data: unassignedData } = await (supabase.from("users") as any)
      .select("*")
      .in("role", ["hod", "faculty", "student", "admin", "accountant", "librarian", "admission_incharge"])
      .or("department.is.null,department.eq.")
      .or("status.is.null,status.eq.active");

    setUnassignedUsers((unassignedData ?? []) as User[]);
  };

  const handleSelectDepartment = async (dept: Department) => {
    setSelectedDepartment(dept);
    const supabase = createBrowserClient();
    await loadDepartmentDetails(supabase, dept);
  };

  const handleAddDepartment = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newDeptName.trim()) {
      alert("Department name is required");
      return;
    }

    setActionLoading("add-dept");

    try {
      const supabase = createBrowserClient();

      await (supabase.from("departments") as any).insert({
        name: newDeptName.trim(),
        code: newDeptCode.trim() || null,
      });

      setNewDeptName("");
      setNewDeptCode("");
      await loadDepartments(supabase);
    } catch (err) {
      console.error("Add department error:", err);
      alert("Failed to add department");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAddSection = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!selectedDepartment) return;
    if (!newSectionName.trim()) {
      alert("Section name is required");
      return;
    }

    setActionLoading("add-section");

    try {
      const supabase = createBrowserClient();

      await (supabase.from("sections") as any).insert({
        department_id: selectedDepartment.id,
        name: newSectionName.trim(),
      });

      setNewSectionName("");
      await loadDepartmentDetails(supabase, selectedDepartment);
    } catch (err) {
      console.error("Add section error:", err);
      alert("Failed to add section");
    } finally {
      setActionLoading(null);
    }
  };

  const handleRemoveSection = async (sectionId: string) => {
    if (!selectedDepartment) return;

    if (!confirm("Are you sure you want to remove this section?")) {
      return;
    }

    setActionLoading(sectionId);

    try {
      const supabase = createBrowserClient();

      await (supabase.from("sections") as any).delete().eq("id", sectionId);

      await loadDepartmentDetails(supabase, selectedDepartment);
    } catch (err) {
      console.error("Remove section error:", err);
      alert("Failed to remove section");
    } finally {
      setActionLoading(null);
    }
  };

  const handleUnassignUser = async (userId: string) => {
    if (!selectedDepartment) return;

    setActionLoading(userId);

    try {
      const supabase = createBrowserClient();

      await (supabase.from("users") as any)
        .update({ department: null, section: null })
        .eq("id", userId);

      await loadDepartmentDetails(supabase, selectedDepartment);
    } catch (err) {
      console.error("Unassign user error:", err);
      alert("Failed to unassign user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleAssignUser = async (userId: string) => {
    if (!selectedDepartment) return;

    setActionLoading(userId);

    try {
      const supabase = createBrowserClient();

      await (supabase.from("users") as any)
        .update({ department: selectedDepartment.name })
        .eq("id", userId);

      await loadDepartmentDetails(supabase, selectedDepartment);
    } catch (err) {
      console.error("Assign user error:", err);
      alert("Failed to assign user");
    } finally {
      setActionLoading(null);
    }
  };

  const handleSectionChange = async (userId: string, sectionName: string) => {
    if (!selectedDepartment) return;

    setActionLoading(userId);

    try {
      const supabase = createBrowserClient();

      await (supabase.from("users") as any)
        .update({ section: sectionName })
        .eq("id", userId);

      await loadDepartmentDetails(supabase, selectedDepartment);
    } catch (err) {
      console.error("Update section error:", err);
      alert("Failed to update section");
    } finally {
      setActionLoading(null);
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

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

      <main className="max-w-7xl mx-auto px-6 py-8">
        <h1 className="page-heading mb-6">Departments</h1>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Department List */}
          <div className="card">
            <h2 className="section-heading">All Departments</h2>

            <div className="space-y-3 mb-6">
              {departments.length === 0 ? (
                <p className="text-sm text-gray-400 font-poppins text-center py-4">
                  No departments found.
                </p>
              ) : (
                departments.map((dept) => (
                  <div
                    key={dept.id}
                    className="border border-college-peach rounded-lg p-4 flex items-start justify-between hover:bg-college-bg transition-colors"
                  >
                    <div className="flex-1">
                      <h3 className="text-base font-semibold text-college-accent font-poppins">
                        {dept.name}
                      </h3>
                      {dept.code && (
                        <p className="text-xs text-gray-500 font-poppins mt-1">
                          Code: {dept.code}
                        </p>
                      )}
                    </div>
                    <button
                      onClick={() => handleSelectDepartment(dept)}
                      className={`px-4 py-1 rounded-lg text-xs font-poppins font-semibold transition-colors ${
                        selectedDepartment?.id === dept.id
                          ? "bg-college-secondary text-white"
                          : "bg-white border border-college-secondary text-college-secondary hover:bg-college-secondary hover:text-white"
                      }`}
                    >
                      {selectedDepartment?.id === dept.id ? "Selected" : "Select"}
                    </button>
                  </div>
                ))
              )}
            </div>

            {/* Add Department Form */}
            <div className="border-t border-college-peach pt-4">
              <h3 className="text-sm font-semibold text-college-accent font-poppins mb-3">
                Add New Department
              </h3>
              <form onSubmit={handleAddDepartment} className="space-y-3">
                <div>
                  <label className="label">Department Name</label>
                  <input
                    type="text"
                    value={newDeptName}
                    onChange={(e) => setNewDeptName(e.target.value)}
                    placeholder="e.g., Computer Science"
                    className="input-field"
                    required
                  />
                </div>
                <div>
                  <label className="label">Code (optional)</label>
                  <input
                    type="text"
                    value={newDeptCode}
                    onChange={(e) => setNewDeptCode(e.target.value)}
                    placeholder="e.g., CS"
                    className="input-field"
                  />
                </div>
                <button
                  type="submit"
                  disabled={actionLoading === "add-dept"}
                  className="btn-primary w-full disabled:opacity-50"
                >
                  {actionLoading === "add-dept" ? "Adding..." : "Add Department"}
                </button>
              </form>
            </div>
          </div>

          {/* Right Column - Department Detail */}
          <div className="card">
            {!selectedDepartment ? (
              <div className="text-center py-12">
                <p className="text-sm text-gray-400 font-poppins">
                  Select a department to view details
                </p>
              </div>
            ) : (
              <div>
                <h2 className="section-heading">{selectedDepartment.name}</h2>

                {/* Sections Sub-section */}
                <div className="mb-6">
                  <h3 className="text-base font-semibold text-college-accent font-poppins mb-3">
                    Sections
                  </h3>

                  {sections.length === 0 ? (
                    <p className="text-sm text-gray-400 font-poppins mb-3">
                      No sections found.
                    </p>
                  ) : (
                    <div className="space-y-2 mb-3">
                      {sections.map((section) => (
                        <div
                          key={section.id}
                          className="flex items-center justify-between border border-college-peach rounded-lg px-3 py-2"
                        >
                          <span className="text-sm text-college-text font-poppins">
                            {section.name}
                          </span>
                          <button
                            onClick={() => handleRemoveSection(section.id)}
                            disabled={actionLoading === section.id}
                            className="bg-red-500 text-white px-3 py-1 rounded-lg text-xs font-poppins font-semibold hover:bg-red-600 transition-colors disabled:opacity-50"
                          >
                            {actionLoading === section.id ? "..." : "Remove"}
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Add Section Form */}
                  <form onSubmit={handleAddSection} className="flex gap-2">
                    <input
                      type="text"
                      value={newSectionName}
                      onChange={(e) => setNewSectionName(e.target.value)}
                      placeholder="Section name"
                      className="input-field flex-1"
                    />
                    <button
                      type="submit"
                      disabled={actionLoading === "add-section"}
                      className="bg-college-secondary text-white px-4 py-2 rounded-lg text-sm font-poppins font-semibold hover:bg-college-secondary-dark transition-colors disabled:opacity-50"
                    >
                      {actionLoading === "add-section" ? "..." : "Add Section"}
                    </button>
                  </form>
                </div>

                {/* People Sub-section */}
                <div>
                  <h3 className="text-base font-semibold text-college-accent font-poppins mb-3">
                    People
                  </h3>

                  {/* HOD Group */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 font-poppins mb-2">
                      HOD
                    </h4>
                    {hodUsers.length === 0 ? (
                      <p className="text-xs text-gray-400 font-poppins mb-2">No HOD assigned.</p>
                    ) : (
                      <div className="overflow-x-auto mb-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-college-peach">
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Name
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Email
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Role
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Section
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {hodUsers.map((user) => (
                              <tr key={user.id} className="border-b border-college-peach">
                                <td className="px-2 py-2 text-xs font-poppins">
                                  {user.full_name}
                                </td>
                                <td className="px-2 py-2 text-xs font-poppins">{user.email}</td>
                                <td className="px-2 py-2 text-xs font-poppins capitalize">
                                  {user.role}
                                </td>
                                <td className="px-2 py-2 text-xs font-poppins">
                                  {user.section || "—"}
                                </td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => handleUnassignUser(user.id)}
                                    disabled={actionLoading === user.id}
                                    className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-poppins hover:bg-orange-600 transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === user.id ? "..." : "Unassign"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Faculty Group */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 font-poppins mb-2">
                      Faculty
                    </h4>
                    {facultyUsers.length === 0 ? (
                      <p className="text-xs text-gray-400 font-poppins mb-2">No faculty assigned.</p>
                    ) : (
                      <div className="overflow-x-auto mb-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-college-peach">
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Name
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Email
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Role
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Section
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {facultyUsers.map((user) => (
                              <tr key={user.id} className="border-b border-college-peach">
                                <td className="px-2 py-2 text-xs font-poppins">
                                  {user.full_name}
                                </td>
                                <td className="px-2 py-2 text-xs font-poppins">{user.email}</td>
                                <td className="px-2 py-2 text-xs font-poppins capitalize">
                                  {user.role}
                                </td>
                                <td className="px-2 py-2 text-xs font-poppins">
                                  {user.section || "—"}
                                </td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => handleUnassignUser(user.id)}
                                    disabled={actionLoading === user.id}
                                    className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-poppins hover:bg-orange-600 transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === user.id ? "..." : "Unassign"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Students Group */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 font-poppins mb-2">
                      Students
                    </h4>
                    {studentUsers.length === 0 ? (
                      <p className="text-xs text-gray-400 font-poppins mb-2">No students assigned.</p>
                    ) : (
                      <div className="overflow-x-auto mb-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-college-peach">
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Name
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Email
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Role
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Section
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {studentUsers.map((user) => (
                              <tr key={user.id} className="border-b border-college-peach">
                                <td className="px-2 py-2 text-xs font-poppins">
                                  {user.full_name}
                                </td>
                                <td className="px-2 py-2 text-xs font-poppins">{user.email}</td>
                                <td className="px-2 py-2 text-xs font-poppins capitalize">
                                  {user.role}
                                </td>
                                <td className="px-2 py-2 text-xs font-poppins">
                                  {user.section || "—"}
                                </td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => handleUnassignUser(user.id)}
                                    disabled={actionLoading === user.id}
                                    className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-poppins hover:bg-orange-600 transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === user.id ? "..." : "Unassign"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Admin/Staff Group */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 font-poppins mb-2">
                      Admin & Staff
                    </h4>
                    {adminStaffUsers.length === 0 ? (
                      <p className="text-xs text-gray-400 font-poppins mb-2">No admin/staff assigned.</p>
                    ) : (
                      <div className="overflow-x-auto mb-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-college-peach">
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Name
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Email
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Role
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Section
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {adminStaffUsers.map((user) => (
                              <tr key={user.id} className="border-b border-college-peach">
                                <td className="px-2 py-2 text-xs font-poppins">
                                  {user.full_name}
                                </td>
                                <td className="px-2 py-2 text-xs font-poppins">{user.email}</td>
                                <td className="px-2 py-2 text-xs font-poppins capitalize">
                                  {user.role.replace('_', ' ')}
                                </td>
                                <td className="px-2 py-2 text-xs font-poppins">
                                  {user.section || "—"}
                                </td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => handleUnassignUser(user.id)}
                                    disabled={actionLoading === user.id}
                                    className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-poppins hover:bg-orange-600 transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === user.id ? "..." : "Unassign"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>

                  {/* Unassigned Group */}
                  <div className="mb-4">
                    <h4 className="text-sm font-semibold text-gray-700 font-poppins mb-2">
                      Unassigned Users
                    </h4>
                    {unassignedUsers.length === 0 ? (
                      <p className="text-xs text-gray-400 font-poppins mb-2">
                        No unassigned users.
                      </p>
                    ) : (
                      <div className="overflow-x-auto mb-2">
                        <table className="w-full text-sm">
                          <thead>
                            <tr className="border-b border-college-peach">
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Name
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Email
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Role
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Section
                              </th>
                              <th className="text-left px-2 py-1 text-xs text-gray-600 font-poppins">
                                Actions
                              </th>
                            </tr>
                          </thead>
                          <tbody>
                            {unassignedUsers.map((user) => (
                              <tr key={user.id} className="border-b border-college-peach">
                                <td className="px-2 py-2 text-xs font-poppins">
                                  {user.full_name}
                                </td>
                                <td className="px-2 py-2 text-xs font-poppins">{user.email}</td>
                                <td className="px-2 py-2 text-xs font-poppins capitalize">
                                  {user.role}
                                </td>
                                <td className="px-2 py-2">
                                  {user.role === "faculty" || user.role === "student" ? (
                                    <select
                                      value={user.section || ""}
                                      onChange={(e) =>
                                        handleSectionChange(user.id, e.target.value)
                                      }
                                      disabled={actionLoading === user.id}
                                      className="text-xs border border-gray-300 rounded px-1 py-0.5 font-poppins disabled:opacity-50"
                                    >
                                      <option value="">Select section</option>
                                      {sections.map((section) => (
                                        <option key={section.id} value={section.name}>
                                          {section.name}
                                        </option>
                                      ))}
                                    </select>
                                  ) : (
                                    <span className="text-xs text-gray-400 font-poppins">—</span>
                                  )}
                                </td>
                                <td className="px-2 py-2">
                                  <button
                                    onClick={() => handleAssignUser(user.id)}
                                    disabled={actionLoading === user.id}
                                    className="bg-green-500 text-white px-2 py-1 rounded text-xs font-poppins hover:bg-green-600 transition-colors disabled:opacity-50"
                                  >
                                    {actionLoading === user.id ? "..." : "Assign here"}
                                  </button>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
