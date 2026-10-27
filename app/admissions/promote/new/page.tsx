"use client";

import { useState, useEffect, FormEvent } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import SignaturePad from "@/components/SignaturePad";

interface Student {
  email: string;
  full_name: string;
  department: string;
  section: string;
  current_year: number | null;
  current_semester: number | null;
  employee_id: string | null;
}

interface CurrentUser {
  email: string;
  role: string;
  full_name: string;
  department: string | null;
  section: string | null;
}

interface DocumentField {
  id: string;
  file: File | null;
  label: string;
}

export default function NewPromotionFormPage() {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // Section 1: Student Details
  const [selectedStudentEmail, setSelectedStudentEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [prnNo, setPrnNo] = useState("");
  const [program, setProgram] = useState("");
  const [mobile1, setMobile1] = useState("");
  const [mobile2, setMobile2] = useState("");
  const [email, setEmail] = useState("");

  // Section 2: Parents Details
  const [parentName, setParentName] = useState("");
  const [parentMobile1, setParentMobile1] = useState("");
  const [parentMobile2, setParentMobile2] = useState("");

  // Section 3: Academic Eligibility
  const [eligibleForYear, setEligibleForYear] = useState("");
  const [resultStatus, setResultStatus] = useState("");
  const [classTeacherRemark, setClassTeacherRemark] = useState("");

  // Section 4: Documents
  const [documents, setDocuments] = useState<DocumentField[]>([
    { id: crypto.randomUUID(), file: null, label: "" },
  ]);

  // Section 5: Student Declaration
  const [studentSignatureDataUrl, setStudentSignatureDataUrl] = useState<string | null>(null);

  // Store selected student for current_year and current_semester
  const [selectedStudentData, setSelectedStudentData] = useState<Student | null>(null);

  const todayFormatted = new Date().toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

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

        // Fetch current user's data
        const { data: userData } = await (supabase.from("users") as any)
          .select("email, role, full_name, department, section")
          .eq("email", userEmail)
          .single();

        if (!userData) {
          router.push("/login");
          return;
        }

        const userRole = userData.role;

        // Only faculty can create promotion forms
        if (userRole !== "faculty") {
          router.replace("/admissions");
          return;
        }

        setCurrentUser({
          email: userData.email,
          role: userData.role,
          full_name: userData.full_name,
          department: userData.department || null,
          section: userData.section || null,
        });

        // Fetch students from the same section and department
        const { data: studentsData } = await (supabase.from("users") as any)
          .select("email, full_name, department, section, current_year, current_semester, employee_id")
          .eq("role", "student")
          .eq("department", userData.department)
          .eq("section", userData.section)
          .order("full_name", { ascending: true });

        setStudents((studentsData ?? []) as Student[]);
        setLoading(false);
      } catch (err) {
        console.error("Auth check error:", err);
        router.push("/login");
      }
    };

    checkAuth();
  }, [router]);

  const handleStudentSelect = (studentEmail: string) => {
    setSelectedStudentEmail(studentEmail);
    const student = students.find((s) => s.email === studentEmail);
    
    if (student) {
      setSelectedStudentData(student);
      setFullName(student.full_name);
      setEmail(student.email);
      setPrnNo(student.employee_id || "");
      setProgram(student.department);
    } else {
      setSelectedStudentData(null);
    }
  };

  const handleAddDocument = () => {
    setDocuments([...documents, { id: crypto.randomUUID(), file: null, label: "" }]);
  };

  const handleRemoveDocument = (id: string) => {
    if (documents.length > 1) {
      setDocuments(documents.filter((doc) => doc.id !== id));
    }
  };

  const handleDocumentFileChange = (id: string, file: File | null) => {
    setDocuments(
      documents.map((doc) => (doc.id === id ? { ...doc, file } : doc))
    );
  };

  const handleDocumentLabelChange = (id: string, label: string) => {
    setDocuments(
      documents.map((doc) => (doc.id === id ? { ...doc, label } : doc))
    );
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError("");

    // Validation
    if (!fullName.trim()) {
      setError("Full Name is required.");
      return;
    }
    if (!prnNo.trim()) {
      setError("PRN No. is required.");
      return;
    }
    if (!email.trim()) {
      setError("Email ID is required.");
      return;
    }
    if (!eligibleForYear) {
      setError("Please select Eligible for Year.");
      return;
    }
    if (!resultStatus) {
      setError("Please select Result Status.");
      return;
    }

    const validDocuments = documents.filter((doc) => doc.file && doc.label.trim());
    if (validDocuments.length === 0) {
      setError("Please upload at least one document with a label.");
      return;
    }

    if (!studentSignatureDataUrl) {
      setError("Student signature is required.");
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

      // Step 1: Upload student signature
      const studentSigResponse = await fetch(studentSignatureDataUrl);
      const studentSigBlob = await studentSigResponse.blob();
      const studentSigPath = `admissions/${formId}/student-signature.png`;

      const { error: studentSigError } = await supabase.storage
        .from("signatures")
        .upload(studentSigPath, studentSigBlob);

      if (studentSigError) {
        console.error("Student signature upload error:", studentSigError);
        setError("Failed to upload student signature.");
        setSubmitting(false);
        return;
      }

      const { data: studentSigUrlData } = supabase.storage
        .from("signatures")
        .getPublicUrl(studentSigPath);

      const studentSignatureUrl = studentSigUrlData.publicUrl;

      // Step 2: Upload mark sheet files
      const uploadedDocs: { label: string; file_url: string }[] = [];

      for (const doc of validDocuments) {
        if (doc.file) {
          const fileName = `${Date.now()}_${doc.file.name}`;
          const filePath = `admissions/${formId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("admission-docs")
            .upload(filePath, doc.file);

          if (uploadError) {
            console.error("File upload error:", uploadError);
            setError(`Failed to upload file: ${doc.file.name}`);
            setSubmitting(false);
            return;
          }

          const { data: urlData } = supabase.storage
            .from("admission-docs")
            .getPublicUrl(filePath);

          uploadedDocs.push({
            label: doc.label.trim(),
            file_url: urlData.publicUrl,
          });
        }
      }

      // Step 3: Prepare remarks JSON
      const remarksData = {
        prn: prnNo.trim(),
        program: program.trim(),
        mobile1: mobile1.trim(),
        mobile2: mobile2.trim(),
        parent_name: parentName.trim(),
        parent_mobile1: parentMobile1.trim(),
        parent_mobile2: parentMobile2.trim(),
        eligible_for_year: eligibleForYear,
        result_status: resultStatus,
        class_teacher_name: currentUser?.full_name,
        class_teacher_remark: classTeacherRemark.trim(),
        student_signature_url: studentSignatureUrl,
        submission_date: new Date().toISOString(),
      };

      // Step 4: Insert into admission_forms
      const { error: formError } = await (supabase.from("admission_forms") as any).insert({
        id: formId,
        form_type: "promotion",
        student_email: email.trim(),
        student_name: fullName.trim(),
        department: currentUser?.department,
        section: currentUser?.section,
        current_year: selectedStudentData?.current_year || null,
        current_semester: selectedStudentData?.current_semester || null,
        target_semester: (selectedStudentData?.current_semester || 0) + 1,
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

      // Step 5: Insert documents
      for (const uploadedDoc of uploadedDocs) {
        const { error: docError } = await (supabase.from("admission_documents") as any).insert({
          form_id: formId,
          label: uploadedDoc.label,
          file_url: uploadedDoc.file_url,
          uploaded_by_email: currentUser?.email,
        });

        if (docError) {
          console.error("Document insert error:", docError);
        }
      }

      // Step 6: Insert admission steps
      const steps = [
        {
          form_id: formId,
          step_order: 1,
          step_name: "Class Teacher Eligibility Sign",
          required_role: "faculty",
          assigned_to_email: currentUser?.email,
          status: "pending",
        },
        {
          form_id: formId,
          step_order: 2,
          step_name: "In-HoD Verification & Sign",
          required_role: "hod",
          status: "pending",
        },
        {
          form_id: formId,
          step_order: 3,
          step_name: "Accounts — Fees Payment",
          required_role: "accountant",
          status: "pending",
        },
        {
          form_id: formId,
          step_order: 4,
          step_name: "Library — No Dues",
          required_role: "librarian",
          status: "pending",
        },
        {
          form_id: formId,
          step_order: 5,
          step_name: "Admin Dept. Final Sign",
          required_role: "admin",
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

      // Success - redirect to view page
      router.push(`/admissions/promote/${formId}`);
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
          <h1 className="page-heading">Regular Admission Form — Semester Promotion</h1>
          <p className="text-sm text-gray-500 font-poppins mt-1">
            MGM University School of Engineering & Technology
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* SECTION 1: STUDENT DETAILS */}
          <div className="card">
            <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
              1. Student Details
            </h2>

            <div className="space-y-4">
              {/* Select Existing Student Dropdown */}
              <div>
                <label htmlFor="selectStudent" className="label">
                  Select Existing Student (Auto-fill)
                </label>
                <select
                  id="selectStudent"
                  value={selectedStudentEmail}
                  onChange={(e) => handleStudentSelect(e.target.value)}
                  disabled={submitting}
                  className="input-field"
                >
                  <option value="">-- Select a student to auto-fill --</option>
                  {students.map((student) => (
                    <option key={student.email} value={student.email}>
                      {student.full_name} ({student.email})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="fullName" className="label">
                    Full Name of Student <span className="text-red-500">*</span>
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

                <div>
                  <label htmlFor="prnNo" className="label">
                    PRN No. <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    id="prnNo"
                    value={prnNo}
                    onChange={(e) => setPrnNo(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                    required
                  />
                </div>
              </div>

              <div>
                <label htmlFor="program" className="label">
                  Program
                </label>
                <input
                  type="text"
                  id="program"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  disabled={submitting}
                  className="input-field"
                  placeholder="e.g. B.Tech CSE (IoT)"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="mobile1" className="label">
                    Mobile Number i
                  </label>
                  <input
                    type="text"
                    id="mobile1"
                    value={mobile1}
                    onChange={(e) => setMobile1(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                    placeholder="Student mobile number"
                  />
                </div>

                <div>
                  <label htmlFor="mobile2" className="label">
                    Mobile Number ii
                  </label>
                  <input
                    type="text"
                    id="mobile2"
                    value={mobile2}
                    onChange={(e) => setMobile2(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                    placeholder="Alternate mobile number"
                  />
                </div>
              </div>

              <div>
                <label htmlFor="email" className="label">
                  Email ID <span className="text-red-500">*</span>
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
            </div>
          </div>

          {/* SECTION 2: PARENTS DETAILS */}
          <div className="card">
            <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
              2. Parents Details
            </h2>

            <div className="space-y-4">
              <div>
                <label htmlFor="parentName" className="label">
                  Name of Parents
                </label>
                <input
                  type="text"
                  id="parentName"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  disabled={submitting}
                  className="input-field"
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="parentMobile1" className="label">
                    Parents Mobile Number i
                  </label>
                  <input
                    type="text"
                    id="parentMobile1"
                    value={parentMobile1}
                    onChange={(e) => setParentMobile1(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                  />
                </div>

                <div>
                  <label htmlFor="parentMobile2" className="label">
                    Parents Mobile Number ii
                  </label>
                  <input
                    type="text"
                    id="parentMobile2"
                    value={parentMobile2}
                    onChange={(e) => setParentMobile2(e.target.value)}
                    disabled={submitting}
                    className="input-field"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: ACADEMIC ELIGIBILITY */}
          <div className="card">
            <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
              3. Academic Eligibility
            </h2>
            <p className="text-sm text-gray-500 font-poppins mb-4">
              (To be filled by Class Teacher & In-HoD)
            </p>

            <div className="space-y-6">
              {/* Eligible for Year */}
              <div>
                <label className="label">
                  Eligible for Next Year <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-6 mt-2">
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      name="eligibleForYear"
                      value="II Year"
                      checked={eligibleForYear === "II Year"}
                      onChange={(e) => setEligibleForYear(e.target.value)}
                      disabled={submitting}
                      className="w-4 h-4"
                    />
                    II Year
                  </label>
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      name="eligibleForYear"
                      value="III Year"
                      checked={eligibleForYear === "III Year"}
                      onChange={(e) => setEligibleForYear(e.target.value)}
                      disabled={submitting}
                      className="w-4 h-4"
                    />
                    III Year
                  </label>
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      name="eligibleForYear"
                      value="IV Year"
                      checked={eligibleForYear === "IV Year"}
                      onChange={(e) => setEligibleForYear(e.target.value)}
                      disabled={submitting}
                      className="w-4 h-4"
                    />
                    IV Year
                  </label>
                </div>
              </div>

              {/* Result Status */}
              <div>
                <label className="label">
                  Result Status <span className="text-red-500">*</span>
                </label>
                <div className="flex gap-6 mt-2">
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      name="resultStatus"
                      value="Pass"
                      checked={resultStatus === "Pass"}
                      onChange={(e) => setResultStatus(e.target.value)}
                      disabled={submitting}
                      className="w-4 h-4"
                    />
                    Pass
                  </label>
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      name="resultStatus"
                      value="ATKT"
                      checked={resultStatus === "ATKT"}
                      onChange={(e) => setResultStatus(e.target.value)}
                      disabled={submitting}
                      className="w-4 h-4"
                    />
                    ATKT
                  </label>
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      name="resultStatus"
                      value="Fail"
                      checked={resultStatus === "Fail"}
                      onChange={(e) => setResultStatus(e.target.value)}
                      disabled={submitting}
                      className="w-4 h-4"
                    />
                    Fail
                  </label>
                </div>
              </div>

              {/* Class Teacher Block */}
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-college-accent font-poppins mb-3">
                  Class Teacher
                </h3>
                <div className="space-y-2 text-sm font-poppins">
                  <p>
                    <strong>Name:</strong> {currentUser.full_name}
                  </p>
                  <p>
                    <strong>Date:</strong> {todayFormatted}
                  </p>
                  <div>
                    <label className="label">Remark (Optional)</label>
                    <textarea
                      value={classTeacherRemark}
                      onChange={(e) => setClassTeacherRemark(e.target.value)}
                      disabled={submitting}
                      className="input-field"
                      rows={2}
                      placeholder="Add any remarks..."
                    />
                  </div>
                  <p className="text-xs text-gray-600 italic mt-2">
                    Note: Your signature will be captured in the approval step
                  </p>
                </div>
              </div>

              {/* In-HoD Block - Placeholder */}
              <div className="bg-gray-100 border border-gray-300 rounded-lg p-4">
                <h3 className="text-sm font-semibold text-gray-600 font-poppins mb-3">
                  In-HoD (To be filled by HOD)
                </h3>
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-200 h-16 rounded flex items-center justify-center text-xs text-gray-500 font-poppins">
                    Signature
                  </div>
                  <div className="bg-gray-200 h-16 rounded flex items-center justify-center text-xs text-gray-500 font-poppins">
                    Date
                  </div>
                  <div className="bg-gray-200 h-16 rounded flex items-center justify-center text-xs text-gray-500 font-poppins">
                    Name
                  </div>
                  <div className="bg-gray-200 h-16 rounded flex items-center justify-center text-xs text-gray-500 font-poppins">
                    Remark
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 4: MARK SHEETS UPLOAD */}
          <div className="card">
            <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
              4. Previous Semester Documents
            </h2>

            <div className="space-y-4">
              {documents.map((doc, index) => (
                <div
                  key={doc.id}
                  className="bg-college-bg border border-college-peach rounded-lg p-4 space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-medium text-college-text font-poppins">
                      Document {index + 1}
                    </p>
                    {documents.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveDocument(doc.id)}
                        disabled={submitting}
                        className="text-red-500 text-sm font-poppins hover:text-red-700"
                      >
                        Remove
                      </button>
                    )}
                  </div>

                  <div>
                    <label className="label">Label</label>
                    <input
                      type="text"
                      value={doc.label}
                      onChange={(e) => handleDocumentLabelChange(doc.id, e.target.value)}
                      disabled={submitting}
                      className="input-field"
                      placeholder="e.g. Semester 3 Marksheet"
                    />
                  </div>

                  <div>
                    <label className="label">File (PDF, JPG, PNG)</label>
                    <input
                      type="file"
                      accept=".pdf,.jpg,.jpeg,.png"
                      onChange={(e) =>
                        handleDocumentFileChange(doc.id, e.target.files?.[0] || null)
                      }
                      disabled={submitting}
                      className="input-field"
                    />
                    {doc.file && (
                      <p className="text-xs text-gray-500 font-poppins mt-1">
                        Selected: {doc.file.name}
                      </p>
                    )}
                  </div>
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddDocument}
                disabled={submitting}
                className="btn-secondary"
              >
                + Add Another Document
              </button>
            </div>
          </div>

          {/* SECTION 5: STUDENT DECLARATION */}
          <div className="card">
            <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
              5. Declaration by Student
            </h2>

            <div className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <p className="text-sm font-poppins text-college-text leading-relaxed">
                  I hereby declare that the information given above is true and correct. I
                  shall abide by the rules and regulations of MGM University.
                </p>
              </div>

              <div>
                <label className="label">
                  Student Signature <span className="text-red-500">*</span>
                </label>
                <SignaturePad
                  onSave={(dataUrl) => setStudentSignatureDataUrl(dataUrl)}
                  disabled={submitting}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Date</label>
                  <input
                    type="text"
                    value={todayFormatted}
                    disabled
                    className="input-field bg-gray-100"
                  />
                </div>
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
              {submitting ? "Submitting Form..." : "Submit Promotion Form"}
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
