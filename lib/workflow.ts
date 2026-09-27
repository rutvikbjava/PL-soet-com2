import type { DocumentContext } from './context'
import type { WorkflowStep } from '@/types/database'

/**
 * Generates an ordered workflow with approval steps based on document context.
 * All steps are initialized with 'pending' status.
 * 
 * @param context - DocumentContext with suggestedApprovers
 * @returns Array of WorkflowStep with stepOrder, requiredRole, and status
 */
export function generateWorkflow(context: DocumentContext): WorkflowStep[] {
  const steps: WorkflowStep[] = []
  
  // Remove duplicates while preserving order
  const uniqueApprovers = Array.from(new Set(context.suggestedApprovers))
  
  uniqueApprovers.forEach((role, index) => {
    steps.push({
      stepOrder: index + 1,
      requiredRole: role,
      status: 'pending',
    })
  })
  
  return steps
}

/**
 * Validates a workflow against document context requirements.
 * 
 * Validation Rules:
 * - Exam schedules always need principal approval
 * - Institution-scope documents always need principal approval
 * 
 * @param steps - Array of WorkflowStep to validate
 * @param context - DocumentContext to validate against
 * @returns true if workflow is valid, false otherwise
 */
export function validateWorkflow(
  steps: WorkflowStep[],
  context: DocumentContext
): boolean {
  const roles = steps.map((step) => step.requiredRole)
  
  // Exam schedules always need principal
  if (context.docType === 'exam_schedule') {
    if (!roles.includes('principal')) {
      return false
    }
  }
  
  // Institution-scope always needs principal
  if (context.scope === 'institution') {
    if (!roles.includes('principal')) {
      return false
    }
  }
  
  return true
}
