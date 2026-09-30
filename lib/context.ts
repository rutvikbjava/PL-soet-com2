import type { Document, UserRole, DocumentType, DocumentScope } from '@/types/database'

export interface DocumentContext {
  docType: DocumentType
  creatorRole: UserRole
  department: string | null
  scope: DocumentScope
  suggestedApprovers: UserRole[]
}

/**
 * Analyzes a document and determines the appropriate approval workflow
 * based on document type, creator role, department, and scope.
 * 
 * Approval Logic:
 * - Department notice by faculty → HOD
 * - Timetable change by faculty → HOD
 * - Exam schedule by faculty/COE → HOD, COE, Principal
 * - Institutional notice by HOD → Principal
 * 
 * @param doc - The document to analyze (should include creator role via join or separate parameter)
 * @returns DocumentContext with suggested approvers
 */
export function analyzeDocumentContext(
  doc: Document & { creator_role?: UserRole }
): DocumentContext {
  const docType = doc.type as DocumentType
  const creatorRole = (doc.creator_role || 'faculty') as UserRole
  const department = doc.department
  const scope = doc.scope as DocumentScope

  let suggestedApprovers: UserRole[] = []

  // Notice or Circular
  if (docType === 'notice' || docType === 'circular') {
    if (scope === 'department') {
      suggestedApprovers = ['hod']
    } else if (scope === 'college') {
      suggestedApprovers = ['hod', 'principal']
    } else if (scope === 'institution') {
      suggestedApprovers = ['hod', 'principal']
    }
  }
  // Timetable
  else if (docType === 'timetable') {
    suggestedApprovers = ['hod']
  }
  // Exam Schedule
  else if (docType === 'exam_schedule') {
    suggestedApprovers = ['hod', 'coe', 'principal']
  }
  // Policy
  else if (docType === 'policy') {
    suggestedApprovers = ['hod', 'principal']
  }
  // Fallback - ensure suggestedApprovers is never empty
  else {
    suggestedApprovers = ['hod']
  }

  // Ensure suggestedApprovers is never empty (safety check)
  if (suggestedApprovers.length === 0) {
    suggestedApprovers = ['hod']
  }

  return {
    docType,
    creatorRole,
    department,
    scope,
    suggestedApprovers,
  }
}
