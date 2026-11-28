import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Project, ProjectTeamAssignment } from '../types';
import { getStoredProjects, saveStoredProjects } from '../utils/storage';

interface DbProjectRow {
  id: string;
  user_id?: string;
  company_id?: string;
  account_id?: string;
  parent_id: string | null;
  name: string;
  description: string | null;
  budget: number | null;
  color: string | null;
  completed: boolean;
  completed_at: string | null;
  division?: string | null;
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
    division: row.division || null,
    ownerId: row.user_id || undefined,
    teamMembers: Array.isArray(row.team_members) ? row.team_members : undefined,
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function mapProjectToPayload(
  project: Project,
  accountId: string = 'default',
  includeExtendedFields: boolean = true
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
    company_id: accountId,
    division: project.division ? project.division.trim() || null : null,
  };

  if (!includeExtendedFields) return base;
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
    .or(`company_id.eq.${accountId},account_id.eq.${accountId}`)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch projects from Supabase:', error.message);
    return getStoredProjects(accountId);
  }

  const localStored = getStoredProjects(accountId);
  const localById = new Map(localStored.map((p) => [p.id, p]));

  const rows = (data as DbProjectRow[]) || [];
  const mapped = rows
    .map((row) => {
      const proj = mapRowToProject(row);
      const localProj = localById.get(proj.id);
      // Preserve local division if row does not have division or if locally set and cloud is null
      if (localProj && localProj.division && !proj.division) {
        proj.division = localProj.division;
      }
      return proj;
    })
    .filter((p) => {
      // Exclude legacy demo projects and general transactions
      const id = p.id.toLowerCase();
      const name = p.name.toLowerCase();
      if (id === 'proj-general' || id.endsWith('-proj-general') || name === 'general transactions') return false;
      if (id.includes('demo') || name.includes('demo project') || name.includes('demo job')) return false;
      return true;
    })
    .sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0) || a.id.localeCompare(b.id));

  saveStoredProjects(mapped, accountId);
  return mapped;
}

export async function upsertProjectToSupabase(
  project: Project,
  accountId: string = 'default'
): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { data: authData } = await supabase.auth.getUser();
  const currentUid = authData?.user?.id;

  // Always attempt full upsert first including division & creator
  const fullPayload = {
    ...mapProjectToPayload(project, accountId, true),
    ...(currentUid ? { creator_id: currentUid } : {}),
  };

  const { error } = await supabase
    .from('projects')
    .upsert([fullPayload], { onConflict: 'id' });

  if (error) {
    // If error was caused by missing team_members column, fallback payload without team_members but KEEP division
    if (error.message.includes('team_members')) {
      const payloadWithoutTeam = {
        ...mapProjectToPayload(project, accountId, false),
        ...(currentUid ? { creator_id: currentUid } : {}),
      };
      const { error: teamError } = await supabase
        .from('projects')
        .upsert([payloadWithoutTeam], { onConflict: 'id' });
      if (teamError) {
        // If division column specifically is absent from remote DB, strip division
        if (teamError.message.includes('division')) {
          const { division: _d, ...payloadWithoutDiv } = payloadWithoutTeam;
          const { error: divFallbackError } = await supabase
            .from('projects')
            .upsert([payloadWithoutDiv], { onConflict: 'id' });
          if (divFallbackError) {
            console.error('Failed to upsert project in Supabase (fallback):', divFallbackError.message);
          }
        } else {
          console.error('Failed to upsert project in Supabase:', teamError.message);
        }
      }
      return;
    }

    if (error.message.includes('division')) {
      const payloadWithoutTeam = {
        ...mapProjectToPayload(project, accountId, false),
        ...(currentUid ? { creator_id: currentUid } : {}),
      };
      const { division: _d, ...payloadWithoutDiv } = payloadWithoutTeam;
      const { error: divFallbackError } = await supabase
        .from('projects')
        .upsert([payloadWithoutDiv], { onConflict: 'id' });
      if (divFallbackError) {
        console.error('Failed to upsert project in Supabase (fallback):', divFallbackError.message);
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
