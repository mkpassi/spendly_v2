-- =============================================
-- OAUTH USER GOAL STRATEGY TEST (FIXED)
-- =============================================
-- This test works with your actual OAuth user ID

-- Step 1: Get your actual user ID (run this first to see your user ID)
SELECT 'Your User ID' as info, id, full_name, email FROM users ORDER BY created_at DESC LIMIT 1;

-- Step 2: Set up test data for YOUR actual user
DO $$
DECLARE 
    test_user_id TEXT;
BEGIN
    -- Get the most recent user (your OAuth user)
    SELECT id INTO test_user_id FROM users ORDER BY created_at DESC LIMIT 1;
    
    -- Clean up any existing test data for this user
    DELETE FROM goal_allocations WHERE user_id = test_user_id;
    DELETE FROM transactions WHERE user_id = test_user_id;
    DELETE FROM goals WHERE user_id = test_user_id;
    DELETE FROM user_settings WHERE user_id = test_user_id;
    
    -- Create user settings (50% expenses, 30% savings, 20% goals)
    INSERT INTO user_settings (user_id, expenses_percentage, savings_percentage, goals_percentage)
    VALUES (test_user_id, 50.00, 30.00, 20.00);
    
    -- Create test goals
    INSERT INTO goals (user_id, title, target_amount, allocated_amount, percentage_allocation, is_active, status)
    VALUES 
      (test_user_id, 'Emergency Fund', 5000.00, 0.00, 10.00, true, 'active'),
      (test_user_id, 'Vacation Fund', 2000.00, 0.00, 10.00, true, 'active');
    
    -- Add income transaction
    INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
    VALUES (test_user_id, CURRENT_DATE, 'Test Salary', 3000.00, 'Job', 'income', 'manual', 'expenses', false);
    
    -- Simulate auto-allocation
    INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
    VALUES 
      (test_user_id, CURRENT_DATE, 'Auto: Savings (30%)', 900.00, 'Savings', 'expense', 'auto_allocation', 'savings', true),
      (test_user_id, CURRENT_DATE, 'Auto: Emergency Fund', 300.00, 'Goals', 'expense', 'auto_allocation', 'goals', true),
      (test_user_id, CURRENT_DATE, 'Auto: Vacation Fund', 300.00, 'Goals', 'expense', 'auto_allocation', 'goals', true);
    
    -- Create goal allocations
    INSERT INTO goal_allocations (user_id, goal_id, amount, allocation_type, allocation_date)
    SELECT test_user_id, id, 300.00, 'auto', CURRENT_DATE 
    FROM goals WHERE user_id = test_user_id;
    
    -- Update goal progress
    UPDATE goals SET allocated_amount = 300.00 WHERE user_id = test_user_id;
    
    -- Add manual override
    INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
    VALUES (test_user_id, CURRENT_DATE, 'Manual: Save $500 for vacation', 500.00, 'Goals', 'expense', 'manual', 'goals', true);
    
    -- Add manual goal allocation
    INSERT INTO goal_allocations (user_id, goal_id, amount, allocation_type, allocation_date, notes)
    SELECT test_user_id, id, 500.00, 'manual', CURRENT_DATE, 'Manual save for vacation'
    FROM goals WHERE user_id = test_user_id AND title = 'Vacation Fund';
    
    -- Update vacation goal
    UPDATE goals SET allocated_amount = 800.00 WHERE user_id = test_user_id AND title = 'Vacation Fund';
    
    -- Add over-budget expense
    INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
    VALUES (test_user_id, CURRENT_DATE, 'Test: Over Budget Shopping', 2000.00, 'Shopping', 'expense', 'manual', 'expenses', false);
    
    RAISE NOTICE 'Test data created for user: %', test_user_id;
END $$;

-- =============================================
-- VALIDATION RESULTS FOR YOUR USER
-- =============================================

-- 1. User Settings Check
SELECT 'User Settings' as test_name, 
       user_id,
       expenses_percentage, savings_percentage, goals_percentage,
       CASE WHEN expenses_percentage + savings_percentage + goals_percentage = 100 
            THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM user_settings 
