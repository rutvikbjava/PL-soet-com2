import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase'
import { getSession } from '@/lib/auth'

/**
 * Migration endpoint to populate approver_id for existing approvals
 * that were created before the fix was implemented.
 * 
 * This should be run once by an admin user.
 */
export async function POST(request: NextRequest) {
  try {
    // Get authenticated session
    const { user } = await getSession()

    if (!user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const supabase = await createServerClient()

    // Check if user is admin (optional: add role check)
    const { data: userData } = await (supabase.from('users') as any)
      .select('role')
      .eq('id', user.id)
      .single()

    // Optional: uncomment to restrict to admins only
    // if (userData?.role !== 'admin' && userData?.role !== 'principal') {
    //   return NextResponse.json(
    //     { error: 'Forbidden: Admin access required' },
    //     { status: 403 }
    //   )
    // }

    // Fetch all approvals with null approver_id
    const { data: approvalsData, error: approvalsError } = await (supabase
      .from('approvals') as any)
      .select('id, workflow_id, step_order')
      .is('approver_id', null)

    if (approvalsError) {
      return NextResponse.json(
        { error: `Failed to fetch approvals: ${approvalsError.message}` },
        { status: 500 }
      )
    }

    const approvals = (approvalsData ?? []) as any[]

    if (approvals.length === 0) {
      return NextResponse.json({
        message: 'No approvals need fixing',
        updated: 0,
      })
    }

    // Group approvals by workflow_id for efficient fetching
    const workflowIds = [...new Set(approvals.map(a => a.workflow_id))]

    // Fetch all workflows
    const { data: workflowsData, error: workflowsError } = await (supabase
      .from('workflows') as any)
      .select('id, generated_steps')
      .in('id', workflowIds)

    if (workflowsError) {
      return NextResponse.json(
        { error: `Failed to fetch workflows: ${workflowsError.message}` },
        { status: 500 }
      )
    }

    const workflows = (workflowsData ?? []) as any[]
    const workflowMap = new Map(workflows.map(w => [w.id, w.generated_steps]))

    // Collect all required roles
    const requiredRoles = new Set<string>()
    approvals.forEach(approval => {
      const steps = workflowMap.get(approval.workflow_id)
      if (steps && Array.isArray(steps)) {
        const step = steps.find((s: any) => s.stepOrder === approval.step_order)
        if (step?.requiredRole) {
          requiredRoles.add(step.requiredRole)
        }
      }
    })

    // Fetch users for all required roles
    const { data: usersData, error: usersError } = await (supabase
      .from('users') as any)
      .select('id, role')
      .in('role', Array.from(requiredRoles))

    if (usersError) {
      return NextResponse.json(
        { error: `Failed to fetch users: ${usersError.message}` },
        { status: 500 }
      )
    }

    const users = (usersData ?? []) as any[]

    // Create role to user ID mapping (pick first user of each role)
    const roleToUserId = new Map<string, string>()
    users.forEach((user: any) => {
      if (!roleToUserId.has(user.role)) {
        roleToUserId.set(user.role, user.id)
      }
    })

    // Update each approval
    const updates: Promise<any>[] = []
    const failedUpdates: any[] = []

    for (const approval of approvals) {
      const steps = workflowMap.get(approval.workflow_id)
      if (!steps || !Array.isArray(steps)) {
        failedUpdates.push({
          approval_id: approval.id,
          reason: 'Workflow steps not found',
        })
        continue
      }

      const step = steps.find((s: any) => s.stepOrder === approval.step_order)
      if (!step?.requiredRole) {
        failedUpdates.push({
          approval_id: approval.id,
          reason: 'Required role not found in workflow step',
        })
        continue
      }

      const approverId = roleToUserId.get(step.requiredRole)
      if (!approverId) {
        failedUpdates.push({
          approval_id: approval.id,
          reason: `No user found for role: ${step.requiredRole}`,
        })
        continue
      }

      // Update the approval
      updates.push(
        (supabase.from('approvals') as any)
          .update({ approver_id: approverId })
          .eq('id', approval.id)
      )
    }

    // Execute all updates
    const results = await Promise.allSettled(updates)
    
    const successCount = results.filter(r => r.status === 'fulfilled').length
    const errorCount = results.filter(r => r.status === 'rejected').length

    return NextResponse.json({
      message: 'Migration completed',
      total_approvals: approvals.length,
      updated: successCount,
      failed: errorCount + failedUpdates.length,
      failed_details: failedUpdates,
    })
  } catch (error) {
    console.error('Migration error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}
