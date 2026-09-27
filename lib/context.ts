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

  const suggestedApprovers: UserRole[] = []

  // Department notice by faculty → HOD
  if (docType === 'notice' && creatorRole === 'faculty' && scope === 'department') {
    suggestedApprovers.push('hod')
  }

  // Timetable change by faculty → HOD
  if (docType === 'timetable' && creatorRole === 'faculty') {
    suggestedApprovers.push('hod')
  }

  // Exam schedule by faculty/COE → HOD, COE, Principal
  if (docType === 'exam_schedule' && (creatorRole === 'faculty' || creatorRole === 'coe')) {
    suggestedApprovers.push('hod', 'coe', 'principal')
  }

  // Institutional notice by HOD → Principal
  if (docType === 'notice' && creatorRole === 'hod' && scope === 'institution') {
    suggestedApprovers.push('principal')
  }

  return {
    docType,
    creatorRole,
    department,
    scope,
    suggestedApprovers,
  }
}
