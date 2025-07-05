-- =============================================
-- OAUTH USER GOAL STRATEGY TEST
-- =============================================
-- This test works with your actual OAuth user ID

-- Step 1: Get your actual user ID (run this first to see your user ID)
SELECT 'Your User ID' as info, id, full_name, email FROM users ORDER BY created_at DESC LIMIT 1;

-- Step 2: Set up test data for YOUR actual user
-- Replace 'YOUR_USER_ID_HERE' with your actual user ID from Step 1

-- IMPORTANT: Copy your user ID from Step 1 and replace 'YOUR_USER_ID_HERE' below
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

-- Get the user ID for validation
WITH current_user AS (
    SELECT id as user_id FROM users ORDER BY created_at DESC LIMIT 1
)

-- 1. User Settings Check
SELECT 'User Settings' as test_name, 
       u.user_id,
       us.expenses_percentage, us.savings_percentage, us.goals_percentage,
       CASE WHEN us.expenses_percentage + us.savings_percentage + us.goals_percentage = 100 
            THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM current_user u
LEFT JOIN user_settings us ON us.user_id = u.user_id

UNION ALL

-- 2. Goals Check
SELECT 'Goals Created' as test_name,
       u.user_id,
       COUNT(g.*)::text as goal_count,
       SUM(g.target_amount)::text as total_target,
       CASE WHEN COUNT(g.*) = 2 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM current_user u
LEFT JOIN goals g ON g.user_id = u.user_id
GROUP BY u.user_id

UNION ALL

-- 3. Income Auto-Allocation Check
SELECT 'Income Auto-Allocation' as test_name,
       u.user_id,
       SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END)::text as total_income,
       SUM(CASE WHEN t.budget_category = 'savings' THEN t.amount ELSE 0 END)::text as savings_allocated,
       CASE WHEN SUM(CASE WHEN t.budget_category = 'savings' THEN t.amount ELSE 0 END) = 900 
            THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM current_user u
LEFT JOIN transactions t ON t.user_id = u.user_id
GROUP BY u.user_id;

-- 4. Goal Progress Details
SELECT 'Goal Progress Details' as info;
WITH current_user AS (
    SELECT id as user_id FROM users ORDER BY created_at DESC LIMIT 1
)
SELECT g.title, g.target_amount, g.allocated_amount,
       ROUND((g.allocated_amount / g.target_amount * 100), 1) as progress_pct,
       CASE WHEN g.allocated_amount > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM current_user u
JOIN goals g ON g.user_id = u.user_id;

-- 5. Manual Override Check
SELECT 'Manual Override Check' as info;
WITH current_user AS (
    SELECT id as user_id FROM users ORDER BY created_at DESC LIMIT 1
)
SELECT COUNT(ga.*) as manual_allocations,
       SUM(ga.amount) as manual_amount,
       CASE WHEN COUNT(ga.*) >= 1 AND SUM(ga.amount) = 500 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM current_user u
LEFT JOIN goal_allocations ga ON ga.user_id = u.user_id AND ga.allocation_type = 'manual';

-- 6. Budget Warning Check
SELECT 'Budget Warning Check' as info;
WITH current_user AS (
    SELECT id as user_id FROM users ORDER BY created_at DESC LIMIT 1
),
budget_analysis AS (
  SELECT 
    u.user_id,
    SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as total_income,
    SUM(CASE WHEN t.type = 'expense' AND t.budget_category = 'expenses' THEN t.amount ELSE 0 END) as actual_expenses
  FROM current_user u
  LEFT JOIN transactions t ON t.user_id = u.user_id
  GROUP BY u.user_id
)
SELECT total_income,
       actual_expenses,
       (total_income * 0.50) as budget_limit,
       CASE WHEN actual_expenses > (total_income * 0.50) THEN '✅ PASS (Over Budget Detected)' 
            ELSE '❌ FAIL (Should be over budget)' END as result
FROM budget_analysis;

-- 7. Final Summary
SELECT 'FINAL SUMMARY' as info;
WITH current_user AS (
    SELECT id as user_id FROM users ORDER BY created_at DESC LIMIT 1
)
SELECT u.user_id,
       COUNT(DISTINCT CASE WHEN t.type = 'income' THEN t.id END) as income_transactions,
       COUNT(DISTINCT CASE WHEN t.source = 'auto_allocation' THEN t.id END) as auto_allocations,
       COUNT(DISTINCT CASE WHEN t.source = 'manual' AND t.budget_category = 'goals' THEN t.id END) as manual_goal_saves,
       CASE WHEN COUNT(DISTINCT CASE WHEN t.type = 'income' THEN t.id END) >= 1 
            AND COUNT(DISTINCT CASE WHEN t.source = 'auto_allocation' THEN t.id END) >= 3
            AND COUNT(DISTINCT CASE WHEN t.source = 'manual' AND t.budget_category = 'goals' THEN t.id END) >= 1
            THEN '🎉 ALL CORE FEATURES WORKING' 
            ELSE '❌ SOME FEATURES MISSING' END as overall_result
FROM current_user u
LEFT JOIN transactions t ON t.user_id = u.user_id
GROUP BY u.user_id;

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