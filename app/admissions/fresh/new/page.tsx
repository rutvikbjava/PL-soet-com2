"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { sendNotification } from "@/lib/notify";

interface CurrentUser {
  email: string;
  role: string;
  full_name: string;
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

export default function NewFreshAdmissionPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Section 1: Personal Details
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [dob, setDob] = useState("");
  const [gender, setGender] = useState("");
  const [address, setAddress] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [pincode, setPincode] = useState("");

  // Section 2: Admission Type
  const [admissionType, setAdmissionType] = useState<"first_year" | "direct_second_year" | "">("first_year");
  
  // First Year fields
  const [boardName, setBoardName] = useState("");
  const [physics, setPhysics] = useState(false);
  const [chemistry, setChemistry] = useState(false);
  const [mathematics, setMathematics] = useState(false);
  const [biology, setBiology] = useState(false);
  const [twelfthPercentage, setTwelfthPercentage] = useState("");

  // Direct Second Year fields
  const [diplomaBranch, setDiplomaBranch] = useState("");
  const [diplomaCgpa, setDiplomaCgpa] = useState("");

  // Section 3: CET Status
  const [cetStatus, setCetStatus] = useState<"state_cet" | "none" | "">("state_cet");
  const [cetScore, setCetScore] = useState("");
  const [cetExamName, setCetExamName] = useState("");

  // Section 4: Department & Section
  const [selectedDepartmentId, setSelectedDepartmentId] = useState("");
  const [selectedDepartmentName, setSelectedDepartmentName] = useState("");
  const [selectedSectionId, setSelectedSectionId] = useState("");
  const [selectedSectionName, setSelectedSectionName] = useState("");

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

        // Fetch current user
        const { data: userData } = await (supabase.from("users") as any)
          .select("email, role, full_name")
          .eq("email", userEmail)
          .single();

        if (!userData) {
          router.push("/login");
          return;
        }

        // Only admission_incharge can access
        if (userData.role !== "admission_incharge") {
          router.replace("/admissions");
          return;
        }

        setCurrentUser({
          email: userData.email,
          role: userData.role,
          full_name: userData.full_name,
        });

        // Fetch departments
        const { data: deptData } = await (supabase.from("departments") as any)
          .select("*")
          .order("name", { ascending: true });

        setDepartments((deptData ?? []) as Department[]);

