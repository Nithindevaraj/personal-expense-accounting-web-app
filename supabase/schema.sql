-- ==============================================================================
-- PERSONAL & ENTERPRISE ACCOUNTING - COMPLETE SUPABASE POSTGRESQL SCHEMA WITH RLS
-- ==============================================================================
-- Architecture:
-- 1. Users & Logins (Supabase Auth: auth.users, public.profiles)
-- 2. Companies (Multi-Tenant Company Root)
-- 3. Company Divisions (company_divisions)
-- 4. Projects (Parent Projects under Company/Division)
-- 5. Jobs / Sub-Projects (Child projects under Parent Projects)
-- 6. Team & Project Member Assignments with RBAC:
--    - Roles: 'creator', 'admin', 'spender'
--    - Company Creator & Admins manage members and assign them to any project
-- 7. Expenses / Transactions (Linked to Company, Project, Job, & User)
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. USER PROFILES (Synchronized with auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT NOT NULL DEFAULT '',
    avatar_url TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Auto-create profile trigger on auth signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.profiles (id, email, name, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        name = CASE WHEN public.profiles.name = '' THEN EXCLUDED.name ELSE public.profiles.name END;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 3. COMPANIES (Root Entity for Workspaces)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    creator_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 4. COMPANY MEMBERS (Responsible persons & RBAC)
-- Roles: 'creator' (super-admin), 'admin' (management), 'spender' (operational)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.company_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    designation TEXT DEFAULT '',
    user_link TEXT DEFAULT '',
    role TEXT NOT NULL DEFAULT 'spender' CHECK (role IN ('creator', 'admin', 'spender')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (company_id, user_id)
);

-- Trigger: When a company is created, automatically register the creator as 'creator' member
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER AS $$
DECLARE
    creator_name TEXT;
BEGIN
    SELECT name INTO creator_name FROM public.profiles WHERE id = NEW.creator_id;
    IF creator_name IS NULL OR creator_name = '' THEN
        creator_name := 'Admin';
    END IF;

    INSERT INTO public.company_members (company_id, user_id, name, designation, role)
    VALUES (NEW.id, NEW.creator_id, creator_name, 'Owner / Creator', 'creator')
    ON CONFLICT (company_id, user_id) DO UPDATE SET role = 'creator';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
    AFTER INSERT ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_company();

-- ==============================================================================
-- 5. COMPANY DIVISIONS (Departments / Divisions under a Company)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.company_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (company_id, name)
);

-- ==============================================================================
-- 6. PROJECTS & JOBS (Parent Projects & Child Jobs)
-- - Projects: parent_id IS NULL (Optionally tied to division)
-- - Jobs: parent_id REFERENCES projects(id)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.projects (
    id TEXT PRIMARY KEY,
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    parent_id TEXT REFERENCES public.projects(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    budget NUMERIC(12, 2) DEFAULT 0,
    color TEXT DEFAULT '#3b82f6',
    completed BOOLEAN NOT NULL DEFAULT false,
    completed_at TIMESTAMPTZ,
    division TEXT DEFAULT NULL,
    creator_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 7. PROJECT TEAM ASSIGNMENTS (Members assigned to specific projects)
-- Managed by Company Creator and Admins
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'spender' CHECK (role IN ('admin', 'spender')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (project_id, user_id)
);

-- ==============================================================================
-- 8. EXPENSES / TRANSACTIONS
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    sl_no BIGINT,
    date DATE NOT NULL DEFAULT CURRENT_DATE,
    type TEXT NOT NULL DEFAULT 'Expense' CHECK (type IN ('Income', 'Expense')),
    category TEXT NOT NULL,
    amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
    tag TEXT DEFAULT 'General Transactions',
    sub_tag TEXT DEFAULT NULL,
    description TEXT NOT NULL DEFAULT '',
    notes TEXT DEFAULT '',
    attachments TEXT[] DEFAULT '{}'::TEXT[],
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 9. USER SETTINGS & RECURRING TRANSACTIONS (Config per user/company)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    name TEXT,
    currency TEXT DEFAULT 'INR',
    avatar_url TEXT,
    income_categories JSONB DEFAULT '[]'::JSONB,
    expense_categories JSONB DEFAULT '[]'::JSONB,
    accounts JSONB DEFAULT '[]'::JSONB,
    team_members JSONB DEFAULT '[]'::JSONB,
    recurring_transactions JSONB DEFAULT '[]'::JSONB,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 10. SECURITY HELPER FUNCTIONS (FOR SECURE & DETERMINISTIC RLS POLICIES)
-- ==============================================================================

-- Check if user is an admin or creator in the company
CREATE OR REPLACE FUNCTION public.is_company_admin(lookup_company_id TEXT, lookup_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.company_members
        WHERE company_id = lookup_company_id
          AND user_id = lookup_user_id
          AND role IN ('creator', 'admin')
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user belongs to the company in any role
CREATE OR REPLACE FUNCTION public.is_company_member(lookup_company_id TEXT, lookup_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.company_members
        WHERE company_id = lookup_company_id
          AND user_id = lookup_user_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- Check if user can modify a specific project
CREATE OR REPLACE FUNCTION public.can_manage_project(lookup_project_id TEXT, lookup_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
    target_company_id TEXT;
BEGIN
    SELECT company_id INTO target_company_id FROM public.projects WHERE id = lookup_project_id;
    IF target_company_id IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Company creators and admins can manage any project in their company
    IF public.is_company_admin(target_company_id, lookup_user_id) THEN
        RETURN TRUE;
    END IF;

    -- Project admins can manage their specific project
    RETURN EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = lookup_project_id
          AND user_id = lookup_user_id
          AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 11. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.company_divisions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.project_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- PROFILES
DROP POLICY IF EXISTS "Public profiles read" ON public.profiles;
CREATE POLICY "Public profiles read" ON public.profiles FOR SELECT USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles FOR ALL USING (auth.uid() = id);

-- COMPANIES
DROP POLICY IF EXISTS "Members can view their companies" ON public.companies;
CREATE POLICY "Members can view their companies" ON public.companies
    FOR SELECT USING (creator_id = auth.uid() OR public.is_company_member(id, auth.uid()));

DROP POLICY IF EXISTS "Users can insert companies" ON public.companies;
CREATE POLICY "Users can insert companies" ON public.companies
    FOR INSERT WITH CHECK (creator_id = auth.uid());

DROP POLICY IF EXISTS "Admins can update company" ON public.companies;
CREATE POLICY "Admins can update company" ON public.companies
    FOR UPDATE USING (creator_id = auth.uid() OR public.is_company_admin(id, auth.uid()));

DROP POLICY IF EXISTS "Creators can delete company" ON public.companies;
CREATE POLICY "Creators can delete company" ON public.companies
    FOR DELETE USING (creator_id = auth.uid());

-- COMPANY MEMBERS
DROP POLICY IF EXISTS "Members can view company members" ON public.company_members;
CREATE POLICY "Members can view company members" ON public.company_members
    FOR SELECT USING (public.is_company_member(company_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can manage company members" ON public.company_members;
CREATE POLICY "Admins can manage company members" ON public.company_members
    FOR ALL USING (public.is_company_admin(company_id, auth.uid()))
    WITH CHECK (public.is_company_admin(company_id, auth.uid()));

-- COMPANY DIVISIONS
DROP POLICY IF EXISTS "Members can view divisions" ON public.company_divisions;
CREATE POLICY "Members can view divisions" ON public.company_divisions
    FOR SELECT USING (public.is_company_member(company_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can manage divisions" ON public.company_divisions;
CREATE POLICY "Admins can manage divisions" ON public.company_divisions
    FOR ALL USING (public.is_company_admin(company_id, auth.uid()))
    WITH CHECK (public.is_company_admin(company_id, auth.uid()));

-- PROJECTS
DROP POLICY IF EXISTS "Members can view company projects" ON public.projects;
CREATE POLICY "Members can view company projects" ON public.projects
    FOR SELECT USING (public.is_company_member(company_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can insert projects" ON public.projects;
CREATE POLICY "Admins can insert projects" ON public.projects
    FOR INSERT WITH CHECK (public.is_company_admin(company_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can update projects" ON public.projects;
CREATE POLICY "Admins can update projects" ON public.projects
    FOR UPDATE USING (public.can_manage_project(id, auth.uid()));

DROP POLICY IF EXISTS "Admins can delete projects" ON public.projects;
CREATE POLICY "Admins can delete projects" ON public.projects
    FOR DELETE USING (public.is_company_admin(company_id, auth.uid()));

-- PROJECT MEMBERS
DROP POLICY IF EXISTS "Members can view project members" ON public.project_members;
CREATE POLICY "Members can view project members" ON public.project_members
    FOR SELECT USING (public.is_company_member(company_id, auth.uid()));

DROP POLICY IF EXISTS "Admins can manage project members" ON public.project_members;
CREATE POLICY "Admins can manage project members" ON public.project_members
    FOR ALL USING (public.is_company_admin(company_id, auth.uid()))
    WITH CHECK (public.is_company_admin(company_id, auth.uid()));

-- EXPENSES
DROP POLICY IF EXISTS "Members can view company expenses" ON public.expenses;
CREATE POLICY "Members can view company expenses" ON public.expenses
    FOR SELECT USING (public.is_company_member(company_id, auth.uid()));

DROP POLICY IF EXISTS "Members can insert expenses" ON public.expenses;
CREATE POLICY "Members can insert expenses" ON public.expenses
    FOR INSERT WITH CHECK (public.is_company_member(company_id, auth.uid()) AND auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins or authors can update expenses" ON public.expenses;
CREATE POLICY "Admins or authors can update expenses" ON public.expenses
    FOR UPDATE USING (public.is_company_admin(company_id, auth.uid()) OR auth.uid() = user_id);

DROP POLICY IF EXISTS "Admins or authors can delete expenses" ON public.expenses;
CREATE POLICY "Admins or authors can delete expenses" ON public.expenses
    FOR DELETE USING (public.is_company_admin(company_id, auth.uid()) OR auth.uid() = user_id);

-- USER SETTINGS
DROP POLICY IF EXISTS "Users can view and edit own settings" ON public.user_settings;
CREATE POLICY "Users can view and edit own settings" ON public.user_settings
    FOR ALL USING (auth.uid() = user_id)
    WITH CHECK (auth.uid() = user_id);

-- ==============================================================================
-- 12. INDEXES FOR HIGH-SPEED QUERIES
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_comp_mem_comp_user ON public.company_members (company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_comp_mem_user ON public.company_members (user_id);
CREATE INDEX IF NOT EXISTS idx_proj_comp ON public.projects (company_id);
CREATE INDEX IF NOT EXISTS idx_proj_parent ON public.projects (parent_id);
CREATE INDEX IF NOT EXISTS idx_proj_mem_proj_user ON public.project_members (project_id, user_id);
CREATE INDEX IF NOT EXISTS idx_expenses_comp_date ON public.expenses (company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_proj ON public.expenses (project_id);

-- ==============================================================================
-- 13. GRANTS
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