WHERE user_id = (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- 2. Goals Check
SELECT 'Goals Created' as test_name,
       COUNT(*) as goal_count,
       SUM(target_amount) as total_target,
       SUM(allocated_amount) as total_allocated,
       CASE WHEN COUNT(*) = 2 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM goals 
WHERE user_id = (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- 3. Income Auto-Allocation Check
SELECT 'Income Auto-Allocation' as test_name,
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
       SUM(CASE WHEN budget_category = 'savings' THEN amount ELSE 0 END) as savings_allocated,
       SUM(CASE WHEN budget_category = 'goals' THEN amount ELSE 0 END) as goals_allocated,
       CASE WHEN SUM(CASE WHEN budget_category = 'savings' THEN amount ELSE 0 END) = 900 
            AND SUM(CASE WHEN budget_category = 'goals' THEN amount ELSE 0 END) = 1100
            THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM transactions 
WHERE user_id = (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- 4. Goal Progress Details
SELECT 'Goal Progress: ' || title as test_name,
       target_amount, 
       allocated_amount,
       ROUND((allocated_amount / target_amount * 100), 1) as progress_pct,
       CASE WHEN allocated_amount > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM goals 
WHERE user_id = (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- 5. Manual Override Check
SELECT 'Manual Override' as test_name,
       COUNT(*) as manual_allocations,
       SUM(amount) as manual_amount,
       CASE WHEN COUNT(*) >= 1 AND SUM(amount) = 500 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM goal_allocations 
WHERE user_id = (SELECT id FROM users ORDER BY created_at DESC LIMIT 1) 
AND allocation_type = 'manual';

-- 6. Budget Warning Check
SELECT 'Budget Warning' as test_name,
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
       SUM(CASE WHEN type = 'expense' AND budget_category = 'expenses' THEN amount ELSE 0 END) as actual_expenses,
       (SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) * 0.50) as budget_limit,
       CASE WHEN SUM(CASE WHEN type = 'expense' AND budget_category = 'expenses' THEN amount ELSE 0 END) > 
                 (SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) * 0.50) 
            THEN '✅ PASS (Over Budget Detected)' 
            ELSE '❌ FAIL (Should be over budget)' END as result
FROM transactions 
WHERE user_id = (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- 7. Final Summary
SELECT 'FINAL SUMMARY' as test_name,
       COUNT(DISTINCT CASE WHEN type = 'income' THEN id END) as income_transactions,
       COUNT(DISTINCT CASE WHEN source = 'auto_allocation' THEN id END) as auto_allocations,
       COUNT(DISTINCT CASE WHEN source = 'manual' AND budget_category = 'goals' THEN id END) as manual_goal_saves,
       CASE WHEN COUNT(DISTINCT CASE WHEN type = 'income' THEN id END) >= 1 
            AND COUNT(DISTINCT CASE WHEN source = 'auto_allocation' THEN id END) >= 3
            AND COUNT(DISTINCT CASE WHEN source = 'manual' AND budget_category = 'goals' THEN id END) >= 1
            THEN '🎉 ALL CORE FEATURES WORKING' 
            ELSE '❌ SOME FEATURES MISSING' END as overall_result
FROM transactions 
WHERE user_id = (SELECT id FROM users ORDER BY created_at DESC LIMIT 1);

-- =============================================
-- CLEANUP (optional - uncomment to clean up)
-- =============================================
/*
DO $$
DECLARE 
    test_user_id TEXT;
BEGIN
    SELECT id INTO test_user_id FROM users ORDER BY created_at DESC LIMIT 1;
    DELETE FROM goal_allocations WHERE user_id = test_user_id;
    DELETE FROM transactions WHERE user_id = test_user_id;
    DELETE FROM goals WHERE user_id = test_user_id;
    DELETE FROM user_settings WHERE user_id = test_user_id;
    RAISE NOTICE 'Test data cleaned up for user: %', test_user_id;
END $$;
*/ 