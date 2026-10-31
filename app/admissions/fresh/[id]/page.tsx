"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import SignaturePad from "@/components/SignaturePad";
import { sendNotification } from "@/lib/notify";

interface AdmissionForm {
  id: string;
  form_type: string;
  student_email: string;
  student_name: string;
  department: string;
  section: string | null;
  status: string;
  created_by_email: string;
  created_at: string;
  completed_at: string | null;
  remarks: string | null;
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

interface CetRecord {
  id: string;
  form_id: string;
  student_email: string;
  cet_type: string | null;
  cet_score: number | null;
  cet_passed: boolean;
  notes: string | null;
}

interface FeePayment {
  id: string;
  form_id: string;
  total_amount: number;
  paid_amount: number;
  payment_mode: string | null;
  receipt_number: string | null;
  payment_date: string;
}

interface InstallmentRequest {
  id: string;
  form_id: string;
  total_amount: number;
  installment_count: number;
  first_payment: number;
  reason: string | null;
  status: string;
  approved_by_email: string | null;
  approved_at: string | null;
}

interface CurrentUser {
  email: string;
  role: string;
  full_name: string;
}

export default function FreshAdmissionDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const router = useRouter();
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [form, setForm] = useState<AdmissionForm | null>(null);
  const [steps, setSteps] = useState<AdmissionStep[]>([]);
  const [cetRecord, setCetRecord] = useState<CetRecord | null>(null);
  const [feePayment, setFeePayment] = useState<FeePayment | null>(null);
  const [installmentRequest, setInstallmentRequest] = useState<InstallmentRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notFound, setNotFound] = useState(false);

  // Sign-off state
  const [activeStepId, setActiveStepId] = useState<string | null>(null);
  const [comment, setComment] = useState("");
  const [signatureDataUrl, setSignatureDataUrl] = useState<string | null>(null);
  const [liveTimestamp, setLiveTimestamp] = useState("");
  const [submitting, setSubmitting] = useState(false);

  // Step 3 (Fee Recording) specific fields
  const [totalFees, setTotalFees] = useState("");
  const [amountPaid, setAmountPaid] = useState("");
  const [paymentMode, setPaymentMode] = useState("Full Payment");
  const [receiptNumber, setReceiptNumber] = useState("");
  const [installmentCount, setInstallmentCount] = useState("2");
  const [firstInstallmentAmount, setFirstInstallmentAmount] = useState("");
  const [installmentReason, setInstallmentReason] = useState("");

  useEffect(() => {
    fetchData();
  }, [params.id]);

  // Live timestamp
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

      // Fetch steps
      const { data: stepsData } = await (supabase.from("admission_steps") as any)
        .select("*")
        .eq("form_id", params.id)
        .order("step_order", { ascending: true });

      setSteps((stepsData ?? []) as AdmissionStep[]);

      const activeStep = (stepsData ?? []).find(
        (s: AdmissionStep) => s.status === "pending"
      );
      if (activeStep) {
        setActiveStepId(activeStep.id);
      }

      // Fetch CET record
      const { data: cetData } = await (supabase.from("cet_records") as any)
        .select("*")
        .eq("form_id", params.id)
        .single();

      setCetRecord(cetData as CetRecord | null);

      // Fetch fee payment
      const { data: feeData } = await (supabase.from("fee_payments") as any)
        .select("*")
        .eq("form_id", params.id)
        .single();

      setFeePayment(feeData as FeePayment | null);

      // Fetch installment request
      const { data: installmentData } = await (supabase.from("installment_requests") as any)
        .select("*")
        .eq("form_id", params.id)
        .single();

      setInstallmentRequest(installmentData as InstallmentRequest | null);

      setLoading(false);
    } catch (err) {
      console.error("Fetch error:", err);
      setError("Failed to load form data.");
      setLoading(false);
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

      // Step 3: Validate fee fields
      if (activeStep.step_order === 3) {
        if (!totalFees || !amountPaid) {
          setError("Total fees and amount paid are required.");
          setSubmitting(false);
          return;
        }
        if (paymentMode === "Installment Plan" && !firstInstallmentAmount) {
          setError("First installment amount is required.");
          setSubmitting(false);
          return;
        }
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
          comment: comment.trim() || null,
          verified_name: currentUser.full_name,
          verified_role: currentUser.role,
        })
        .eq("id", activeStep.id);

      if (stepError) {
        setError("Failed to update approval step.");
        setSubmitting(false);
        return;
      }

      // Step 3: Insert fee payment and installment request
      if (activeStep.step_order === 3) {
        const payMode = paymentMode === "Installment Plan" ? "installment" : "full";

        const { error: feeError } = await (supabase.from("fee_payments") as any).insert({
          form_id: form.id,
          student_email: form.student_email,
          total_amount: parseFloat(totalFees),
          paid_amount: parseFloat(amountPaid),
          payment_mode: payMode,
          receipt_number: receiptNumber.trim() || null,
          payment_date: new Date().toISOString(),
          recorded_by_email: currentUser.email,
        });

        if (feeError) {
          console.error("Fee payment insert error:", feeError);
        }

        if (paymentMode === "Installment Plan") {
          const { error: installmentError } = await (
            supabase.from("installment_requests") as any
          ).insert({
            form_id: form.id,
            student_email: form.student_email,
            total_amount: parseFloat(totalFees),
            installment_count: parseInt(installmentCount),
            first_payment: parseFloat(firstInstallmentAmount),
            reason: installmentReason.trim() || null,
            status: "pending",
          });

          if (installmentError) {
            console.error("Installment request insert error:", installmentError);
          }
        }
      }

      // Step 6 (Final): Mark form as completed
      if (activeStep.step_order === 6) {
        await (supabase.from("admission_forms") as any)
          .update({
            status: "completed",
            completed_at: new Date().toISOString(),
          })
          .eq("id", form.id);
      }

      // Send notifications based on step (#11-15, adapted for fresh admissions)
      try {
        // Find next step
        const nextStep = steps.find(
          (s) => s.step_order === activeStep.step_order + 1
        );

        if (activeStep.step_order === 1) {
          // #11 Step 1 Approved (Admission Incharge) - Notify HOD (Step 2)
          if (nextStep?.assigned_to_email) {
            await sendNotification(
              nextStep.assigned_to_email,
              "Admission Approval Pending — Step 2",
              `${form.student_name}'s fresh admission form has been approved and is now awaiting your signature as HoD.`,
              "all"
            );
          }
        } else if (activeStep.step_order === 2) {
          // #12 Step 2 Approved (HOD) - Notify Accountant (Step 3)
          const { data: accountants } = await (supabase.from("users") as any)
            .select("email")
            .eq("role", "accountant")
            .eq("department", form.department)
            .limit(1);
          
          if (accountants && accountants.length > 0) {
            await sendNotification(
              accountants[0].email,
              "Fee Verification Required",
              `${form.student_name}'s fresh admission form requires fee verification and receipt entry.`,
              "all"
            );
          }
        } else if (activeStep.step_order === 3) {
          // #13 Step 3 Approved (Accountant) - Notify Librarian (Step 4)
          const { data: librarians } = await (supabase.from("users") as any)
            .select("email")
            .eq("role", "librarian")
            .limit(1);
          
          if (librarians && librarians.length > 0) {
            await sendNotification(
              librarians[0].email,
              "Library Clearance Required",
              `${form.student_name}'s fresh admission requires library clearance.`,
              "all"
            );
          }
        } else if (activeStep.step_order === 4) {
          // #14 Step 4 Approved (Librarian) - Notify Admin (Step 5)
          const { data: admins } = await (supabase.from("users") as any)
            .select("email")
            .eq("role", "admin")
            .limit(1);
          
          if (admins && admins.length > 0) {
            await sendNotification(
              admins[0].email,
              "Admin Approval Required",
              `${form.student_name}'s fresh admission form has cleared library and requires your approval.`,
              "all"
            );
          }
        } else if (activeStep.step_order === 5) {
          // Step 5 Approved (Admin) - Notify Principal (Step 6, final)
          const { data: principals } = await (supabase.from("users") as any)
            .select("email")
            .eq("role", "principal")
            .limit(1);
          
          if (principals && principals.length > 0) {
            await sendNotification(
              principals[0].email,
              "Final Fresh Admission Approval Required",
              `${form.student_name}'s fresh admission form requires your final signature as Principal.`,
              "all"
            );
          }
        } else if (activeStep.step_order === 6) {
          // #15 Final Approval - Notify Student
          await sendNotification(
            form.student_email,
            "Fresh Admission Approved ✓",
            `Congratulations! Your fresh admission form has been fully approved. Welcome to ${form.department}!`,
            "all"
          );
        }
      } catch (notifError) {
        console.error("[Fresh Admission Approval] Notification failed (non-fatal):", notifError);
      }

      router.refresh();
      await fetchData();
      setComment("");
      setSignatureDataUrl(null);
      setTotalFees("");
      setAmountPaid("");
      setPaymentMode("Full Payment");
      setReceiptNumber("");
      setInstallmentCount("2");
      setFirstInstallmentAmount("");
      setInstallmentReason("");
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

      // #16 Send rejection notification to student
      try {
        await sendNotification(
          form.student_email,
          "Fresh Admission Form Returned",
          `Your fresh admission form was returned at Step ${activeStep.step_name} with comment: '${comment.trim() || "No comment provided"}'`,
          "all"
        );
      } catch (notifError) {
        console.error("[Fresh Admission Rejection] Notification failed (non-fatal):", notifError);
      }

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
      case "pending":
        return "bg-yellow-100 text-yellow-700 px-3 py-1 rounded-full text-xs font-semibold";
      case "approved":
        return "bg-green-100 text-green-700 px-3 py-1 rounded-full text-xs font-semibold";
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

  const showFeePanel = currentUser.role === "accountant" || currentUser.role === "admin";

  return (
    <div className="min-h-screen bg-college-bg">
      <Navbar userEmail={currentUser.email} userRole={currentUser.role} />

      <main className="max-w-5xl mx-auto px-6 py-8">
        {/* Back Link */}
        <Link
          href="/admissions"
          className="text-college-secondary text-sm font-poppins mb-4 inline-block hover:underline"
        >
          ← Back to Admissions
        </Link>

        {/* SECTION 1 — APPLICANT HEADER */}
        <div className="card mb-6">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-2xl font-bold text-college-accent font-poppins">
              Fresh Admission Form
            </h1>
            <span className={getStatusBadgeClass(form.status)}>
              {form.status.replace("_", " ").toUpperCase()}
            </span>
          </div>

          <div className="space-y-2 text-sm font-poppins">
            <p>
              <span className="text-gray-600">Student Name:</span>{" "}
              <span className="font-medium">{form.student_name}</span>
            </p>
            <p>
              <span className="text-gray-600">Email:</span>{" "}
              <span className="font-medium">{form.student_email}</span>
            </p>
            <p>
              <span className="text-gray-600">Department:</span>{" "}
              <span className="font-medium">{form.department}</span> |{" "}
              <span className="text-gray-600">Section:</span>{" "}
              <span className="font-medium">{form.section || "N/A"}</span>
            </p>
            <p className="text-gray-500">
              <span className="font-semibold">Created by:</span> {form.created_by_email} on{" "}
              {formatDate(form.created_at)}
            </p>
          </div>
        </div>

        {/* SECTION 2 — CET & ELIGIBILITY PANEL */}
        <div className="card mb-6">
          <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
            CET & Eligibility Status
          </h2>

          {cetRecord ? (
            <div className="space-y-4">
              <div className="grid grid-cols-3 gap-4 text-sm font-poppins">
                <div>
                  <span className="text-gray-600">CET Type:</span>{" "}
                  <span className="font-medium">{cetRecord.cet_type || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-600">Score:</span>{" "}
                  <span className="font-medium">{cetRecord.cet_score || "N/A"}</span>
                </div>
                <div>
                  <span className="text-gray-600">Status:</span>{" "}
                  {cetRecord.cet_passed ? (
                    <span className="text-green-600 font-semibold">✓ Passed / Exempted</span>
                  ) : (
                    <span className="text-red-600 font-semibold">✗ MGMU CET Required</span>
                  )}
                </div>
              </div>

              {cetRecord.cet_passed ? (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <p className="text-sm text-green-800 font-poppins">
                    ✓ State CET verified. Student is exempt from MGMU CET.
                  </p>
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-300 rounded-lg p-4">
                  <p className="text-sm text-yellow-800 font-poppins">
                    ⚠ This student has not cleared any state CET. MGMU CET must be completed
                    before seat allotment.
                  </p>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-gray-400 font-poppins">CET information not recorded.</p>
          )}
        </div>

        {/* SECTION 3 — FEE STATUS PANEL (accountant and admin only) */}
        {showFeePanel && (
          <div className="card mb-6">
            <h2 className="text-xl font-semibold text-college-accent font-poppins mb-4">
              Fee & Payment Status
            </h2>

            {feePayment ? (
              <div className="space-y-3">
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm font-poppins">
                  <div>
                    <span className="text-gray-600">Total Amount:</span>{" "}
                    <span className="font-medium">₹{feePayment.total_amount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Paid:</span>{" "}
                    <span className="font-medium">₹{feePayment.paid_amount}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Mode:</span>{" "}
                    <span className="font-medium capitalize">{feePayment.payment_mode || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Receipt:</span>{" "}
                    <span className="font-medium">{feePayment.receipt_number || "N/A"}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Date:</span>{" "}
                    <span className="font-medium">{formatDate(feePayment.payment_date)}</span>
                  </div>
                </div>

                {installmentRequest && (
                  <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                    <p className="text-sm font-semibold text-purple-800 font-poppins mb-2">
                      Installment Plan Request
                    </p>
                    <div className="grid grid-cols-2 gap-3 text-xs font-poppins">
                      <div>
                        <span className="text-gray-600">Total:</span>{" "}
                        <span className="font-medium">₹{installmentRequest.total_amount}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">First Payment:</span>{" "}
                        <span className="font-medium">₹{installmentRequest.first_payment}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Installments:</span>{" "}
                        <span className="font-medium">{installmentRequest.installment_count}</span>
                      </div>
                      <div>
                        <span className="text-gray-600">Status:</span>{" "}
                        <span className={getStatusBadgeClass(installmentRequest.status)}>
                          {installmentRequest.status.toUpperCase()}
                        </span>
                      </div>
                    </div>
                    {installmentRequest.reason && (
                      <p className="text-xs text-gray-600 font-poppins mt-2">
                        <strong>Reason:</strong> {installmentRequest.reason}
                      </p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-sm text-gray-400 font-poppins">No payment recorded yet.</p>
            )}
          </div>
        )}

        {/* SECTION 4 — APPROVAL TIMELINE */}
        <div className="card">
          <h2 className="text-xl font-semibold text-college-accent font-poppins mb-6">
            Admission Steps
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
                            <path
                              fillRule="evenodd"
                              d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                      {step.status === "rejected" && (
                        <div className="w-8 h-8 bg-red-500 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </div>
                      )}
                      {step.status === "pending" && !isActive && (
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center">
                          <svg className="w-5 h-5 text-gray-600" fill="currentColor" viewBox="0 0 20 20">
                            <path
                              fillRule="evenodd"
                              d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z"
                              clipRule="evenodd"
                            />
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
                        <span className="text-xs text-gray-500 font-poppins">
                          ({step.required_role})
                        </span>
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
                            Signed by <strong>{step.verified_name}</strong> ({step.verified_role}) on{" "}
                            {step.signed_at && formatDateTime(step.signed_at)}
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
                            Rejected by <strong>{step.verified_name}</strong> on{" "}
                            {step.signed_at && formatDateTime(step.signed_at)}
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
                              {/* Step 3: Fee Recording Form */}
                              {step.step_order === 3 && (
                                <div className="space-y-4 bg-blue-50 border border-blue-200 rounded-lg p-4">
                                  <h4 className="text-sm font-semibold text-college-accent font-poppins">
                                    Fee Recording
                                  </h4>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="label">
                                        Total Semester Fees (₹) <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        type="number"
                                        value={totalFees}
                                        onChange={(e) => setTotalFees(e.target.value)}
                                        disabled={submitting}
                                        className="input-field"
                                        placeholder="Enter total fees"
                                        required
                                      />
                                    </div>

                                    <div>
                                      <label className="label">
                                        Amount Paid Now (₹) <span className="text-red-500">*</span>
                                      </label>
                                      <input
                                        type="number"
                                        value={amountPaid}
                                        onChange={(e) => setAmountPaid(e.target.value)}
                                        disabled={submitting}
                                        className="input-field"
                                        placeholder="Enter amount paid"
                                        required
                                      />
                                    </div>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div>
                                      <label className="label">Payment Mode</label>
                                      <select
                                        value={paymentMode}
                                        onChange={(e) => setPaymentMode(e.target.value)}
                                        disabled={submitting}
                                        className="input-field"
                                      >
                                        <option value="Full Payment">Full Payment</option>
                                        <option value="Installment Plan">Installment Plan</option>
                                      </select>
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

                                  {paymentMode === "Installment Plan" && (
                                    <div className="space-y-4 bg-purple-50 border border-purple-200 rounded-lg p-4">
                                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <div>
                                          <label className="label">Number of Installments</label>
                                          <select
                                            value={installmentCount}
                                            onChange={(e) => setInstallmentCount(e.target.value)}
                                            disabled={submitting}
                                            className="input-field"
                                          >
                                            <option value="2">2</option>
                                            <option value="3">3</option>
                                            <option value="4">4</option>
                                          </select>
                                        </div>

                                        <div>
                                          <label className="label">
                                            First Installment Amount (₹)
                                          </label>
                                          <input
                                            type="number"
                                            value={firstInstallmentAmount}
                                            onChange={(e) =>
                                              setFirstInstallmentAmount(e.target.value)
                                            }
                                            disabled={submitting}
                                            className="input-field"
                                            placeholder="Enter first installment"
                                          />
                                        </div>
                                      </div>

                                      <div>
                                        <label className="label">Reason for Installment</label>
                                        <textarea
                                          value={installmentReason}
                                          onChange={(e) => setInstallmentReason(e.target.value)}
                                          disabled={submitting}
                                          className="input-field"
                                          rows={2}
                                          placeholder="Enter reason for requesting installment plan"
                                        />
                                      </div>

                                      <p className="text-xs text-purple-700 font-poppins">
                                        ℹ Installment plan will be sent to admin for approval.
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}

                              {/* Comment */}
                              <div>
                                <label className="label">Comment</label>
                                <textarea
                                  value={comment}
                                  onChange={(e) => setComment(e.target.value)}
                                  disabled={submitting}
                                  className="input-field"
                                  rows={3}
                                  placeholder="Add a comment or note..."
                                />
                              </div>

                              {/* Signature */}
                              <div>
                                <label className="label">Signature</label>
                                <SignaturePad
                                  onSave={(dataUrl) => setSignatureDataUrl(dataUrl)}
                                  disabled={submitting}
                                />
                              </div>

                              {/* Verified Block */}
                              {signatureDataUrl && (
                                <div className="bg-green-50 border-2 border-green-300 rounded-lg p-4">
                                  <div className="flex items-start gap-3">
                                    <div className="w-8 h-8 bg-green-500 rounded-full flex items-center justify-center flex-shrink-0">
                                      <svg
                                        className="w-5 h-5 text-white"
                                        fill="currentColor"
                                        viewBox="0 0 20 20"
                                      >
                                        <path
                                          fillRule="evenodd"
                                          d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                          clipRule="evenodd"
                                        />
                                      </svg>
                                    </div>
                                    <div className="flex-1">
                                      <p className="text-green-800 font-semibold font-poppins text-sm mb-2">
                                        ✓ Verified
                                      </p>
                                      <div className="text-xs text-green-700 space-y-1 font-poppins">
                                        <p>
                                          <strong>Signed by:</strong> {currentUser.full_name}
                                        </p>
                                        <p>
                                          <strong>Role:</strong> {currentUser.role}
                                        </p>
                                        <p>
                                          <strong>Timestamp:</strong> {liveTimestamp}
                                        </p>
                                      </div>
                                      <p className="text-xs text-green-600 italic mt-2 font-poppins">
                                        This signature will be embedded on the admission form.
                                      </p>
                                    </div>
                                  </div>
                                </div>
                              )}

                              {/* Error */}
                              {error && (
                                <div className="text-red-500 text-sm font-poppins">{error}</div>
                              )}

                              {/* Buttons */}
                              <div className="flex gap-3">
                                <button
                                  onClick={handleApprove}
                                  disabled={submitting || !signatureDataUrl}
                                  className="bg-green-600 hover:bg-green-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white px-4 py-2 rounded-lg font-poppins font-semibold transition-colors"
                                >
                                  {submitting ? "Processing..." : "Approve & Sign"}
                                </button>
                                <button
                                  onClick={handleReject}
                                  disabled={submitting}
                                  className="btn-danger"
                                >
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
