"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import SignaturePad from "@/components/SignaturePad";

interface Student {
  email: string;
  full_name: string;
  employee_id: string | null;
  department: string;
  section: string;
  current_year: number;
  current_semester: number;
  phone: string | null;
}

interface AdmissionSeason {
  id: string;
  department: string;
  section: string;
  academic_year: string;
  target_semester: number;
  status: string;
}

interface DocumentUpload {
  id: string;
  file: File | null;
  label: string;
}

export default function PromoteNewPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [student, setStudent] = useState<Student | null>(null);
  const [season, setSeason] = useState<AdmissionSeason | null>(null);
  const [noSeasonMessage, setNoSeasonMessage] = useState(false);

  // Form fields
  const [prnNo, setPrnNo] = useState("");
  const [program, setProgram] = useState("");
  const [mobile1, setMobile1] = useState("");
  const [mobile2, setMobile2] = useState("");
  const [parentName, setParentName] = useState("");
  const [parentMobile1, setParentMobile1] = useState("");
  const [parentMobile2, setParentMobile2] = useState("");
  const [eligibleForYear, setEligibleForYear] = useState("");
  const [resultStatus, setResultStatus] = useState("");
  const [documents, setDocuments] = useState<DocumentUpload[]>([
    { id: crypto.randomUUID(), file: null, label: "" },
  ]);
  const [studentSignature, setStudentSignature] = useState<string | null>(null);

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

        // Fetch current user (student)
        const { data: userData } = await (supabase.from("users") as any)
          .select("*")
          .eq("email", userEmail)
          .single();

        if (!userData) {
          router.push("/login");
          return;
        }

        // Check role access - only students
        if (userData.role !== "student") {
          router.replace("/admissions");
          return;
        }

        setStudent({
          email: userData.email,
          full_name: userData.full_name,
          employee_id: userData.employee_id || null,
          department: userData.department,
          section: userData.section,
          current_year: userData.current_year || 1,
          current_semester: userData.current_semester || 1,
          phone: userData.phone || null,
        });

        // Pre-fill form fields
        setPrnNo(userData.employee_id || "");
        setProgram(userData.department || "");
        setMobile1(userData.phone || "");

        // Auto-select eligible year
        const nextYear = (userData.current_year || 1) + 1;
        if (nextYear === 2) setEligibleForYear("II Year");
        else if (nextYear === 3) setEligibleForYear("III Year");
        else if (nextYear === 4) setEligibleForYear("IV Year");

        // Check if open season exists for this student's department and section
        const { data: seasonData } = await (supabase.from("admission_seasons") as any)
          .select("*")
          .eq("department", userData.department)
          .eq("status", "open");

        // Filter for matching section or null/empty section
        const matchingSeason = seasonData?.find(
          (season: any) =>
            season.section === userData.section ||
            season.section === null ||
            season.section === ""
        );

        if (!matchingSeason) {
          setNoSeasonMessage(true);
          setLoading(false);
          return;
        }

        setSeason(matchingSeason as AdmissionSeason);

        // Check if student already submitted a form for current semester
        const { data: existingForm } = await (supabase.from("admission_forms") as any)
          .select("*")
          .eq("student_email", userEmail)
          .eq("form_type", "promotion")
          .eq("current_semester", userData.current_semester)
          .single();

        if (existingForm) {
          router.replace(`/admissions/promote/${existingForm.id}`);
          return;
        }

        setLoading(false);
      } catch (err) {
        console.error("Fetch error:", err);
        router.push("/login");
      }
    };

    fetchData();
  }, [router]);

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

  const isFormValid = () => {
    const hasAtLeastOneDocument = documents.some((doc) => doc.file !== null && doc.label.trim() !== "");
    const hasSignature = studentSignature !== null;
    return hasAtLeastOneDocument && hasSignature;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!student || !season || !isFormValid()) {
      alert("Please complete all required fields, upload at least one document, and provide your signature.");
      return;
    }

    setSubmitting(true);

    try {
      const supabase = createBrowserClient();
      const formId = crypto.randomUUID();

      // Upload documents
      const documentUrls: Array<{ label: string; file_url: string }> = [];
      for (const doc of documents) {
        if (doc.file && doc.label.trim()) {
          const fileName = `${Date.now()}-${doc.file.name}`;
          const filePath = `admissions/${formId}/${fileName}`;

          const { error: uploadError } = await supabase.storage
            .from("admission-docs")
            .upload(filePath, doc.file);

          if (uploadError) {
            console.error("Document upload error:", uploadError);
            alert(`Failed to upload document: ${doc.label}`);
            setSubmitting(false);
            return;
          }

          const { data: urlData } = supabase.storage
            .from("admission-docs")
            .getPublicUrl(filePath);

          documentUrls.push({ label: doc.label, file_url: urlData.publicUrl });
        }
      }

      // Upload student signature
      let studentSignatureUrl = "";
      if (studentSignature) {
        const signatureBlob = await fetch(studentSignature).then((res) => res.blob());
        const signaturePath = `admissions/${formId}/student-signature.png`;

        const { error: sigError } = await supabase.storage
          .from("signatures")
          .upload(signaturePath, signatureBlob);

        if (sigError) {
          console.error("Signature upload error:", sigError);
          alert("Failed to upload signature");
          setSubmitting(false);
          return;
        }

        const { data: sigUrlData } = supabase.storage
          .from("signatures")
          .getPublicUrl(signaturePath);

        studentSignatureUrl = sigUrlData.publicUrl;
      }

      // Fetch faculty (class teacher) for step 1
      const { data: facultyData } = await (supabase.from("users") as any)
        .select("email, full_name")
        .eq("role", "faculty")
        .eq("section", student.section)
        .eq("department", student.department)
        .limit(1)
        .single();

      const facultyEmail = facultyData?.email || null;

      // Insert admission form
      const { error: formError } = await (supabase.from("admission_forms") as any).insert({
        id: formId,
        form_type: "promotion",
        student_email: student.email,
        student_name: student.full_name,
        department: student.department,
        section: student.section,
        current_year: student.current_year,
        current_semester: student.current_semester,
        target_semester: season.target_semester,
        status: "in_progress",
        created_by_email: student.email,
        remarks: JSON.stringify({
          prn: prnNo,
          program: program,
          mobile1: mobile1,
          mobile2: mobile2,
          parent_name: parentName,
          parent_mobile1: parentMobile1,
          parent_mobile2: parentMobile2,
          eligible_for_year: eligibleForYear,
          result_status: resultStatus,
          student_signature_url: studentSignatureUrl,
          submission_date: new Date().toISOString(),
          season_id: season.id,
          academic_year: season.academic_year,
        }),
      });

      if (formError) {
        console.error("Form insert error:", formError);
        alert("Failed to submit form");
        setSubmitting(false);
        return;
      }

      // Insert documents
      const documentInserts = documentUrls.map((doc) => ({
        form_id: formId,
        label: doc.label,
        file_url: doc.file_url,
        uploaded_by_email: student.email,
      }));

      if (documentInserts.length > 0) {
        await (supabase.from("admission_documents") as any).insert(documentInserts);
      }

      // Insert 5 steps
      const steps = [
        {
          form_id: formId,
          step_order: 1,
          step_name: "Class Teacher Eligibility Sign",
          required_role: "faculty",
          assigned_to_email: facultyEmail,
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

      await (supabase.from("admission_steps") as any).insert(steps);

      // Redirect to form detail page
      router.push(`/admissions/promote/${formId}`);
    } catch (err) {
      console.error("Submit error:", err);
      alert("An error occurred while submitting the form");
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

  if (!student) {
    return null;
  }

  if (noSeasonMessage) {
    return (
      <div className="min-h-screen bg-college-bg">
        <Navbar userEmail={student.email} userRole="student" />
        <main className="max-w-4xl mx-auto px-6 py-16">
          <div className="card text-center py-12">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-16 w-16 text-gray-300 mx-auto mb-4"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
              />
            </svg>
            <h2 className="text-xl font-semibold text-college-accent font-poppins mb-2">
              Admissions are not open for your section yet.
            </h2>
            <p className="text-gray-500 font-poppins">
              Please wait for your department to open the admission form.
            </p>
          </div>
        </main>
        <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
          © MGM University SOET | EduSphere AI
        </footer>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={student.email} userRole="student" />

      <main className="max-w-4xl mx-auto px-6 py-8">
        {/* Page Header */}
        <div className="mb-6">
          <h1 className="page-heading">
            Regular Admission Form — Academic Year {season?.academic_year}
          </h1>
          <p className="text-sm text-gray-500 font-poppins mt-1">
            Semester Promotion — {student.department}, Section {student.section}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Student Details */}
          <div className="card">
            <h2 className="text-lg font-semibold text-college-accent font-poppins mb-4">
              1. Student Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                  Full Name *
                </label>
                <input
                  type="text"
                  value={student.full_name}
                  readOnly
                  className="input-field bg-gray-50"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                  PRN No.
                </label>
                <input
                  type="text"
                  value={prnNo}
                  onChange={(e) => setPrnNo(e.target.value)}
                  className="input-field"
                  readOnly={!!student.employee_id}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                  Program *
                </label>
                <input
                  type="text"
                  value={program}
                  onChange={(e) => setProgram(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                  Mobile Number i *
                </label>
                <input
                  type="tel"
                  value={mobile1}
                  onChange={(e) => setMobile1(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                  Mobile Number ii
                </label>
                <input
                  type="tel"
                  value={mobile2}
                  onChange={(e) => setMobile2(e.target.value)}
                  className="input-field"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                  Email ID *
                </label>
                <input
                  type="email"
                  value={student.email}
                  readOnly
                  className="input-field bg-gray-50"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Parents Details */}
          <div className="card">
            <h2 className="text-lg font-semibold text-college-accent font-poppins mb-4">
              2. Parents Details
            </h2>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                  Name of Parents *
                </label>
                <input
                  type="text"
                  value={parentName}
                  onChange={(e) => setParentName(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                  Parents Mobile Number i *
                </label>
                <input
                  type="tel"
                  value={parentMobile1}
                  onChange={(e) => setParentMobile1(e.target.value)}
                  className="input-field"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                  Parents Mobile Number ii
                </label>
                <input
                  type="tel"
                  value={parentMobile2}
                  onChange={(e) => setParentMobile2(e.target.value)}
                  className="input-field"
                />
              </div>
            </div>
          </div>

          {/* Section 3: Academic Eligibility */}
          <div className="card">
            <h2 className="text-lg font-semibold text-college-accent font-poppins mb-2">
              3. Academic Eligibility
            </h2>
            <p className="text-xs text-gray-500 font-poppins mb-4">
              (To be verified by Class Teacher & In-HoD)
            </p>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
                  Eligible for Next Year *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      value="II Year"
                      checked={eligibleForYear === "II Year"}
                      onChange={(e) => setEligibleForYear(e.target.value)}
                      required
                    />
                    II Year
                  </label>
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      value="III Year"
                      checked={eligibleForYear === "III Year"}
                      onChange={(e) => setEligibleForYear(e.target.value)}
                      required
                    />
                    III Year
                  </label>
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      value="IV Year"
                      checked={eligibleForYear === "IV Year"}
                      onChange={(e) => setEligibleForYear(e.target.value)}
                      required
                    />
                    IV Year
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
                  Result Status *
                </label>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      value="Pass"
                      checked={resultStatus === "Pass"}
                      onChange={(e) => setResultStatus(e.target.value)}
                      required
                    />
                    Pass
                  </label>
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      value="ATKT"
                      checked={resultStatus === "ATKT"}
                      onChange={(e) => setResultStatus(e.target.value)}
                      required
                    />
                    ATKT
                  </label>
                  <label className="flex items-center gap-2 font-poppins text-sm">
                    <input
                      type="radio"
                      value="Fail"
                      checked={resultStatus === "Fail"}
                      onChange={(e) => setResultStatus(e.target.value)}
                      required
                    />
                    Fail
                  </label>
                </div>
              </div>

              <div className="bg-gray-100 border border-gray-300 rounded-lg p-3">
                <p className="text-xs text-gray-600 font-poppins">
                  ℹ️ Class Teacher and In-HoD signatures will be added during the approval process.
                </p>
              </div>
            </div>
          </div>

          {/* Section 4: Documents Upload */}
          <div className="card">
            <h2 className="text-lg font-semibold text-college-accent font-poppins mb-4">
              4. Previous Semester Mark Sheets
            </h2>

            <div className="space-y-4">
              {documents.map((doc, index) => (
                <div key={doc.id} className="border border-gray-200 rounded-lg p-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                        Document Label *
                      </label>
                      <input
                        type="text"
                        value={doc.label}
                        onChange={(e) => handleDocumentLabelChange(doc.id, e.target.value)}
                        placeholder="e.g. Semester 3 Marksheet"
                        className="input-field"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                        File (PDF, JPG, PNG) *
                      </label>
                      <input
                        type="file"
                        accept=".pdf,.jpg,.jpeg,.png"
                        onChange={(e) =>
                          handleDocumentFileChange(doc.id, e.target.files?.[0] || null)
                        }
                        className="input-field"
                      />
                    </div>
                  </div>

                  {documents.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveDocument(doc.id)}
                      className="mt-2 text-red-500 text-xs font-poppins hover:underline"
                    >
                      Remove Document
                    </button>
                  )}
                </div>
              ))}

              <button
                type="button"
                onClick={handleAddDocument}
                className="text-college-secondary text-sm font-poppins hover:underline"
              >
                + Add Another Document
              </button>
            </div>
          </div>

          {/* Section 5: Declaration */}
          <div className="card">
            <h2 className="text-lg font-semibold text-college-accent font-poppins mb-4">
              5. Declaration by Student
            </h2>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4">
              <p className="text-sm text-gray-700 font-poppins">
                I hereby declare that the information given above is true and correct. I shall
                abide by the rules and regulations of MGM University.
              </p>
            </div>

            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2 font-poppins">
                Student Signature *
              </label>
              <SignaturePad onSave={setStudentSignature} />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1 font-poppins">
                Date
              </label>
              <input
                type="text"
                value={new Date().toLocaleDateString("en-GB")}
                readOnly
                className="input-field bg-gray-50 max-w-xs"
              />
            </div>
          </div>

          {/* Submit Button */}
          <div className="flex justify-end">
            <button
              type="submit"
              disabled={!isFormValid() || submitting}
              className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {submitting ? "Submitting..." : "Submit Admission Form"}
            </button>
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
