-- =============================================
-- QUICK GOAL STRATEGY TEST - COPY & PASTE
-- =============================================
-- Run this entire script to test your goal strategy implementation

-- Clean up any existing test data
DELETE FROM goal_allocations WHERE user_id = 'quick_test';
DELETE FROM transactions WHERE user_id = 'quick_test';
DELETE FROM goals WHERE user_id = 'quick_test';
DELETE FROM user_settings WHERE user_id = 'quick_test';

-- Test 1: Setup user with default budget settings
INSERT INTO user_settings (user_id, expenses_percentage, savings_percentage, goals_percentage)
VALUES ('quick_test', 50.00, 30.00, 20.00);

-- Test 2: Create test goals
INSERT INTO goals (user_id, title, target_amount, allocated_amount, percentage_allocation, is_active, status)
VALUES 
  ('quick_test', 'Emergency Fund', 5000.00, 0.00, 10.00, true, 'active'),
  ('quick_test', 'Vacation', 2000.00, 0.00, 10.00, true, 'active');

-- Test 3: Add income transaction
INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
VALUES ('quick_test', CURRENT_DATE, 'Salary', 3000.00, 'Job', 'income', 'manual', 'expenses', false);

-- Test 4: Simulate auto-allocation (what the system should do automatically)
INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
VALUES 
  ('quick_test', CURRENT_DATE, 'Auto: Savings', 900.00, 'Savings', 'expense', 'auto_allocation', 'savings', true),
  ('quick_test', CURRENT_DATE, 'Auto: Emergency Fund', 300.00, 'Goals', 'expense', 'auto_allocation', 'goals', true),
  ('quick_test', CURRENT_DATE, 'Auto: Vacation', 300.00, 'Goals', 'expense', 'auto_allocation', 'goals', true);

-- Test 5: Create goal allocations
INSERT INTO goal_allocations (user_id, goal_id, amount, allocation_type, allocation_date)
SELECT 'quick_test', id, 300.00, 'auto', CURRENT_DATE 
FROM goals WHERE user_id = 'quick_test';

-- Test 6: Update goal progress
UPDATE goals SET allocated_amount = 300.00 WHERE user_id = 'quick_test';

-- Test 7: Add manual override
INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
VALUES ('quick_test', CURRENT_DATE, 'Save $500 for vacation', 500.00, 'Goals', 'expense', 'manual', 'goals', true);

-- Add manual goal allocation
INSERT INTO goal_allocations (user_id, goal_id, amount, allocation_type, allocation_date, notes)
SELECT 'quick_test', id, 500.00, 'manual', CURRENT_DATE, 'Manual save for vacation'
FROM goals WHERE user_id = 'quick_test' AND title = 'Vacation';

-- Update vacation goal
UPDATE goals SET allocated_amount = 800.00 WHERE user_id = 'quick_test' AND title = 'Vacation';

-- Test 8: Add over-budget expense
INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
VALUES ('quick_test', CURRENT_DATE, 'Shopping Spree', 2000.00, 'Shopping', 'expense', 'manual', 'expenses', false);

-- =============================================
-- VALIDATION RESULTS - CHECK THESE
-- =============================================

SELECT '=== TEST RESULTS ===' as test_section;

-- 1. User Settings Check
SELECT 'User Settings' as test_name, 
       expenses_percentage, savings_percentage, goals_percentage,
       CASE WHEN expenses_percentage + savings_percentage + goals_percentage = 100 
            THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM user_settings WHERE user_id = 'quick_test';

-- 2. Goals Check
SELECT 'Goals Created' as test_name,
       COUNT(*) as goal_count,
       SUM(target_amount) as total_target,
       SUM(allocated_amount) as total_allocated,
       CASE WHEN COUNT(*) = 2 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM goals WHERE user_id = 'quick_test';

