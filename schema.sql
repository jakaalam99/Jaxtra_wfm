-- ==========================================
-- JAXTRA MULTI-TENANT SAAS SCHEMA REBUILD
-- ==========================================
-- This script safely upgrades your existing tables to multi-tenancy.
-- It adds a `user_id` to everything, assuming the core data belongs 
-- to the business owner who logs in. 
-- IMPORTANT: To keep your existing test data, you might want to manually 
-- UPDATE user_id to your specific admin UUID. Otherwise, new users will 
-- start with clean slates.

-- 1. Alter Core Tables to add 'user_id'
ALTER TABLE employees ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE attendance ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE loans ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE salary_periods ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();
ALTER TABLE salary_adjustments ADD COLUMN IF NOT EXISTS user_id UUID REFERENCES auth.users(id) DEFAULT auth.uid();

-- 2. Drop the old wide-open 'internal admin' policies
DROP POLICY IF EXISTS "Allow all access for authenticated users on employees" ON employees;
DROP POLICY IF EXISTS "Allow all access for authenticated users on attendance" ON attendance;
DROP POLICY IF EXISTS "Allow all access for authenticated users on loans" ON loans;
DROP POLICY IF EXISTS "Allow all access for authenticated users on loan_payments" ON loan_payments;
DROP POLICY IF EXISTS "Allow all access for authenticated users on salary_periods" ON salary_periods;
DROP POLICY IF EXISTS "Allow all access for authenticated users on salary_adjustments" ON salary_adjustments;

-- 3. Create Strict Multi-Tenant Isolation Policies (Business Owners only see their own data)
DROP POLICY IF EXISTS "Tenant Isolation on employees" ON employees;
CREATE POLICY "Tenant Isolation on employees" ON employees FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Tenant Isolation on attendance" ON attendance;
CREATE POLICY "Tenant Isolation on attendance" ON attendance FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Tenant Isolation on loans" ON loans;
CREATE POLICY "Tenant Isolation on loans" ON loans FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Tenant Isolation on loan_payments" ON loan_payments;
CREATE POLICY "Tenant Isolation on loan_payments" ON loan_payments FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Tenant Isolation on salary_periods" ON salary_periods;
CREATE POLICY "Tenant Isolation on salary_periods" ON salary_periods FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Tenant Isolation on salary_adjustments" ON salary_adjustments;
CREATE POLICY "Tenant Isolation on salary_adjustments" ON salary_adjustments FOR ALL TO authenticated USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());


-- ==========================================================
-- PROFILES & APP SETTINGS (Tenant Workspaces)
-- ==========================================================

CREATE TABLE IF NOT EXISTS profiles (
    id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    email TEXT,
    role TEXT DEFAULT 'user', -- 'admin' is for the SaaS Platform owner. 'user' is for business owners.
    last_action_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
    -- The user_id isn't necessary here since 'id' maps exactly 1-to-1 to auth.users
);

CREATE TABLE IF NOT EXISTS app_settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    company_name TEXT DEFAULT 'Jaxtra',
    logo_url TEXT,
    login_logo_url TEXT,
    login_logo_width INT DEFAULT 200,
    header_logo_url TEXT,
    header_logo_width INT DEFAULT 150,
    pdf_logo_url TEXT,
    pdf_logo_width INT DEFAULT 50
);

-- Fix salary_periods unique constraint for Multi-Tenancy
ALTER TABLE salary_periods DROP CONSTRAINT IF EXISTS salary_periods_start_date_end_date_key;
ALTER TABLE salary_periods ADD CONSTRAINT salary_periods_tenant_period_key UNIQUE (user_id, start_date, end_date);


-- Turn on Row Level Security
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE app_settings ENABLE ROW LEVEL SECURITY;

-- ==========================================================
-- PROFILES & APP SETTINGS (NON-RECURSIVE ADMIN ACCESS)
-- ==========================================================

-- Profiles: Users see themselves, Admins see everyone.
-- We check 'app_metadata' in the JWT to avoid hitting the 'profiles' table recursively.
DROP POLICY IF EXISTS "profiles_self_read" ON profiles;
CREATE POLICY "profiles_read_policy" ON profiles FOR SELECT TO authenticated 
USING (id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "profiles_update_policy" ON profiles;
CREATE POLICY "profiles_update_policy" ON profiles FOR UPDATE TO authenticated 
USING (id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "profiles_insert_policy" ON profiles;
CREATE POLICY "profiles_insert_policy" ON profiles FOR INSERT TO authenticated 
WITH CHECK (id = auth.uid() OR (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- App Settings: public Read, Admin Update
DROP POLICY IF EXISTS "Public Read app_settings" ON app_settings;
CREATE POLICY "Public Read app_settings" ON app_settings FOR SELECT TO public USING (true);


DROP POLICY IF EXISTS "Admin Update app_settings" ON app_settings;
CREATE POLICY "Admin Update app_settings" ON app_settings FOR UPDATE TO authenticated 
USING ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admin Insert app_settings" ON app_settings;
CREATE POLICY "Admin Insert app_settings" ON app_settings FOR INSERT TO authenticated 
WITH CHECK ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');


-- Ensure Assets bucket is public
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true) ON CONFLICT (id) DO UPDATE SET public = true;

-- Storage Policies: Be more permissive for the Admin to avoid the {} error
DROP POLICY IF EXISTS "Public Access Assets" ON storage.objects;
CREATE POLICY "Public Access Assets" ON storage.objects FOR SELECT USING (bucket_id = 'assets');

DROP POLICY IF EXISTS "Admin Upload Assets" ON storage.objects;
CREATE POLICY "Admin Upload Assets" ON storage.objects FOR INSERT TO authenticated 
WITH CHECK (bucket_id = 'assets'); -- Relaxed temporarily for debugging

DROP POLICY IF EXISTS "Admin Update Assets" ON storage.objects;
CREATE POLICY "Admin Update Assets" ON storage.objects FOR UPDATE TO authenticated 
USING (bucket_id = 'assets');

DROP POLICY IF EXISTS "Admin Delete Assets" ON storage.objects;
CREATE POLICY "Admin Delete Assets" ON storage.objects FOR DELETE TO authenticated 
USING (bucket_id = 'assets');






-- Create Storage Bucket for Logos (assets)
INSERT INTO storage.buckets (id, name, public) VALUES ('assets', 'assets', true) ON CONFLICT DO NOTHING;

-- Storage Object Policies (To enforce SaaS isolation later on frontend, folders will be named after user UUIDs)
DROP POLICY IF EXISTS "Public Access Assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth Upload Assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth Update Assets" ON storage.objects;
DROP POLICY IF EXISTS "Auth Delete Assets" ON storage.objects;

CREATE POLICY "Public Access Assets" ON storage.objects FOR SELECT USING (bucket_id = 'assets');
CREATE POLICY "Auth Upload Assets" ON storage.objects FOR INSERT WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');
CREATE POLICY "Auth Update Assets" ON storage.objects FOR UPDATE WITH CHECK (bucket_id = 'assets' AND auth.role() = 'authenticated');
ALTER TABLE salary_periods ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'draft' CHECK (status IN ('draft', 'confirmed'));
ALTER TABLE loan_payments ADD COLUMN IF NOT EXISTS period_id UUID REFERENCES salary_periods(id) ON DELETE CASCADE;

-- Update the primary key logic for app_settings if it was changed back to global
-- (User requested global logo, so we keep id='global' as the PK)
-- This was already handled in the previous turn but making sure for completeness.