        setLoading(false);
      } catch (err) {
        console.error("Auth check error:", err);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  // Load sections when department changes
  useEffect(() => {
    const loadSections = async () => {
      if (!selectedDepartmentId) {
        setSections([]);
        setSelectedSectionId("");
        setSelectedSectionName("");
        return;
      }

      try {
        const supabase = createBrowserClient();
        const { data: sectionData } = await (supabase.from("sections") as any)
          .select("*")
          .eq("department_id", selectedDepartmentId)
          .order("name", { ascending: true });

        setSections((sectionData ?? []) as Section[]);
        setSelectedSectionId("");
        setSelectedSectionName("");
      } catch (err) {
        console.error("Load sections error:", err);
        setSections([]);
      }
    };

    loadSections();
  }, [selectedDepartmentId]);

  const handleDepartmentChange = (deptId: string) => {
    setSelectedDepartmentId(deptId);
    const dept = departments.find((d) => d.id === deptId);
    setSelectedDepartmentName(dept?.name || "");
  };

  const handleSectionChange = (sectionId: string) => {
    setSelectedSectionId(sectionId);
    const section = sections.find((s) => s.id === sectionId);
    setSelectedSectionName(section?.name || "");
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!fullName.trim()) {
      setError("Full Name is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email is required.");
      return;
    }
    if (!admissionType) {
      setError("Please select Admission Type.");
      return;
    }
    if (admissionType === "first_year") {
      if (!physics || !chemistry || !mathematics) {
        setError("Physics, Chemistry, and Mathematics are mandatory for engineering admission.");
        return;
      }
    }
    if (admissionType === "direct_second_year") {
      if (diplomaCgpa && parseFloat(diplomaCgpa) < 6.0) {
        setError("Minimum CGPA of 6.00 required for lateral entry.");
        return;
      }
    }
    if (!cetStatus) {
      setError("Please select CET Status.");
      return;
    }
    if (!selectedDepartmentId) {
      setError("Please select Department.");
      return;
    }
    if (!selectedSectionId) {
      setError("Please select Section.");
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

      // Generate form ID
      const formId = crypto.randomUUID();

      // Build remarks JSON with all personal and academic details
      const remarksData = {
        full_name: fullName.trim(),
        phone: phone.trim(),
        dob: dob,
        gender: gender,
        address: address.trim(),
        city: city.trim(),
        state: state.trim(),
        pincode: pincode.trim(),
        admission_type: admissionType,
        board_name: boardName.trim(),
        subjects: {
          physics,
          chemistry,
          mathematics,
          biology,
        },
        twelfth_percentage: twelfthPercentage,
        diploma_branch: diplomaBranch.trim(),
        diploma_cgpa: diplomaCgpa,
        cet_status: cetStatus,
        cet_exam_name: cetExamName.trim(),
        submission_date: new Date().toISOString(),
      };

      // Insert admission_forms
      const { error: formError } = await (supabase.from("admission_forms") as any).insert({
        id: formId,
        form_type: "fresh",
        student_email: email.trim(),
        student_name: fullName.trim(),
        department: selectedDepartmentName,
        section: selectedSectionName,
        current_year: admissionType === "first_year" ? 1 : 2,
        current_semester: admissionType === "first_year" ? 1 : 3,
        target_semester: admissionType === "first_year" ? 1 : 3,
        status: "in_progress",
        created_by_email: currentUser?.email,
        remarks: JSON.stringify(remarksData),
      });

      if (formError) {
        console.error("Form insert error:", formError);
        setError("Failed to create admission form.");
        setSubmitting(false);
        return;
      }

      // Insert CET records
      const { error: cetError } = await (supabase.from("cet_records") as any).insert({
        form_id: formId,
        student_email: email.trim(),
        cet_type: cetStatus === "state_cet" ? cetExamName.trim() || "State CET" : "none",
        cet_score: cetStatus === "state_cet" && cetScore ? parseFloat(cetScore) : null,
        cet_passed: cetStatus === "state_cet",
        notes: cetStatus === "state_cet" ? "Exempt from MGMU CET" : "Must appear in MGMU CET",
      });

      if (cetError) {
        console.error("CET record insert error:", cetError);
      }

      // Insert admission steps
      const steps = [
        {
          form_id: formId,
          step_order: 1,
          step_name: "CET Verification & Eligibility Check",
          required_role: "admission_incharge",
          status: "pending",
        },
        {
          form_id: formId,
          step_order: 2,
          step_name: "Seat Allotment",
          required_role: "admission_incharge",
          status: "pending",
        },
        {
          form_id: formId,
          step_order: 3,
          step_name: "Fee Payment Recording",
          required_role: "accountant",
          status: "pending",
        },
        {
          form_id: formId,
          step_order: 4,
          step_name: "Document Verification & Accountant Sign",
          required_role: "accountant",
          status: "pending",
        },
        {
          form_id: formId,
          step_order: 5,
          step_name: "Administrative Admission Confirmation",
          required_role: "admin",
          status: "pending",
        },
        {
          form_id: formId,
          step_order: 6,
          step_name: "HOD Department Enrolment",
          required_role: "hod",
          status: "pending",
        },
      ];

      const { error: stepsError } = await (supabase.from("admission_steps") as any).insert(steps);

      if (stepsError) {
        console.error("Steps insert error:", stepsError);
        setError("Failed to create workflow steps.");
        setSubmitting(false);
        return;
      }

      // #10 Notify Step 1 approver (admission_incharge) after form submission
      try {
        const { data: admissionIncharge } = await (supabase.from("users") as any)
          .select("email")
          .eq("role", "admission_incharge")
          .limit(1);
        
        if (admissionIncharge && admissionIncharge.length > 0) {
          await sendNotification(
            admissionIncharge[0].email,
            "Fresh Admission Form Submitted — CET Verification Required",
            `${fullName.trim()} has submitted a fresh admission form for ${selectedDepartmentName}. CET verification and eligibility check required.`,
            "all"
          );
        }
      } catch (notifError) {
        console.error("[Fresh Admission Submit] Notification failed (non-fatal):", notifError);
      }

      // Success - redirect
      router.push(`/admissions/fresh/${formId}`);
    } catch (err) {
      console.error("Submit error:", err);
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

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/admissions"
          className="text-college-secondary text-sm font-poppins mb-4 inline-block hover:underline"
        >
          ← Back to Admissions
        </Link>

        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">New Fresh Admission</h1>
          <p className="text-sm text-gray-500 font-poppins mt-1">
            Register a new applicant and start admission process
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1 — PERSONAL DETAILS */}
          <div className="card">
            <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
              1. Applicant Personal Details
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="fullName" className="label">
                  Full Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="fullName"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  disabled={submitting}
                  className="input-field"
                  required
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="email" className="label">
                    Email <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="email"
                    id="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                    required
                  />
                </div>

                <div>
                  <label htmlFor="phone" className="label">
                    Phone
                  </label>
                  <input
                    type="text"
                    id="phone"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="dob" className="label">
                    Date of Birth
                  </label>
                  <input
                    type="date"
                    id="dob"
                    value={dob}
                    onChange={(e) => setDob(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="gender" className="label">
                    Gender
                  </label>
                  <select
                    id="gender"
                    value={gender}
                    onChange={(e) => setGender(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                  >
                    <option value="">Select gender</option>
                    <option value="Male">Male</option>
                    <option value="Female">Female</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label htmlFor="address" className="label">
                  Address
                </label>
                <textarea
                  id="address"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  disabled={submitting}
                  className="input-field"
                  rows={3}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label htmlFor="city" className="label">
                    City
                  </label>
                  <input
                    type="text"
                    id="city"
                    value={city}
                    onChange={(e) => setCity(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="state" className="label">
                    State
                  </label>
                  <input
                    type="text"
                    id="state"
                    value={state}
                    onChange={(e) => setState(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="pincode" className="label">
                    Pincode
                  </label>
                  <input
                    type="text"
                    id="pincode"
                    value={pincode}
                    onChange={(e) => setPincode(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2 — ADMISSION TYPE */}
          <div className="card">
            <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
              2. Admission Type
            </h2>

            <div className="space-y-4">
              <div className="flex gap-6">
                <label className="flex items-center gap-2 font-poppins text-sm">
                  <input
                    type="radio"
                    name="admissionType"
                    value="first_year"
                    checked={admissionType === "first_year"}
                    onChange={(e) => setAdmissionType(e.target.value as "first_year")}
                    disabled={submitting}
                    className="w-4 h-4"
                  />
                  First Year (12th Pass)
                </label>
                <label className="flex items-center gap-2 font-poppins text-sm">
                  <input
                    type="radio"
                    name="admissionType"
                    value="direct_second_year"
                    checked={admissionType === "direct_second_year"}
                    onChange={(e) => setAdmissionType(e.target.value as "direct_second_year")}
                    disabled={submitting}
                    className="w-4 h-4"
                  />
                  Direct Second Year (Lateral / Diploma)
                </label>
              </div>

              {/* First Year Fields */}
              {admissionType === "first_year" && (
                <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div>
                    <label htmlFor="boardName" className="label">
                      12th Board Name
                    </label>
                    <input
                      type="text"
                      id="boardName"
                      value={boardName}
                      onChange={(e) => setBoardName(e.target.value)}
                      disabled={submitting}
                      className="input-field"
                      placeholder="e.g. Maharashtra State Board"
                    />
                  </div>

                  <div>
                    <label className="label">12th Subjects</label>
                    <div className="flex flex-wrap gap-4 mt-2">
                      <label className="flex items-center gap-2 font-poppins text-sm">
                        <input
                          type="checkbox"
                          checked={physics}
                          onChange={(e) => setPhysics(e.target.checked)}
                          disabled={submitting}
                          className="w-4 h-4"
                        />
                        Physics
                      </label>
                      <label className="flex items-center gap-2 font-poppins text-sm">
                        <input
                          type="checkbox"
                          checked={chemistry}
                          onChange={(e) => setChemistry(e.target.checked)}
                          disabled={submitting}
                          className="w-4 h-4"
                        />
                        Chemistry
                      </label>
                      <label className="flex items-center gap-2 font-poppins text-sm">
                        <input
                          type="checkbox"
                          checked={mathematics}
                          onChange={(e) => setMathematics(e.target.checked)}
                          disabled={submitting}
                          className="w-4 h-4"
                        />
                        Mathematics
                      </label>
                      <label className="flex items-center gap-2 font-poppins text-sm">
                        <input
                          type="checkbox"
                          checked={biology}
                          onChange={(e) => setBiology(e.target.checked)}
                          disabled={submitting}
                          className="w-4 h-4"
                        />
                        Biology
                      </label>
                    </div>

                    {/* Warnings */}
                    {!physics && (
                      <p className="text-red-500 text-xs font-poppins mt-2">
                        ⚠ Physics is mandatory for engineering admission
                      </p>
                    )}
                    {!chemistry && (
                      <p className="text-red-500 text-xs font-poppins mt-2">
                        ⚠ Chemistry is mandatory for engineering admission
                      </p>
                    )}
                    {!mathematics && (
                      <p className="text-red-500 text-xs font-poppins mt-2">
                        ⚠ Mathematics is mandatory for engineering admission
                      </p>
                    )}
                  </div>

                  <div>
                    <label htmlFor="twelfthPercentage" className="label">
                      12th Percentage
                    </label>
                    <input
                      type="number"
                      id="twelfthPercentage"
                      value={twelfthPercentage}
                      onChange={(e) => setTwelfthPercentage(e.target.value)}
                      disabled={submitting}
                      className="input-field"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="e.g. 85.5"
                    />
                  </div>
                </div>
              )}

              {/* Direct Second Year Fields */}
              {admissionType === "direct_second_year" && (
                <div className="space-y-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div>
                    <label htmlFor="diplomaBranch" className="label">
                      Diploma Branch
                    </label>
                    <input
                      type="text"
                      id="diplomaBranch"
                      value={diplomaBranch}
                      onChange={(e) => setDiplomaBranch(e.target.value)}
                      disabled={submitting}
                      className="input-field"
                      placeholder="e.g. Computer Engineering"
                    />
                  </div>

                  <div>
                    <label htmlFor="diplomaCgpa" className="label">
                      Diploma CGPA (0-10)
                    </label>
                    <input
                      type="number"
                      id="diplomaCgpa"
                      value={diplomaCgpa}
                      onChange={(e) => setDiplomaCgpa(e.target.value)}
                      disabled={submitting}
                      className="input-field"
                      min="0"
                      max="10"
                      step="0.01"
                      placeholder="e.g. 7.5"
                    />
                    {diplomaCgpa && parseFloat(diplomaCgpa) < 6.0 && (
                      <p className="text-red-500 text-xs font-poppins mt-2">
                        ⚠ Minimum CGPA of 6.00 required for lateral entry
                      </p>
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 3 — CET STATUS */}
          <div className="card">
            <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
              3. CET Status
            </h2>

            <div className="space-y-4">
              <div className="flex gap-6">
                <label className="flex items-center gap-2 font-poppins text-sm">
                  <input
                    type="radio"
                    name="cetStatus"
                    value="state_cet"
                    checked={cetStatus === "state_cet"}
                    onChange={(e) => setCetStatus(e.target.value as "state_cet")}
                    disabled={submitting}
                    className="w-4 h-4"
                  />
                  Appeared in State CET (MHT-CET / JEE Main)
                </label>
                <label className="flex items-center gap-2 font-poppins text-sm">
                  <input
                    type="radio"
                    name="cetStatus"
                    value="none"
                    checked={cetStatus === "none"}
                    onChange={(e) => setCetStatus(e.target.value as "none")}
                    disabled={submitting}
                    className="w-4 h-4"
                  />
                  Not appeared in any CET
                </label>
              </div>

              {cetStatus === "state_cet" && (
                <div className="space-y-4 bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label htmlFor="cetExamName" className="label">
                        CET Exam Name
                      </label>
                      <input
                        type="text"
                        id="cetExamName"
                        value={cetExamName}
                        onChange={(e) => setCetExamName(e.target.value)}
                        disabled={submitting}
                        className="input-field"
                        placeholder="e.g. MHT-CET 2024"
                      />
                    </div>

                    <div>
                      <label htmlFor="cetScore" className="label">
                        CET Score
                      </label>
                      <input
                        type="number"
                        id="cetScore"
                        value={cetScore}
                        onChange={(e) => setCetScore(e.target.value)}
                        disabled={submitting}
                        className="input-field"
                        placeholder="Enter score"
                      />
                    </div>
                  </div>

                  <div className="bg-green-100 border border-green-300 rounded-lg p-3">
                    <p className="text-sm text-green-800 font-poppins">
                      ✓ Student is exempt from MGMU CET.
                    </p>
                  </div>
                </div>
              )}

              {cetStatus === "none" && (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 font-poppins">
                    ⚠ Student must appear in MGMU CET before seat allotment can proceed.
                  </p>
                </div>
              )}
            </div>
          </div>

          {/* SECTION 4 — DEPARTMENT & SECTION */}
          <div className="card">
            <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
              4. Department & Section
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="department" className="label">
                  Department <span className="text-red-500">*</span>
                </label>
                <select
                  id="department"
                  value={selectedDepartmentId}
                  onChange={(e) => handleDepartmentChange(e.target.value)}
                  disabled={submitting}
                  className="input-field"
                  required
                >
                  <option value="">Select department</option>
                  {departments.map((dept) => (
                    <option key={dept.id} value={dept.id}>
                      {dept.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label htmlFor="section" className="label">
                  Section <span className="text-red-500">*</span>
                </label>
                <select
                  id="section"
                  value={selectedSectionId}
                  onChange={(e) => handleSectionChange(e.target.value)}
                  disabled={submitting || !selectedDepartmentId}
                  className="input-field"
                  required
                >
                  <option value="">Select section</option>
                  {sections.map((section) => (
                    <option key={section.id} value={section.id}>
                      {section.name}
                    </option>
                  ))}
                </select>
                {!selectedDepartmentId && (
                  <p className="text-xs text-gray-400 font-poppins mt-1">
                    Please select a department first
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Error Message */}
          {error && (
            <div className="text-red-500 text-sm text-center font-poppins bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </div>
          )}

          {/* Submit Button */}
          <div className="flex gap-4">
            <button
              type="submit"
              disabled={submitting}
              className="btn-primary flex-1"
            >
              {submitting ? "Registering..." : "Register Applicant & Start Admission"}
            </button>
            <Link href="/admissions" className="btn-secondary">
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
