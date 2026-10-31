# EduSphere AI - Notification Integration Plan

This document outlines all notification points that need to be integrated across the system.

## ✅ COMPLETED

### 1. OTP & Email Verification
- ✅ POST `/api/otp/send` - Send 6-digit OTP
- ✅ POST `/api/otp/verify` - Verify OTP and set email_verified=true

### 2. User Management
- ✅ **#17 New User Created** - `app/api/users/create/route.ts`
  - Sends welcome email with account details, role, department
  - Shows approval status (pending/active)
  - Includes login link

### 3. Admission Workflow Notifications (#10-16)

**Files modified:**
- ✅ `app/admissions/promote/[id]/page.tsx` (promotion forms)
- ✅ `app/admissions/fresh/[id]/page.tsx` (fresh admissions)
- ✅ `app/admissions/promote/new/page.tsx` (promotion submission)
- ✅ `app/admissions/fresh/new/page.tsx` (fresh submission)

**Notification Points:**

- ✅ **#10 Form Submitted by Student**  
  **Location:** `app/admissions/promote/new/page.tsx` line ~365, `app/admissions/fresh/new/page.tsx` line ~350  
  **Notify:** Step 1 approver (faculty for promotion, admission_incharge for fresh)  
  **Title:** "Admission Approval Pending — Step 1"  
  **Message:** "{studentName} has submitted their admission form. Your approval is required."

- ✅ **#11 Step 1 Approved (Class Teacher / Admission Incharge)**  
  **Location:** `app/admissions/promote/[id]/page.tsx` line ~533, `app/admissions/fresh/[id]/page.tsx` line ~353  
  **Notify:** Step 2 approver (HOD for both)  
  **Title:** "Admission Approval Pending — Step 2"  
  **Message:** "{studentName}'s admission form has been approved and is now awaiting your signature as HoD."

- ✅ **#12 Step 2 Approved (HOD)**  
  **Notify:** Accountant  
  **Title:** "Fee Verification Required"  
  **Message:** "{studentName}'s admission form requires fee verification and receipt entry."

- ✅ **#13 Step 3 Approved (Accountant)**  
  **Notify:** Librarian  
  **Title:** "Library No-Dues Check Required"  
  **Message:** "{studentName}'s admission is pending library no-dues confirmation."

- ✅ **#14 Step 4 Approved (Librarian)**  
  **Notify:** Admin  
  **Title:** "Final Admission Approval Required"  
  **Message:** "{studentName}'s admission form has cleared all checks and requires your final approval."

- ✅ **#15 Step 5 / Final Approval (Admin for promotion, Principal for fresh)**  
  **Notify:** Student  
  **Title:** "Admission Approved ✓"  
  **Message:** "Congratulations! Your admission form for Semester {sem} has been fully approved."

- ✅ **#16 Any Step Rejected**  
  **Location:** Both promotion and fresh admission pages in `handleReject` function  
  **Notify:** Student  
  **Title:** "Admission Form Returned"  
  **Message:** "Your admission form was returned at Step {stepName} with comment: '{comment}'"

---

## 📋 TODO - HIGH PRIORITY

### 4. Assignment Notifications

#### #1 Assignment Created
**File:** `app/assignments/new/page.tsx` or API route  
**Trigger:** After `insert into assignments`  
**Notify:** All students in assignment's section  
**Title:** "New Assignment Posted"  
**Message:** "{subject} — {title} is due on {deadline}"

#### #2 Assignment Submitted
**File:** Submission logic location  
**Trigger:** After `insert into submissions`  
**Notify:** Faculty who created assignment  
**Title:** "New Submission Received"  
**Message:** "{studentName} has submitted {assignmentTitle}"

#### #4 Marks Published
**File:** Grading/marks update location  
**Trigger:** After marks saved/published for submission  
**Notify:** Student  
**Title:** "Marks Published"  
**Message:** "Your marks for {assignmentTitle} have been published. Score: {score}/{maxScore}"

### 5. Admission Season Management

