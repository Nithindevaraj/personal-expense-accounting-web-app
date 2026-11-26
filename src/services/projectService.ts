import { supabase, isSupabaseConfigured } from '../lib/supabase';
import type { Project } from '../types';
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
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
  };
}

function mapProjectToPayload(project: Project) {
  return {
    id: project.id,
    parent_id: project.parentId || null,
    name: project.name,
    description: project.description || '',
    budget: project.budget ?? 0,
    color: project.color || '#3b82f6',
    completed: Boolean(project.completed),
    completed_at: project.completedAt ? new Date(project.completedAt).toISOString() : null,
  };
}

export async function getProjectsFromSupabase(): Promise<Project[]> {
  if (!isSupabaseConfigured) {
    return getStoredProjects();
  }

  const { data, error } = await supabase
    .from('projects')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Failed to fetch projects from Supabase:', error.message);
    return getStoredProjects();
  }

  const rows = (data as DbProjectRow[]) || [];
  if (rows.length === 0) {
    const localProjects = getStoredProjects();
    for (const proj of localProjects) {
      await upsertProjectToSupabase(proj);
    }
    return localProjects;
  }

  const mapped = rows.map(mapRowToProject);
  saveStoredProjects(mapped);
  return mapped;
}

export async function upsertProjectToSupabase(project: Project): Promise<void> {
  if (!isSupabaseConfigured) return;

  const { error } = await supabase
    .from('projects')
    .upsert([mapProjectToPayload(project)], { onConflict: 'id' });

  if (error) {
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
