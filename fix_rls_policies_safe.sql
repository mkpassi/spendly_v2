-- Run this in your Supabase Dashboard > SQL Editor
-- This safely fixes Row Level Security policies for authenticated users

-- Drop ALL existing policies (including any that might already exist)
DO $$ 
DECLARE
    r RECORD;
BEGIN
    -- Drop all existing policies for our tables
    FOR r IN (SELECT policyname, tablename FROM pg_policies WHERE tablename IN ('users', 'transactions', 'goals', 'chat_messages'))
    LOOP
        EXECUTE 'DROP POLICY IF EXISTS "' || r.policyname || '" ON ' || r.tablename;
    END LOOP;
END $$;

-- Create new policies for authenticated users
-- Users table - allow users to manage their own profile
CREATE POLICY "Users can view own profile" ON users FOR SELECT TO authenticated USING (auth.uid()::text = id);
CREATE POLICY "Users can update own profile" ON users FOR UPDATE TO authenticated USING (auth.uid()::text = id);
CREATE POLICY "Users can insert own profile" ON users FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = id);

-- Transactions table - allow users to manage their own transactions
CREATE POLICY "Users can view own transactions" ON transactions FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own transactions" ON transactions FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own transactions" ON transactions FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own transactions" ON transactions FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- Goals table - allow users to manage their own goals
CREATE POLICY "Users can view own goals" ON goals FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own goals" ON goals FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own goals" ON goals FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own goals" ON goals FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- Chat messages table - allow users to manage their own chat messages
CREATE POLICY "Users can view own chat messages" ON chat_messages FOR SELECT TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can insert own chat messages" ON chat_messages FOR INSERT TO authenticated WITH CHECK (auth.uid()::text = user_id);
CREATE POLICY "Users can update own chat messages" ON chat_messages FOR UPDATE TO authenticated USING (auth.uid()::text = user_id);
CREATE POLICY "Users can delete own chat messages" ON chat_messages FOR DELETE TO authenticated USING (auth.uid()::text = user_id);

-- Keep anonymous access for backward compatibility (optional)
CREATE POLICY "Allow anonymous access" ON users FOR ALL TO anon USING (id = 'anonymous_user');
CREATE POLICY "Allow anonymous access" ON transactions FOR ALL TO anon USING (user_id = 'anonymous_user');
CREATE POLICY "Allow anonymous access" ON goals FOR ALL TO anon USING (user_id = 'anonymous_user');
CREATE POLICY "Allow anonymous access" ON chat_messages FOR ALL TO anon USING (user_id = 'anonymous_user');

-- Show current policies for verification
SELECT 
    schemaname, 
    tablename, 
    policyname, 
    permissive, 
    roles, 
    cmd, 
    CASE 
        WHEN qual IS NOT NULL THEN substring(qual from 1 for 50) || '...'
        ELSE 'N/A'
    END as qual_preview,
    CASE 
        WHEN with_check IS NOT NULL THEN substring(with_check from 1 for 50) || '...'
        ELSE 'N/A'
    END as with_check_preview
FROM pg_policies 
WHERE tablename IN ('users', 'transactions', 'goals', 'chat_messages')
ORDER BY tablename, policyname; 