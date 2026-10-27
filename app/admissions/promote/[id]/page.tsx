"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import SignaturePad from "@/components/SignaturePad";
import jsPDF from "jspdf";

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
  completed_at: string | null;
  remarks: string | null;
}

interface RemarksData {
  prn?: string;
  program?: string;
  mobile1?: string;
  mobile2?: string;
  parent_name?: string;
  parent_mobile1?: string;
  parent_mobile2?: string;
  eligible_for_year?: string;
  result_status?: string;
  class_teacher_name?: string;
  class_teacher_remark?: string;
  student_signature_url?: string;
  submission_date?: string;
  final_pdf_url?: string;
}

interface AdmissionStep {
  id: string;
  form_id: string;
  step_order: number;
  step_name: string;
  required_role: string;
  assigned_to_email: string | null;
  status: string;
  signature_url: string | null;
  signed_at: string | null;
  comment: string | null;
  verified_name: string | null;
  verified_role: string | null;
}

interface AdmissionDocument {
  id: string;
  form_id: string;
  label: string;
  file_url: string;
  uploaded_by_email: string;
  created_at: string;
}

interface CurrentUser {
  email: string;
  role: string;
  full_name: string;
}

export default function PromotionFormDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState<AdmissionForm | null>(null);
  const [remarksData, setRemarksData] = useState<RemarksData>({});
  const [steps, setSteps] = useState<AdmissionStep[]>([]);
  const [documents, setDocuments] = useState<AdmissionDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);
  const [generatingPDF, setGeneratingPDF] = useState(false);

  // Sign-off state
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [liveTimestamp, setLiveTimestamp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Step 3 (Accountant) specific fields
  const [feesAmount, setFeesAmount] = useState("");
  const [receiptNumber, setReceiptNumber] = useState("");

  // Step 4 (Library) specific fields
  const [libraryStatus, setLibraryStatus] = useState("No Dues");
  const [duesAmount, setDuesAmount] = useState("");

  useEffect(() => {
    fetchData();
  }, [params.id]);

  // Live timestamp for verified block
  useEffect(() => {
    if (signatureDataUrl) {
      const interval = setInterval(() => {
        const now = new Date();
        const formatted = now.toLocaleString("en-US", {
          day: "2-digit",
          month: "short",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
          hour12: false,
        });
        setLiveTimestamp(formatted);
      }, 1000);

      return () => clearInterval(interval);
    }
  }, [signatureDataUrl]);

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
        .select("email, role, full_name")
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
      });

      // Fetch admission form
      const { data: formData, error: formError } = await (
        supabase.from("admission_forms") as any
      )
        .select("*")
        .eq("id", params.id)
        .single();

      if (formError || !formData) {
        setNotFound(true);
        setLoading(false);
        return;
      }

      setForm(formData as AdmissionForm);

      // Parse remarks
      try {
        const remarks = formData.remarks ? JSON.parse(formData.remarks) : {};
        setRemarksData(remarks);
      } catch (err) {
        console.error("Parse remarks error:", err);
        setRemarksData({});
      }

      // Fetch steps
      const { data: stepsData } = await (supabase.from("admission_steps") as any)
        .select("*")
        .eq("form_id", params.id)
        .order("step_order", { ascending: true });

      setSteps((stepsData ?? []) as AdmissionStep[]);

      // Find active step
      const activeStep = (stepsData ?? []).find(
        (s: AdmissionStep) => s.status === "pending"
      );
      if (activeStep) {
        setActiveStepId(activeStep.id);
      }

      // Fetch documents
      const { data: docsData } = await (
        supabase.from("admission_documents") as any
      )
        .select("*")
        .eq("form_id", params.id);

      setDocuments((docsData ?? []) as AdmissionDocument[]);

      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load form data.");
      setLoading(false);
    }
  };

  const handleViewDocument = async (fileUrl: string) => {
    try {
      const supabase = createBrowserClient();
      const urlParts = fileUrl.split("/storage/v1/object/public/admission-docs/");
      if (urlParts.length < 2) {
        window.open(fileUrl, "_blank");
        return;
      }
      const filePath = urlParts[1];

      const { data, error } = await supabase.storage
        .from("admission-docs")
        .createSignedUrl(filePath, 3600);

      if (error || !data) {
        window.open(fileUrl, "_blank");
        return;
      }

      window.open(data.signedUrl, "_blank");
    } catch (err) {
      window.open(fileUrl, "_blank");
    }
  };

  const generatePDF = async () => {
    if (!form || !remarksData) return;

    setGeneratingPDF(true);
    try {
      const doc = new jsPDF();
      const currentYear = new Date().getFullYear();
      let yPos = 20;

      // Header
      doc.setFontSize(16);
      doc.setFont("helvetica", "bold");
      doc.text("SCHOOL OF ENGINEERING & TECHNOLOGY", 105, yPos, { align: "center" });
      yPos += 8;
      doc.text("MGM UNIVERSITY", 105, yPos, { align: "center" });
      yPos += 10;

      doc.setFontSize(14);
      doc.text(`Regular Admission Form Academic Year ${currentYear}`, 105, yPos, { align: "center" });
      yPos += 7;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text("(For Higher Classes)", 105, yPos, { align: "center" });
      yPos += 15;

      // Section 1: Student Details
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("1. Student Details", 15, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Full Name: ${form.student_name}`, 20, yPos);
      yPos += 6;
      doc.text(`PRN No.: ${remarksData.prn || "N/A"}`, 20, yPos);
      yPos += 6;
      doc.text(`Program: ${remarksData.program || form.department}`, 20, yPos);
      yPos += 6;
      doc.text(`Mobile: i) ${remarksData.mobile1 || "N/A"}  ii) ${remarksData.mobile2 || "N/A"}`, 20, yPos);
      yPos += 6;
      doc.text(`Email: ${form.student_email}`, 20, yPos);
      yPos += 12;

      // Section 2: Parents Details
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("2. Parents Details", 15, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Name of Parents: ${remarksData.parent_name || "N/A"}`, 20, yPos);
      yPos += 6;
      doc.text(`Mobile: i) ${remarksData.parent_mobile1 || "N/A"}  ii) ${remarksData.parent_mobile2 || "N/A"}`, 20, yPos);
      yPos += 12;

      // Section 3: Academic Eligibility
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("3. Academic Eligibility", 15, yPos);
      yPos += 8;

      doc.setFontSize(10);
      doc.setFont("helvetica", "normal");
      doc.text(`Eligible for Next Year: ${remarksData.eligible_for_year || "N/A"}`, 20, yPos);
      yPos += 6;
      doc.text(`Result Status: ${remarksData.result_status || "N/A"}`, 20, yPos);
      yPos += 10;

      // Class Teacher & HOD signatures
      const step1 = steps.find((s) => s.step_order === 1);
      const step2 = steps.find((s) => s.step_order === 2);

      doc.text("Class Teacher:", 20, yPos);
      doc.text("In-HoD:", 110, yPos);
      yPos += 6;

      if (step1?.signature_url) {
        try {
          doc.addImage(step1.signature_url, "PNG", 20, yPos, 30, 15);
        } catch (e) {
          doc.text("[Signature]", 20, yPos + 7);
        }
      } else {
        doc.text("[Signature Pending]", 20, yPos + 7);
      }

      if (step2?.signature_url) {
        try {
          doc.addImage(step2.signature_url, "PNG", 110, yPos, 30, 15);
        } catch (e) {
          doc.text("[Signature]", 110, yPos + 7);
        }
      } else {
        doc.text("[Signature Pending]", 110, yPos + 7);
      }

      yPos += 18;
      doc.text(`Name: ${remarksData.class_teacher_name || "N/A"}`, 20, yPos);
      doc.text(`Name: ${step2?.verified_name || "N/A"}`, 110, yPos);
      yPos += 6;
      doc.text(`Date: ${step1?.signed_at ? formatDate(step1.signed_at) : "N/A"}`, 20, yPos);
      doc.text(`Date: ${step2?.signed_at ? formatDate(step2.signed_at) : "N/A"}`, 110, yPos);
      yPos += 12;

      // Section 4: Administrative Dept
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("4. Administrative Dept.", 15, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");

      const step3 = steps.find((s) => s.step_order === 3);
      const step4 = steps.find((s) => s.step_order === 4);
      const step5 = steps.find((s) => s.step_order === 5);

      doc.text("Sr. No. | Department      | Remarks             | Name", 20, yPos);
      yPos += 6;
      doc.text(`1       | Accounts        | ${step3?.comment?.substring(0, 20) || "N/A"} | ${step3?.verified_name || "N/A"}`, 20, yPos);
      yPos += 6;
      doc.text(`2       | Library         | ${step4?.comment?.substring(0, 20) || "N/A"} | ${step4?.verified_name || "N/A"}`, 20, yPos);
      yPos += 6;
      doc.text(`3       | Admin Dept.     | ${step5?.comment?.substring(0, 20) || "N/A"} | ${step5?.verified_name || "N/A"}`, 20, yPos);
      yPos += 12;

      // Section 5: Declaration
      doc.setFontSize(12);
      doc.setFont("helvetica", "bold");
      doc.text("5. Declaration by Student", 15, yPos);
      yPos += 8;

      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      doc.text("I hereby declare that the information given above is true and correct.", 20, yPos);
      yPos += 5;
      doc.text("I shall abide by the rules and regulations of MGM University.", 20, yPos);
      yPos += 10;

      if (remarksData.student_signature_url) {
        try {
          doc.addImage(remarksData.student_signature_url, "PNG", 20, yPos, 30, 15);
        } catch (e) {
          doc.text("[Student Signature]", 20, yPos + 7);
        }
      } else {
        doc.text("[Student Signature]", 20, yPos + 7);
      }

      yPos += 18;
      doc.text(`Date: ${remarksData.submission_date ? formatDate(remarksData.submission_date) : "N/A"}`, 20, yPos);

      // Footer
      yPos = 280;
      doc.setFontSize(8);
      doc.text("MGM University, Chhatrapati Sambhajinagar", 105, yPos, { align: "center" });

      // Save PDF
      const pdfFileName = `MGM-Admission-Form-${form.student_name.replace(/\s+/g, "-")}-Sem${form.target_semester}.pdf`;
      doc.save(pdfFileName);

      // Upload PDF to storage
      const pdfBlob = doc.output("blob");
      const supabase = createBrowserClient();
      const pdfPath = `admissions/${form.id}/final-form.pdf`;

      const { error: uploadError } = await supabase.storage
        .from("admission-docs")
        .upload(pdfPath, pdfBlob, { upsert: true });

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from("admission-docs")
          .getPublicUrl(pdfPath);

        // Update remarks with PDF URL
        const updatedRemarks = {
          ...remarksData,
          final_pdf_url: urlData.publicUrl,
        };

        await (supabase.from("admission_forms") as any)
          .update({ remarks: JSON.stringify(updatedRemarks) })
          .eq("id", form.id);

        setRemarksData(updatedRemarks);
      }

      setGeneratingPDF(false);
    } catch (err) {
      console.error("PDF generation error:", err);
      setError("Failed to generate PDF.");
      setGeneratingPDF(false);
    }
  };

  const handleApprove = async () => {
    if (!signatureDataUrl || !currentUser || !form) return;

    setSubmitting(true);
    setError("");

    try {
      const supabase = createBrowserClient();
      const activeStep = steps.find((s) => s.id === activeStepId);
      if (!activeStep) {
        setError("Active step not found.");
        setSubmitting(false);
        return;
      }

      // Build comment based on step
      let builtComment = comment.trim();
      if (activeStep.step_order === 3) {
        // Accountant step
        builtComment = `Fees Paid ₹${feesAmount || "0"} | Receipt: ${receiptNumber || "N/A"}`;
      } else if (activeStep.step_order === 4) {
        // Library step
        builtComment = libraryStatus === "No Dues" ? "No Dues" : `Dues ₹${duesAmount || "0"}`;
      }

      // Upload signature
      const response = await fetch(signatureDataUrl);
      const blob = await response.blob();
      const signatureFileName = `step${activeStep.step_order}-${currentUser.email}.png`;
      const signaturePath = `admissions/${form.id}/${signatureFileName}`;

      const { error: uploadError } = await supabase.storage
        .from("signatures")
        .upload(signaturePath, blob, { upsert: true });

      if (uploadError) {
        setError("Failed to upload signature.");
        setSubmitting(false);
        return;
      }

      const { data: urlData } = supabase.storage
        .from("signatures")
        .getPublicUrl(signaturePath);

      // Update step
      const { error: stepError } = await (supabase.from("admission_steps") as any)
        .update({
          status: "approved",
          signature_url: urlData.publicUrl,
          signed_at: new Date().toISOString(),
          comment: builtComment || null,
          verified_name: currentUser.full_name,
          verified_role: currentUser.role,
        })
        .eq("id", activeStep.id);

      if (stepError) {
        setError("Failed to update approval step.");
        setSubmitting(false);
        return;
      }

      // Step 3: Insert fee payment
      if (activeStep.step_order === 3 && feesAmount) {
        await (supabase.from("fee_payments") as any).insert({
          form_id: form.id,
          student_email: form.student_email,
          total_amount: parseFloat(feesAmount),
          paid_amount: parseFloat(feesAmount),
          payment_mode: "full",
          receipt_number: receiptNumber || null,
          payment_date: new Date().toISOString(),
          recorded_by_email: currentUser.email,
        });
      }

      // Step 5: Final step
      if (activeStep.step_order === 5) {
        // Update form to completed
        await (supabase.from("admission_forms") as any)
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", form.id);

        // Update student's semester
        await (supabase.from("users") as any)
          .update({
            current_semester: form.target_semester,
            current_year: Math.floor(((form.target_semester || 0) + 1) / 2),
          })
          .eq("email", form.student_email);

        // Generate PDF
        setTimeout(() => generatePDF(), 1000);
      }

      router.refresh();
      await fetchData();
      setComment("");
      setSignatureDataUrl(null);
      setFeesAmount("");
      setReceiptNumber("");
      setLibraryStatus("No Dues");
      setDuesAmount("");
      setSubmitting(false);
    } catch (err) {
      console.error("Approve error:", err);
      setError("An unexpected error occurred.");
      setSubmitting(false);
    }
  };

  const handleReject = async () => {
    if (!currentUser || !form) return;

    setSubmitting(true);
    setError("");

    try {
      const supabase = createBrowserClient();
      const activeStep = steps.find((s) => s.id === activeStepId);
      if (!activeStep) {
        setError("Active step not found.");
        setSubmitting(false);
        return;
      }

      await (supabase.from("admission_steps") as any)
        .update({
          status: "rejected",
          signed_at: new Date().toISOString(),
          comment: comment.trim() || null,
          verified_name: currentUser.full_name,
          verified_role: currentUser.role,
        })
        .eq("id", activeStep.id);

      await (supabase.from("admission_forms") as any)
        .update({ status: "rejected" })
        .eq("id", form.id);

      router.refresh();
      await fetchData();
      setComment("");
      setSignatureDataUrl(null);
      setSubmitting(false);
    } catch (err) {
      console.error("Reject error:", err);
      setError("An unexpected error occurred.");
      setSubmitting(false);
    }
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
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

  const canUserActOnStep = (step: AdmissionStep): boolean => {
    if (!currentUser) return false;
    if (step.required_role === "faculty" && currentUser.role === "faculty") {
      return step.assigned_to_email === currentUser.email;
    }
    return step.required_role === currentUser.role;
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case "draft":
        return "bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold";
      case "in_progress":
        return "bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-xs font-semibold";
      case "completed":
        return "bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold";
      case "rejected":
        return "bg-red-100 text-red-700 px-3 py-1 rounded-full text-xs font-semibold";
      default:
        return "bg-gray-100 text-gray-700 px-3 py-1 rounded-full text-xs font-semibold";
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-college-bg flex items-center justify-center">
        <p className="text-college-secondary font-poppins">Loading...</p>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-college-bg">
        {currentUser && (
          <Navbar userEmail={currentUser.email} userRole={currentUser.role} />
        )}
        <main className="max-w-4xl mx-auto px-6 py-8">
          <div className="card text-center py-12">
            <p className="text-gray-400 font-poppins text-lg">Form not found.</p>
            <Link href="/admissions" className="btn-secondary mt-4 inline-block">
              ← Back to Admissions
            </Link>
          </div>
        </main>
      </div>
    );
  }

  if (!currentUser || !form) {
    return null;
  }

  const currentYear = new Date().getFullYear();
  const step1 = steps.find((s) => s.step_order === 1);
  const step2 = steps.find((s) => s.step_order === 2);
  const step3 = steps.find((s) => s.step_order === 3);
  const step4 = steps.find((s) => s.step_order === 4);
  const step5 = steps.find((s) => s.step_order === 5);

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

      <main className="max-w-6xl mx-auto px-6 py-8">
        {/* Back Link */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href="/admissions"
            className="text-college-secondary text-sm font-poppins hover:underline"
          >
            ← Back to Admissions
          </Link>

          {form.status === "completed" && (
            <button
              onClick={generatePDF}
              disabled={generatingPDF}
              className="btn-primary"
            >
              {generatingPDF ? "Generating..." : "📄 Download Form as PDF"}
            </button>
          )}
        </div>

        {/* SECTION 1 — FORM PREVIEW */}
        <div className="card mb-6">
          {/* Header */}
          <div className="text-center border-b-2 border-college-accent pb-4 mb-6">
            <h1 className="text-xl font-bold text-college-accent font-poppins">
              SCHOOL OF ENGINEERING & TECHNOLOGY
            </h1>
            <h2 className="text-lg font-semibold text-college-accent font-poppins">
              MGM UNIVERSITY
            </h2>
            <p className="text-base font-medium text-college-text font-poppins mt-2">
              Regular Admission Form Academic Year {currentYear}
            </p>
            <p className="text-sm text-gray-600 font-poppins">(For Higher Classes)</p>
          </div>

          {/* Status Badge */}
          <div className="flex items-center justify-between mb-6">
            <span className={getStatusBadgeClass(form.status)}>
              {form.status.replace("_", " ").toUpperCase()}
            </span>
            <span className="text-sm font-poppins text-gray-600">
              Semester {form.current_semester} → {form.target_semester}
            </span>
          </div>

          {/* Section 1: Student Details */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-college-accent font-poppins mb-3 border-b border-college-peach pb-2">
              1. Student Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm font-poppins">
              <div>
                <span className="text-gray-600">Full Name:</span>{" "}
                <span className="font-medium">{form.student_name}</span>
              </div>
              <div>
                <span className="text-gray-600">PRN No.:</span>{" "}
                <span className="font-medium">{remarksData.prn || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-600">Program:</span>{" "}
                <span className="font-medium">{remarksData.program || form.department}</span>
              </div>
              <div>
                <span className="text-gray-600">Mobile i:</span>{" "}
                <span className="font-medium">{remarksData.mobile1 || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-600">Mobile ii:</span>{" "}
                <span className="font-medium">{remarksData.mobile2 || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-600">Email:</span>{" "}
                <span className="font-medium">{form.student_email}</span>
              </div>
            </div>
          </div>

          {/* Section 2: Parents Details */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-college-accent font-poppins mb-3 border-b border-college-peach pb-2">
              2. Parents Details
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm font-poppins">
              <div>
                <span className="text-gray-600">Name of Parents:</span>{" "}
                <span className="font-medium">{remarksData.parent_name || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-600">Mobile i:</span>{" "}
                <span className="font-medium">{remarksData.parent_mobile1 || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-600">Mobile ii:</span>{" "}
                <span className="font-medium">{remarksData.parent_mobile2 || "N/A"}</span>
              </div>
            </div>
          </div>

          {/* Section 3: Academic Eligibility */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-college-accent font-poppins mb-3 border-b border-college-peach pb-2">
              3. Academic Eligibility
            </h3>
            <div className="grid grid-cols-2 gap-4 text-sm font-poppins mb-4">
              <div>
                <span className="text-gray-600">Eligible for Next Year:</span>{" "}
                <span className="font-medium">{remarksData.eligible_for_year || "N/A"}</span>
              </div>
              <div>
                <span className="text-gray-600">Result Status:</span>{" "}
                <span className="font-medium">{remarksData.result_status || "N/A"}</span>
              </div>
            </div>

            {/* Class Teacher & In-HoD boxes */}
            <div className="grid grid-cols-2 gap-4">
              {/* Class Teacher */}
              <div className="border border-green-300 bg-green-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-college-accent font-poppins mb-2">
                  Class Teacher
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-600 font-poppins">Signature:</p>
                    {step1?.signature_url ? (
                      <img
                        src={step1.signature_url}
                        alt="Teacher signature"
                        className="max-h-12 mt-1 border border-gray-300 rounded"
                      />
                    ) : (
                      <div className="h-12 bg-gray-200 rounded flex items-center justify-center">
                        <p className="text-xs text-gray-500 font-poppins">Pending</p>
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-poppins">
                    <p><strong>Name:</strong> {remarksData.class_teacher_name || "N/A"}</p>
                    <p><strong>Date:</strong> {step1?.signed_at ? formatDate(step1.signed_at) : "N/A"}</p>
                    <p><strong>Remark:</strong> {remarksData.class_teacher_remark || "N/A"}</p>
                  </div>
                </div>
              </div>

              {/* In-HoD */}
              <div className="border border-blue-300 bg-blue-50 rounded-lg p-4">
                <p className="text-xs font-semibold text-college-accent font-poppins mb-2">
                  In-HoD
                </p>
                <div className="space-y-2">
                  <div>
                    <p className="text-xs text-gray-600 font-poppins">Signature:</p>
                    {step2?.signature_url ? (
                      <img
                        src={step2.signature_url}
                        alt="HOD signature"
                        className="max-h-12 mt-1 border border-gray-300 rounded"
                      />
                    ) : (
                      <div className="h-12 bg-gray-200 rounded flex items-center justify-center">
                        <p className="text-xs text-gray-500 font-poppins">Pending</p>
                      </div>
                    )}
                  </div>
                  <div className="text-xs font-poppins">
                    <p><strong>Name:</strong> {step2?.verified_name || "N/A"}</p>
                    <p><strong>Date:</strong> {step2?.signed_at ? formatDate(step2.signed_at) : "N/A"}</p>
                    <p><strong>Remark:</strong> {step2?.comment || "N/A"}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Section 4: Administrative Dept */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-college-accent font-poppins mb-3 border-b border-college-peach pb-2">
              4. Administrative Dept.
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-poppins">
                <thead className="bg-college-bg">
                  <tr>
                    <th className="border border-college-peach p-2 text-left">Sr.No.</th>
                    <th className="border border-college-peach p-2 text-left">Department</th>
                    <th className="border border-college-peach p-2 text-left">Remarks</th>
                    <th className="border border-college-peach p-2 text-left">Name</th>
                    <th className="border border-college-peach p-2 text-left">Sign. With Date</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-college-peach p-2">1</td>
                    <td className="border border-college-peach p-2">Accounts Section</td>
                    <td className="border border-college-peach p-2">{step3?.comment || "N/A"}</td>
                    <td className="border border-college-peach p-2">{step3?.verified_name || "N/A"}</td>
                    <td className="border border-college-peach p-2">
                      {step3?.signature_url && (
                        <img src={step3.signature_url} alt="Sig" className="max-h-8 inline-block mr-2" />
                      )}
                      {step3?.signed_at ? formatDate(step3.signed_at) : "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-college-peach p-2">2</td>
                    <td className="border border-college-peach p-2">Library</td>
                    <td className="border border-college-peach p-2">{step4?.comment || "N/A"}</td>
                    <td className="border border-college-peach p-2">{step4?.verified_name || "N/A"}</td>
                    <td className="border border-college-peach p-2">
                      {step4?.signature_url && (
                        <img src={step4.signature_url} alt="Sig" className="max-h-8 inline-block mr-2" />
                      )}
                      {step4?.signed_at ? formatDate(step4.signed_at) : "N/A"}
                    </td>
                  </tr>
                  <tr>
                    <td className="border border-college-peach p-2">3</td>
                    <td className="border border-college-peach p-2">Admin Dept.</td>
                    <td className="border border-college-peach p-2">{step5?.comment || "N/A"}</td>
                    <td className="border border-college-peach p-2">{step5?.verified_name || "N/A"}</td>
                    <td className="border border-college-peach p-2">
                      {step5?.signature_url && (
                        <img src={step5.signature_url} alt="Sig" className="max-h-8 inline-block mr-2" />
                      )}
                      {step5?.signed_at ? formatDate(step5.signed_at) : "N/A"}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>

          {/* Section 5: Declaration */}
          <div className="mb-6">
            <h3 className="text-base font-semibold text-college-accent font-poppins mb-3 border-b border-college-peach pb-2">
              5. Declaration by Student
            </h3>
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
              <p className="text-sm font-poppins text-college-text">
                I hereby declare that the information given above is true and correct. I shall abide by the rules and regulations of MGM University.
              </p>
            </div>
            <div className="flex items-center gap-6">
              <div>
                <p className="text-xs text-gray-600 font-poppins mb-1">Signature of Student:</p>
                {remarksData.student_signature_url ? (
                  <img
                    src={remarksData.student_signature_url}
                    alt="Student signature"
                    className="max-h-16 border border-gray-300 rounded"
                  />
                ) : (
                  <div className="w-32 h-16 bg-gray-200 rounded flex items-center justify-center">
                    <p className="text-xs text-gray-500 font-poppins">No signature</p>
                  </div>
                )}
              </div>
              <div>
                <p className="text-xs text-gray-600 font-poppins">Date:</p>
                <p className="text-sm font-medium font-poppins">
                  {remarksData.submission_date ? formatDate(remarksData.submission_date) : "N/A"}
                </p>
              </div>
            </div>
          </div>

          {/* Documents */}
          <div>
            <h3 className="text-base font-semibold text-college-accent font-poppins mb-3 border-b border-college-peach pb-2">
              Submitted Documents
            </h3>
            {documents.length === 0 ? (
              <p className="text-sm text-gray-400 font-poppins">No documents uploaded.</p>
            ) : (
              <div className="space-y-2">
                {documents.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between bg-college-bg border border-college-peach rounded-lg p-3"
                  >
                    <span className="text-sm font-poppins text-college-text">{doc.label}</span>
                    <button
                      onClick={() => handleViewDocument(doc.file_url)}
                      className="text-college-secondary hover:text-college-accent text-sm font-poppins font-medium"
                    >
                      View →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* SECTION 2 — APPROVAL TIMELINE */}
        <div className="card">
          <h2 className="text-xl font-semibold text-college-accent font-poppins mb-6">
            Approval Steps
          </h2>

          <div className="space-y-6">
            {steps.map((step, index) => {
              const isActive = step.id === activeStepId;
              const canAct = isActive && canUserActOnStep(step);

              return (
                <div key={step.id} className="relative">
                  {index < steps.length - 1 && (
                    <div className="absolute left-4 top-10 w-0.5 h-full bg-college-peach" />
                  )}

                  <div className="flex gap-4">
                    {/* Icon */}
                    <div className="flex-shrink-0 relative z-10">
                      {step.status === "approved" && (
                        <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {step.status === "rejected" && (
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {step.status === "pending" && !isActive && (
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
                          </svg>
                        </div>
                      )}
                      {step.status === "pending" && isActive && (
                        <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center animate-pulse">
                          <div className="w-3 h-3 bg-white rounded-full" />
                        </div>
                      )}
                    </div>

                    {/* Content */}
                    <div className="flex-1 pb-8">
                      <div className="flex items-center gap-3 mb-2">
                        <h3 className="text-base font-semibold text-college-text font-poppins">
                          {step.step_name}
                        </h3>
                        <span className="text-xs text-gray-500 font-poppins">({step.required_role})</span>
                        {step.status === "approved" && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-semibold">
                            ✓ Verified
                          </span>
                        )}
                        {step.status === "rejected" && (
                          <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">
                            ✗ Rejected
                          </span>
                        )}
                        {step.status === "pending" && !isActive && (
                          <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full font-semibold">
                            Waiting
                          </span>
                        )}
                        {step.status === "pending" && isActive && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold animate-pulse">
                            Action Required
                          </span>
                        )}
                      </div>

                      {/* Approved */}
                      {step.status === "approved" && (
                        <div className="space-y-2">
                          <p className="text-sm text-gray-600 font-poppins">
                            Signed by <strong>{step.verified_name}</strong> ({step.verified_role}) on {step.signed_at && formatDateTime(step.signed_at)}
                          </p>
                          {step.comment && (
                            <p className="text-sm text-gray-500 italic font-poppins">{step.comment}</p>
                          )}
                          {step.signature_url && (
                            <img
                              src={step.signature_url}
                              alt="Signature"
                              onClick={() => window.open(step.signature_url!, "_blank")}
                              className="max-h-16 border border-college-peach rounded cursor-pointer hover:opacity-80"
                            />
                          )}
                        </div>
                      )}

                      {/* Rejected */}
                      {step.status === "rejected" && (
                        <div className="space-y-2">
                          <p className="text-sm text-red-600 font-poppins">
                            Rejected by <strong>{step.verified_name}</strong> on {step.signed_at && formatDateTime(step.signed_at)}
                          </p>
                          {step.comment && (
                            <p className="text-sm text-gray-500 italic font-poppins">{step.comment}</p>
                          )}
                        </div>
                      )}

                      {/* Pending - active */}
                      {step.status === "pending" && isActive && (
                        <div className="mt-4">
                          {canAct ? (
                            <div className="bg-college-bg border border-college-peach rounded-lg p-4 space-y-4">
                              {/* Step-specific fields */}
                              {step.step_order === 3 && (
                                <div className="space-y-3">
                                  <div>
                                    <label className="label">Fees Paid Amount ₹</label>
                                    <input
                                      type="number"
                                      value={feesAmount}
                                      onChange={(e) => setFeesAmount(e.target.value)}
                                      disabled={submitting}
                                      className="input-field"
                                      placeholder="Enter amount"
                                    />
                                  </div>
                                  <div>
                                    <label className="label">Receipt Number</label>
                                    <input
                                      type="text"
                                      value={receiptNumber}
                                      onChange={(e) => setReceiptNumber(e.target.value)}
                                      disabled={submitting}
                                      className="input-field"
                                      placeholder="Enter receipt number"
                                    />
                                  </div>
                                </div>
                              )}

                              {step.step_order === 4 && (
                                <div className="space-y-3">
                                  <div>
                                    <label className="label">Library Status</label>
                                    <div className="flex gap-4 mt-2">
                                      <label className="flex items-center gap-2 font-poppins text-sm">
                                        <input
                                          type="radio"
                                          name="libraryStatus"
                                          value="No Dues"
                                          checked={libraryStatus === "No Dues"}
                                          onChange={(e) => setLibraryStatus(e.target.value)}
                                          disabled={submitting}
                                          className="w-4 h-4"
                                        />
                                        No Dues
                                      </label>
                                      <label className="flex items-center gap-2 font-poppins text-sm">
                                        <input
                                          type="radio"
                                          name="libraryStatus"
                                          value="Dues"
                                          checked={libraryStatus === "Dues"}
                                          onChange={(e) => setLibraryStatus(e.target.value)}
                                          disabled={submitting}
                                          className="w-4 h-4"
                                        />
                                        Dues ₹
                                      </label>
                                    </div>
                                  </div>
                                  {libraryStatus === "Dues" && (
                                    <div>
                                      <label className="label">Dues Amount ₹</label>
                                      <input
                                        type="number"
                                        value={duesAmount}
                                        onChange={(e) => setDuesAmount(e.target.value)}
                                        disabled={submitting}
                                        className="input-field"
                                        placeholder="Enter dues amount"
                                      />
                                    </div>
                                  )}
                                </div>
                              )}

                              {(step.step_order === 1 || step.step_order === 2 || step.step_order === 5) && (
                                <div>
                                  <label className="label">Comment / Remark</label>
                                  <textarea
                                    value={comment}
                                    onChange={(e) => setComment(e.target.value)}
                                    disabled={submitting}
                                    className="input-field"
                                    rows={3}
                                    placeholder="Add a comment or note..."
                                  />
                                </div>
                              )}

                              {/* Signature */}
                              <div>
                                <label className="label">Signature</label>
                                <SignaturePad onSave={(dataUrl) => setSignatureDataUrl(dataUrl)} disabled={submitting} />
                              </div>

                              {/* Verified Block */}
                              {signatureDataUrl && (
                                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                                      <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                                      </svg>
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-green-800 font-semibold font-poppins text-sm mb-2">✓ Verified</p>
                                      <div className="text-xs text-green-700 space-y-1 font-poppins">
                                        <p><strong>Signed by:</strong> {currentUser.full_name}</p>
                                        <p><strong>Role:</strong> {currentUser.role}</p>
                                        <p><strong>Timestamp:</strong> {liveTimestamp}</p>
                                      </div>
                                      <p className="text-xs text-green-600 italic mt-2 font-poppins">
                                        This signature will be embedded on the admission form.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Error */}
                              {error && <div className="text-red-500 text-sm font-poppins">{error}</div>}

                              {/* Buttons */}
                              <div className="flex gap-3">
                                <button
                                  onClick={handleApprove}
                                  disabled={submitting || !signatureDataUrl}
                                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-poppins font-semibold transition-colors"
                                >
                                  {submitting ? "Processing..." : "Approve & Sign"}
                                </button>
                                <button onClick={handleReject} disabled={submitting} className="btn-danger">
                                  {submitting ? "Processing..." : "Reject"}
                                </button>
                              </div>
                            </div>
                          ) : (
                            <p className="text-sm text-gray-500 font-poppins">
                              Waiting for {step.required_role} to review
                            </p>
                          )}
                        </div>
                      )}

                      {/* Pending - not active */}
                      {step.status === "pending" && !isActive && (
                        <p className="text-sm text-gray-500 font-poppins">
                          Awaiting previous step completion
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </main>

      <footer className="text-xs text-gray-400 text-center py-6 font-poppins">
        © MGM University SOET | EduSphere AI
      </footer>
    </div>
  );
}
