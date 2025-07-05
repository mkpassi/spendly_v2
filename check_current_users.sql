-- =============================================
-- CHECK CURRENT OAUTH USERS & CREATE TEST DATA
-- =============================================

-- First, let's see what users exist in your system
SELECT 'Current Users in System' as info;
SELECT id, full_name, email, created_at FROM users ORDER BY created_at DESC LIMIT 10;

-- Check if any user settings exist
SELECT 'Current User Settings' as info;
SELECT user_id, expenses_percentage, savings_percentage, goals_percentage FROM user_settings;

-- Check current goals
SELECT 'Current Goals' as info;
SELECT user_id, title, target_amount, allocated_amount, is_active FROM goals ORDER BY created_at DESC LIMIT 5;

-- Check recent transactions
SELECT 'Recent Transactions' as info;
SELECT user_id, date, description, amount, type, budget_category FROM transactions ORDER BY created_at DESC LIMIT 5; 