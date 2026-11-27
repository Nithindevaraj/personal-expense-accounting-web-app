-- ==============================================================================
-- PERSONAL & ENTERPRISE ACCOUNTING - COMPLETE SUPABASE POSTGRESQL SCHEMA WITH RLS
-- ==============================================================================
-- Architecture:
-- 1. Extensions & Helpers
-- 2. User Profiles (public.profiles with 16-digit user_code, auto-generated from auth.users)
-- 3. Companies (public.companies with unique human-readable company_code)
-- 4. Company Members (public.company_members linking profiles and companies with ON DELETE CASCADE)
-- 5. Company Divisions (public.company_divisions - optional parent for projects)
-- 6. Projects & Jobs (public.projects - standalone or under division, with child jobs)
-- 7. Project Members (public.project_members with ON DELETE CASCADE)
-- 8. Expenses / Transactions (public.expenses - standalone or tied to project/job)
-- 9. User Settings (public.user_settings)
-- 10. Login History (public.user_login_logs - records each login with name & code)
-- 11. Row-Level Security (RLS) & Triggers
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Helper function to generate clean 16-digit formatted code (e.g., 4829-1092-3849-2910)
CREATE OR REPLACE FUNCTION public.generate_user_code(user_uuid UUID)
RETURNS TEXT AS $$
DECLARE
    clean TEXT;
    h1 BIGINT := 0;
    h2 BIGINT := 0;
    i INT;
    c INT;
    p1 TEXT;
    p2 TEXT;
    raw16 TEXT;
BEGIN
    clean := lower(replace(user_uuid::TEXT, '-', ''));
    FOR i IN 1..length(clean) LOOP
        c := ascii(substr(clean, i, 1));
        h1 := (h1 * 31 + c) % 100000000;
        h2 := (h2 * 37 + c) % 100000000;
    END LOOP;
    p1 := lpad(abs(h1)::TEXT, 8, '0');
    p2 := lpad(abs(h2)::TEXT, 8, '0');
    raw16 := substr(p1 || p2, 1, 16);
    RETURN substr(raw16, 1, 4) || '-' || substr(raw16, 5, 4) || '-' || substr(raw16, 9, 4) || '-' || substr(raw16, 13, 4);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- Helper function to generate random company code (e.g., CMP-7492-1830)
CREATE OR REPLACE FUNCTION public.generate_company_code()
RETURNS TEXT AS $$
DECLARE
    rand_digits TEXT;
BEGIN
    rand_digits := lpad((floor(random() * 90000000) + 10000000)::TEXT, 8, '0');
    RETURN 'CMP-' || substr(rand_digits, 1, 4) || '-' || substr(rand_digits, 5, 4);
END;
$$ LANGUAGE plpgsql VOLATILE;

-- ==============================================================================
-- 2. USER PROFILES (Synchronized with auth.users)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    name TEXT NOT NULL DEFAULT '',
    user_code TEXT UNIQUE,
    avatar_url TEXT,
    currency TEXT NOT NULL DEFAULT 'INR',
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. USER LOGIN AUDIT LOG (Records each login event with User Name & 16-digit code)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_login_logs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    user_name TEXT NOT NULL DEFAULT '',
    user_code TEXT NOT NULL DEFAULT '',
    logged_in_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- Auto-create/sync profile trigger on auth signup or login
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    computed_name TEXT;
    computed_code TEXT;
BEGIN
    computed_name := COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
    computed_code := public.generate_user_code(NEW.id);

    INSERT INTO public.profiles (id, email, name, user_code, avatar_url)
    VALUES (
        NEW.id,
        NEW.email,
        computed_name,
        computed_code,
        NEW.raw_user_meta_data->>'avatar_url'
    )
    ON CONFLICT (id) DO UPDATE
    SET email = EXCLUDED.email,
        user_code = COALESCE(public.profiles.user_code, EXCLUDED.user_code),
        name = CASE WHEN public.profiles.name = '' THEN EXCLUDED.name ELSE public.profiles.name END,
        updated_at = timezone('utc'::text, now());

    -- Record login event
    INSERT INTO public.user_login_logs (user_id, user_name, user_code)
    VALUES (NEW.id, computed_name, computed_code);

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ==============================================================================
-- 4. COMPANIES (Root Entity for Workspaces with Unique Company Code)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    company_code TEXT UNIQUE NOT NULL DEFAULT public.generate_company_code(),
    creator_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 5. COMPANY MEMBERS (Junction linking profiles and companies with ON DELETE CASCADE)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.company_members (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::TEXT,
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    member_code TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Team Member',
    designation TEXT DEFAULT 'Member',
    role TEXT NOT NULL DEFAULT 'spender' CHECK (role IN ('creator', 'admin', 'spender')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (company_id, user_id)
);

-- Trigger: When a company is created, register the creator as 'creator' member automatically
CREATE OR REPLACE FUNCTION public.handle_new_company()
RETURNS TRIGGER AS $$
DECLARE
    creator_name TEXT;
    creator_code TEXT;
BEGIN
    SELECT name, user_code INTO creator_name, creator_code FROM public.profiles WHERE id = NEW.creator_id;
    IF creator_name IS NULL OR creator_name = '' THEN
        creator_name := 'Owner';
    END IF;
    IF creator_code IS NULL THEN
        creator_code := public.generate_user_code(NEW.creator_id);
    END IF;

    INSERT INTO public.company_members (company_id, user_id, member_code, name, designation, role)
    VALUES (NEW.id, NEW.creator_id, creator_code, creator_name, 'Owner / Creator', 'creator')
    ON CONFLICT (company_id, user_id) DO UPDATE SET role = 'creator';

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_company_created ON public.companies;
CREATE TRIGGER on_company_created
    AFTER INSERT ON public.companies
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_company();

-- ==============================================================================
-- 6. COMPANY DIVISIONS (Optional Departments under a Company)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.company_divisions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (company_id, name)
);

