import type { Account, Project, ProjectAccessRole, TeamMember, Transaction } from '../types';

export type EffectiveProjectRole = 'owner' | ProjectAccessRole;

/**
 * Determine whether the current user is the admin (creator/owner) of a company.
 * Users who create a company get admin access; direct login users do not.
 */
export function isUserCompanyAdmin(
  account: Account | undefined,
  currentUserId?: string,
  teamMembers?: TeamMember[]
): boolean {
  if (!account || !currentUserId) return false;
  if (!account.ownerId) {
    if (account.id === 'default') return false;
  } else if (account.ownerId === currentUserId) {
    return true;
  }

  // Also check if user is registered with 'admin' role in company team
  if (teamMembers && teamMembers.length > 0) {
    const member = teamMembers.find(
      (m) => m.accountId === account.id && m.userId === currentUserId
    );
    if (member?.role === 'admin') {
      return true;
    }
  }

  return false;
}

/**
 * Determine the current user's effective role on a project.
 * Legacy projects without an ownerId default to 'owner' (Main Admin).
 */
export function getUserProjectRole(
  project: Project | undefined,
  currentUserId?: string,
  companyTeamMembers?: TeamMember[],
  activeAccountId?: string
): EffectiveProjectRole {
  if (!project || !currentUserId) return 'owner';
  if (!project.ownerId || project.ownerId === currentUserId) return 'owner';

  // If user is a company-level admin, they inherit admin authority over all projects
  if (companyTeamMembers && activeAccountId) {
    const companyMember = companyTeamMembers.find(
      (m) => m.accountId === activeAccountId && m.userId === currentUserId
    );
    if (companyMember?.role === 'admin') {
      return 'admin';
    }
  }

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
  currentUserId?: string,
  companyTeamMembers?: TeamMember[],
  activeAccountId?: string
): boolean {
  if (!currentUserId) return true;

  const project = projects.find((p) => !p.parentId && p.name === tx.tag);
  const role = getUserProjectRole(project, currentUserId, companyTeamMembers, activeAccountId);

  if (role === 'owner' || role === 'admin') {
    return true;
  }

  return tx.createdByUserId === currentUserId;
}
