import type { Project, ProjectAccessRole, Transaction } from '../types';

export type EffectiveProjectRole = 'owner' | ProjectAccessRole;

/**
 * Determine the current user's effective role on a project.
 * Legacy projects without an ownerId default to 'owner' (Main Admin).
 */
export function getUserProjectRole(
  project: Project | undefined,
  currentUserId?: string
): EffectiveProjectRole {
  if (!project || !currentUserId) return 'owner';
  if (!project.ownerId || project.ownerId === currentUserId) return 'owner';

  const assignment = project.teamMembers?.find((m) => m.userId === currentUserId);
  if (assignment) return assignment.role;

  return 'spender';
}

/**
 * Check whether the current user can edit or delete a specific transaction.
 * - Owner / Admin: can add, edit, and delete all entries in the project.
 * - Spender: can only add, edit, and delete their own entries.
 */
export function canModifyTransaction(
  tx: Transaction,
  projects: Project[],
  currentUserId?: string
): boolean {
  if (!currentUserId) return true;

  const project = projects.find((p) => !p.parentId && p.name === tx.tag);
  const role = getUserProjectRole(project, currentUserId);

  if (role === 'owner' || role === 'admin') {
    return true;
  }

  return tx.createdByUserId === currentUserId;
}