-- ==============================================================================
-- 7. PROJECTS & JOBS (Parent Projects & Child Jobs)
-- - Projects can be standalone (division IS NULL) or under a division
-- - Parent projects: parent_id IS NULL
-- - Child jobs: parent_id REFERENCES projects(id)
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
    creator_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 8. PROJECT TEAM ASSIGNMENTS (Members assigned to specific projects)
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.project_members (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    project_id TEXT NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
    role TEXT NOT NULL DEFAULT 'spender' CHECK (role IN ('admin', 'spender')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE (project_id, user_id)
);

-- ==============================================================================
-- 9. EXPENSES / TRANSACTIONS
-- - Directly supports standalone company expenses (project_id IS NULL)
-- - Or tied to a Project / Job (project_id REFERENCES projects(id))
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.expenses (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    company_id TEXT NOT NULL REFERENCES public.companies(id) ON DELETE CASCADE,
    project_id TEXT REFERENCES public.projects(id) ON DELETE SET NULL,
    user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
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
-- 10. USER SETTINGS & PREFERENCES
-- ==============================================================================
CREATE TABLE IF NOT EXISTS public.user_settings (
    user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
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
-- 11. SECURITY HELPER FUNCTIONS FOR RLS
-- ==============================================================================

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

CREATE OR REPLACE FUNCTION public.can_manage_project(lookup_project_id TEXT, lookup_user_id UUID DEFAULT auth.uid())
RETURNS BOOLEAN AS $$
DECLARE
    target_company_id TEXT;
BEGIN
    SELECT company_id INTO target_company_id FROM public.projects WHERE id = lookup_project_id;
    IF target_company_id IS NULL THEN
        RETURN FALSE;
    END IF;

    IF public.is_company_admin(target_company_id, lookup_user_id) THEN
        RETURN TRUE;
    END IF;

    RETURN EXISTS (
        SELECT 1 FROM public.project_members
        WHERE project_id = lookup_project_id
          AND user_id = lookup_user_id
          AND role = 'admin'
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER STABLE;

-- ==============================================================================
-- 12. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_login_logs ENABLE ROW LEVEL SECURITY;
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

-- LOGIN LOGS
DROP POLICY IF EXISTS "Users can view own login logs" ON public.user_login_logs;
CREATE POLICY "Users can view own login logs" ON public.user_login_logs FOR SELECT USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can insert own login logs" ON public.user_login_logs;
CREATE POLICY "Users can insert own login logs" ON public.user_login_logs FOR INSERT WITH CHECK (auth.uid() = user_id);

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
-- 13. INDEXES FOR PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_profiles_user_code ON public.profiles (user_code);
CREATE INDEX IF NOT EXISTS idx_companies_company_code ON public.companies (company_code);
CREATE INDEX IF NOT EXISTS idx_comp_mem_comp_user ON public.company_members (company_id, user_id);
CREATE INDEX IF NOT EXISTS idx_comp_mem_code ON public.company_members (member_code);
CREATE INDEX IF NOT EXISTS idx_proj_comp ON public.projects (company_id);
CREATE INDEX IF NOT EXISTS idx_proj_parent ON public.projects (parent_id);
CREATE INDEX IF NOT EXISTS idx_expenses_comp_date ON public.expenses (company_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_expenses_proj ON public.expenses (project_id);

-- ==============================================================================
-- 14. GRANTS
-- ==============================================================================
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;

-- ==============================================================================
-- 15. STORAGE BUCKET FOR RECEIPTS
-- ==============================================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('receipts', 'receipts', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public can view receipt images" ON storage.objects;
CREATE POLICY "Public can view receipt images" ON storage.objects
    FOR SELECT USING (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Authenticated users can upload receipts" ON storage.objects;
CREATE POLICY "Authenticated users can upload receipts" ON storage.objects
    FOR INSERT TO authenticated
    WITH CHECK (bucket_id = 'receipts');

DROP POLICY IF EXISTS "Authenticated users can update their receipts" ON storage.objects;
CREATE POLICY "Authenticated users can update their receipts" ON storage.objects
    FOR UPDATE TO authenticated
    USING (bucket_id = 'receipts');
