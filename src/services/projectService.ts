import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { isGeneralProject, type Project, type ProjectTeamAssignment } from '../types';
import { getStoredProjects, saveStoredProjects } from '../utils/storage';

interface DbProjectRow {
  id: string;
  user_id?: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  budget: number | null;
  color: string | null;
  completed: boolean;
  completed_at: string | null;
  team_members?: ProjectTeamAssignment[] | null;
  created_at: string;
}

function mapRowToProject(row: DbProjectRow): Project {
  return {
    id: row.id,
    parentId: row.parent_id || null,
    name: row.name,
    description: row.description || '',
    budget: row.budget != null && Number(row.budget) > 0 ? Number(row.budget) : undefined,
    color: row.color || '#3b82f6',
    completed: Boolean(row.completed),
    completedAt: row.completed_at ? new Date(row.completed_at).getTime() : null,
    ownerId: row.user_id || undefined,
    teamMembers: Array.isArray(row.team_members) ? row.team_members : undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function mapProjectToPayload(
  project: Project,
  accountId: string = 'default',
  includeTeamMembers: boolean = true
) {
  const base = {
    id: project.id,
    parent_id: project.parentId || null,
    name: project.name,
    description: project.description || '',
    budget: project.budget ?? 0,
    color: project.color || '#3b82f6',
    completed: Boolean(project.completed),
    completed_at: project.completedAt ? new Date(project.completedAt).toISOString() : null,
    created_at: project.createdAt ? new Date(project.createdAt).toISOString() : new Date().toISOString(),
    account_id: accountId,
  };

  if (!includeTeamMembers) return base;
  return {
    ...base,
    team_members: project.teamMembers || [],
  };
}

export async function getProjectsFromSupabase(accountId: string = 'default'): Promise<Project[]> {
  if (!isSupabaseConfigured) {
    return getStoredProjects(accountId);
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .eq('account_id', accountId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch projects from Supabase:', error.message);
    return getStoredProjects(accountId);
  }

  const rows = (data as DbProjectRow[]) || [];
  if (rows.length === 0) {
    const localProjects = getStoredProjects(accountId);
    for (const proj of localProjects) {
      await upsertProjectToSupabase(proj, accountId);
    }
    return localProjects;
  }

  const mapped = rows
    .map(mapRowToProject)
    .sort((a, b) => {
      if (isGeneralProject(a) && !isGeneralProject(b)) return -1;
      if (!isGeneralProject(a) && isGeneralProject(b)) return 1;
      return (a.createdAt || 0) - (b.createdAt || 0) || a.id.localeCompare(b.id);
    });
  saveStoredProjects(mapped, accountId);
  return mapped;
}

export async function upsertProjectToSupabase(
  project: Project,
  accountId: string = 'default'
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('projects')
    .upsert([mapProjectToPayload(project, accountId, true)], { onConflict: 'id' });

  if (error) {
    if (error.message.includes('team_members')) {
      const { error: fallbackError } = await supabase
        .from('projects')
        .upsert([mapProjectToPayload(project, accountId, false)], { onConflict: 'id' });
      if (fallbackError) {
        console.error('Failed to upsert project in Supabase:', fallbackError.message);
      }
      return;
    }
    console.error('Failed to upsert project in Supabase:', error.message);
  }
}

export async function deleteProjectFromSupabase(id: string): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase.from('projects').delete().eq('id', id);
  if (error) {
    console.error('Failed to delete project from Supabase:', error.message);
  }
}