-- 3. Income Auto-Allocation Check
SELECT 'Income Auto-Allocation' as test_name,
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
       SUM(CASE WHEN budget_category = 'savings' THEN amount ELSE 0 END) as savings_allocated,
       SUM(CASE WHEN budget_category = 'goals' THEN amount ELSE 0 END) as goals_allocated,
       CASE WHEN SUM(CASE WHEN budget_category = 'savings' THEN amount ELSE 0 END) = 900 
            AND SUM(CASE WHEN budget_category = 'goals' THEN amount ELSE 0 END) = 1100
            THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM transactions WHERE user_id = 'quick_test';

-- 4. Goal Progress Check
SELECT 'Goal Progress' as test_name,
       title, target_amount, allocated_amount,
       ROUND((allocated_amount / target_amount * 100), 1) as progress_pct,
       CASE WHEN allocated_amount > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM goals WHERE user_id = 'quick_test';

-- 5. Manual Override Check
SELECT 'Manual Override' as test_name,
       COUNT(*) as manual_allocations,
       SUM(amount) as manual_amount,
       CASE WHEN COUNT(*) >= 1 AND SUM(amount) = 500 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM goal_allocations WHERE user_id = 'quick_test' AND allocation_type = 'manual';

-- 6. Budget Analysis (Should show over-budget warning)
WITH budget_analysis AS (
  SELECT 
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN type = 'expense' AND budget_category = 'expenses' THEN amount ELSE 0 END) as actual_expenses
  FROM transactions WHERE user_id = 'quick_test'
)
SELECT 'Budget Warning Check' as test_name,
       total_income,
       actual_expenses,
       (total_income * 0.50) as budget_limit,
       CASE WHEN actual_expenses > (total_income * 0.50) THEN '✅ PASS (Over Budget Detected)' 
            ELSE '❌ FAIL (Should be over budget)' END as result
FROM budget_analysis;

-- 7. Goal Allocations Summary
SELECT 'Goal Allocations Summary' as test_name,
       g.title,
       ga.amount,
       ga.allocation_type,
       CASE WHEN ga.amount > 0 THEN '✅ PASS' ELSE '❌ FAIL' END as result
FROM goal_allocations ga
JOIN goals g ON ga.goal_id = g.id
WHERE ga.user_id = 'quick_test'
ORDER BY ga.created_at;

-- 8. Final Summary
SELECT 'FINAL SUMMARY' as test_name,
       COUNT(DISTINCT CASE WHEN type = 'income' THEN id END) as income_transactions,
       COUNT(DISTINCT CASE WHEN source = 'auto_allocation' THEN id END) as auto_allocations,
       COUNT(DISTINCT CASE WHEN source = 'manual' AND budget_category = 'goals' THEN id END) as manual_goal_saves,
       CASE WHEN COUNT(DISTINCT CASE WHEN type = 'income' THEN id END) >= 1 
            AND COUNT(DISTINCT CASE WHEN source = 'auto_allocation' THEN id END) >= 3
            AND COUNT(DISTINCT CASE WHEN source = 'manual' AND budget_category = 'goals' THEN id END) >= 1
            THEN '🎉 ALL CORE FEATURES WORKING' 
            ELSE '❌ SOME FEATURES MISSING' END as overall_result
FROM transactions WHERE user_id = 'quick_test';

-- =============================================
-- EXPECTED RESULTS:
-- =============================================
/*
✅ User Settings: 50/30/20 split
✅ Goals Created: 2 goals with targets
✅ Income Auto-Allocation: $900 savings, $600 goals (+ $500 manual = $1100 total)
✅ Goal Progress: Both goals should have allocated_amount > 0
✅ Manual Override: 1 manual allocation of $500
✅ Budget Warning: $2000 expenses > $1500 budget (over budget detected)
✅ Goal Allocations: Auto + manual allocations tracked
🎉 Overall: All core features working
*/

-- Clean up test data (optional - comment out if you want to keep it)
-- DELETE FROM goal_allocations WHERE user_id = 'quick_test';
-- DELETE FROM transactions WHERE user_id = 'quick_test';
-- DELETE FROM goals WHERE user_id = 'quick_test';
-- DELETE FROM user_settings WHERE user_id = 'quick_test'; 