#### #9 Season Opened
**File:** `app/admissions/seasons/page.tsx`  
**Trigger:** After `insert into admission_seasons`  
**Notify:** All students in department+section  
**Title:** "Admission Form Now Open"  
**Message:** "Your admission form for Semester {sem} is now open."

---

## 📋 TODO - MEDIUM PRIORITY

### 6. Installment Requests

#### #23 Installment Request Submitted
**File:** Installment request creation  
**Trigger:** After `insert into installment_requests`  
**Notify:** admin + accountant  
**Title:** "Installment Request Pending"  
**Message:** "{studentName} has requested an installment plan for ₹{amount}"

#### #24 Installment Approved
**File:** `app/admissions/installments/page.tsx` line ~128  
**Trigger:** After `installment_requests.update` where `status='approved'`  
**Notify:** Student  
**Title:** "Installment Plan Approved"  
**Message:** "Your installment request has been approved."

#### #25 Installment Rejected
**Trigger:** `status='rejected'`  
**Notify:** Student  
**Title:** "Installment Request Not Approved"  
**Message:** "Your installment plan request was not approved."

---

## 📋 TODO - FUTURE / ADVANCED

### 7. Scheduled/Cron Jobs

#### #3 Assignment Deadline Reminder
**File:** `app/api/cron/deadline-reminder/route.ts` (TO CREATE)  
**Schedule:** Daily at 8am via Vercel cron  
**Notify:** Students who haven't submitted, for assignments due tomorrow  
**Title:** "Assignment Due Tomorrow"  
**Message:** "{assignmentTitle} is due tomorrow."

#### #8 Monthly Attendance Report
**File:** `app/api/cron/attendance-report/route.ts` (TO CREATE)  
**Schedule:** 1st of every month at 9am  
**Notify:** All students with attendance summary  
**Title:** "Monthly Attendance Summary — {Month}"  
**Message:** "Your attendance this month: {details}"

### 8. Attendance (if attendance_records table exists)

#### #6 Low Attendance Warning (<75%)
**Trigger:** After attendance marked, if % drops below 75%  
**Notify:** Student  
**Title:** "Low Attendance Warning"  
**Message:** "Your attendance in {subject} is now {pct}%. Minimum required is 75%."

#### #7 Critical Attendance (<60%)
**Trigger:** After attendance marked, if % drops below 60%  
**Notify:** Student + faculty  
**Title:** "Critical Attendance — Action Required"  
**Message:** "Your attendance in {subject} has dropped to {pct}%."

### 9. Timetable

#### #20 Timetable Updated
**Trigger:** After timetable insert/update  
**Notify:** All students in section + assigned faculty  
**Title:** "Timetable Updated"  
**Message:** "The timetable for {section} has been updated."

### 10. Examination

#### #21 Exam Schedule Published
**Trigger:** After exam schedule insert  
**Notify:** All students in department  
**Title:** "Exam Schedule Published"  
**Message:** "The examination schedule for Semester {sem} has been published."

#### #22 Result Declared
**Trigger:** After results published  
**Notify:** Each student  
**Title:** "Semester Result Declared"  
**Message:** "Your Semester {sem} result has been declared."

---

## Implementation Strategy

### Phase 1: Core Admissions (Current)
1. ✅ User welcome emails
2. 🔄 Admission step-by-step notifications
3. Admission season opened

### Phase 2: Assignments
4. Assignment created
5. Assignment submitted
6. Marks published

### Phase 3: Advanced Features
7. Installment management
8. Cron jobs (reminders, monthly reports)
9. Attendance alerts
10. Timetable & exam notifications

---

## Helper Function Pattern

```typescript
import { sendNotification } from '@/lib/notify';

// After DB operation success:
try {
  await sendNotification(
    userId,
    'Notification Title',
    'Notification message with {dynamic} content',
    'all' // 'web' | 'email' | 'all'
  );
} catch (notifError) {
  console.error('[Feature] Notification failed (non-fatal):', notifError);
}
```

---

## Notes
- All notifications are non-fatal (wrapped in try-catch)
- Use `'all'` channel for important notifications
- Use `'web'` for less critical in-app notifications
- Email only sent if `email_verified=true`
