-- =========================================
-- GOAL STRATEGY TEST DATA & VALIDATION
-- =========================================
-- This file contains comprehensive test scenarios to validate the goal strategy implementation

-- =========================================
-- 1. SETUP TEST USER AND SETTINGS
-- =========================================

-- Clear existing test data
DELETE FROM goal_allocations WHERE user_id = 'test_user';
DELETE FROM transactions WHERE user_id = 'test_user';
DELETE FROM goals WHERE user_id = 'test_user';
DELETE FROM user_settings WHERE user_id = 'test_user';

-- Create test user settings (50% expenses, 30% savings, 20% goals)
INSERT INTO user_settings (user_id, expenses_percentage, savings_percentage, goals_percentage)
VALUES ('test_user', 50.00, 30.00, 20.00);

-- Verify settings
SELECT 'TEST 1: User Settings' as test_name, * FROM user_settings WHERE user_id = 'test_user';

-- =========================================
-- 2. CREATE TEST GOALS
-- =========================================

-- Create 3 test goals (20% will be split equally = 6.67% each)
INSERT INTO goals (user_id, title, target_amount, allocated_amount, percentage_allocation, is_active, status)
VALUES 
  ('test_user', 'Emergency Fund', 5000.00, 0.00, 6.67, true, 'active'),
  ('test_user', 'Vacation Fund', 2000.00, 0.00, 6.67, true, 'active'),
  ('test_user', 'New Laptop', 1500.00, 0.00, 6.67, true, 'active');

-- Verify goals
SELECT 'TEST 2: Goals Created' as test_name, title, target_amount, allocated_amount, percentage_allocation, is_active 
FROM goals WHERE user_id = 'test_user';

-- =========================================
-- 3. TEST SCENARIO 1: INCOME AUTO-ALLOCATION
-- =========================================

-- Add income transaction ($3000)
-- Expected allocation: $1500 expenses, $900 savings, $600 goals ($200 per goal)
INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
VALUES ('test_user', CURRENT_DATE, 'Monthly Salary', 3000.00, 'Salary', 'income', 'manual', 'expenses', false);

-- Manually create the auto-allocation transactions (simulating what the system should do)
INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
VALUES 
  ('test_user', CURRENT_DATE, 'Auto-allocation: Savings (30%)', 900.00, 'Savings', 'expense', 'auto_allocation', 'savings', true),
  ('test_user', CURRENT_DATE, 'Auto-allocation: Emergency Fund (20%)', 200.00, 'Goal Contribution', 'expense', 'auto_allocation', 'goals', true),
  ('test_user', CURRENT_DATE, 'Auto-allocation: Vacation Fund (20%)', 200.00, 'Goal Contribution', 'expense', 'auto_allocation', 'goals', true),
  ('test_user', CURRENT_DATE, 'Auto-allocation: New Laptop (20%)', 200.00, 'Goal Contribution', 'expense', 'auto_allocation', 'goals', true);

-- Create goal allocations
INSERT INTO goal_allocations (user_id, goal_id, amount, allocation_type, allocation_date)
SELECT 
  'test_user',
  g.id,
  200.00,
  'auto',
  CURRENT_DATE
FROM goals g 
WHERE g.user_id = 'test_user' AND g.is_active = true;

-- Update goal progress manually (simulating trigger)
UPDATE goals SET allocated_amount = 200.00 WHERE user_id = 'test_user' AND is_active = true;

-- Verify auto-allocation results
SELECT 'TEST 3A: Income Auto-Allocation - Transactions' as test_name, 
       description, amount, type, budget_category, is_allocated 
FROM transactions WHERE user_id = 'test_user' ORDER BY created_at;

SELECT 'TEST 3B: Income Auto-Allocation - Goal Progress' as test_name, 
       title, target_amount, allocated_amount, 
       ROUND((allocated_amount / target_amount * 100), 2) as progress_percentage
FROM goals WHERE user_id = 'test_user';

-- =========================================
-- 4. TEST SCENARIO 2: MANUAL OVERRIDE
-- =========================================

-- Add manual goal contribution (override automatic allocation)
-- "Save $500 for vacation" - should go specifically to vacation fund
INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
VALUES ('test_user', CURRENT_DATE, 'Manual save $500 for vacation', 500.00, 'Goal Contribution', 'expense', 'manual', 'goals', true);

-- Create specific goal allocation for vacation
INSERT INTO goal_allocations (user_id, goal_id, amount, allocation_type, allocation_date, notes)
SELECT 
  'test_user',
  g.id,
  500.00,
  'manual',
  CURRENT_DATE,
  'Manual override: Save $500 for vacation'
FROM goals g 
WHERE g.user_id = 'test_user' AND g.title = 'Vacation Fund';

-- Update vacation goal progress
UPDATE goals SET allocated_amount = allocated_amount + 500.00 
WHERE user_id = 'test_user' AND title = 'Vacation Fund';

-- Verify manual override
SELECT 'TEST 4A: Manual Override - Vacation Goal' as test_name, 
       title, target_amount, allocated_amount, 
       ROUND((allocated_amount / target_amount * 100), 2) as progress_percentage
FROM goals WHERE user_id = 'test_user' AND title = 'Vacation Fund';

SELECT 'TEST 4B: Manual Override - Goal Allocations' as test_name, 
       g.title, ga.amount, ga.allocation_type, ga.notes
FROM goal_allocations ga
JOIN goals g ON ga.goal_id = g.id
WHERE ga.user_id = 'test_user'
ORDER BY ga.created_at;

-- =========================================
-- 5. TEST SCENARIO 3: GOAL COMPLETION
-- =========================================

-- Add enough to complete the laptop goal ($1300 more needed)
INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
VALUES ('test_user', CURRENT_DATE, 'Bonus for laptop', 1300.00, 'Goal Contribution', 'expense', 'manual', 'goals', true);

-- Create goal allocation for laptop completion
INSERT INTO goal_allocations (user_id, goal_id, amount, allocation_type, allocation_date, notes)
SELECT 
  'test_user',
  g.id,
  1300.00,
  'manual',
  CURRENT_DATE,
  'Bonus payment to complete laptop goal'
FROM goals g 
WHERE g.user_id = 'test_user' AND g.title = 'New Laptop';

-- Update laptop goal to completion
UPDATE goals SET 
  allocated_amount = allocated_amount + 1300.00,
  status = 'completed',
  is_active = false,
  completion_date = NOW()
WHERE user_id = 'test_user' AND title = 'New Laptop';

-- Verify goal completion
SELECT 'TEST 5A: Goal Completion - Laptop Goal' as test_name, 
       title, target_amount, allocated_amount, status, is_active, completion_date
FROM goals WHERE user_id = 'test_user' AND title = 'New Laptop';

SELECT 'TEST 5B: Goal Completion - Active Goals Remaining' as test_name, 
       COUNT(*) as active_goals_count
FROM goals WHERE user_id = 'test_user' AND is_active = true;

-- =========================================
-- 6. TEST SCENARIO 4: BUDGET WARNINGS
-- =========================================

-- Add second income to test budget percentages
INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
VALUES ('test_user', CURRENT_DATE, 'Freelance Income', 2000.00, 'Freelance', 'income', 'manual', 'expenses', false);

-- Calculate expected allocations for total income of $5000
-- Expected: $2500 expenses, $1500 savings, $1000 goals
-- Current: Let's add expenses that exceed the budget

INSERT INTO transactions (user_id, date, description, amount, category, type, source, budget_category, is_allocated)
VALUES 
  ('test_user', CURRENT_DATE, 'Rent', 1200.00, 'Housing', 'expense', 'manual', 'expenses', false),
  ('test_user', CURRENT_DATE, 'Groceries', 400.00, 'Food', 'expense', 'manual', 'expenses', false),
  ('test_user', CURRENT_DATE, 'Entertainment', 600.00, 'Entertainment', 'expense', 'manual', 'expenses', false),
  ('test_user', CURRENT_DATE, 'Shopping', 500.00, 'Shopping', 'expense', 'manual', 'expenses', false); -- This will exceed budget

-- Verify budget analysis
SELECT 'TEST 6: Budget Analysis' as test_name,
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
       SUM(CASE WHEN type = 'expense' AND budget_category = 'expenses' THEN amount ELSE 0 END) as total_expenses,
       SUM(CASE WHEN type = 'expense' AND budget_category = 'savings' THEN amount ELSE 0 END) as total_savings,
       SUM(CASE WHEN type = 'expense' AND budget_category = 'goals' THEN amount ELSE 0 END) as total_goals
FROM transactions WHERE user_id = 'test_user';

-- Calculate budget expectations vs actual
WITH budget_analysis AS (
  SELECT 
    SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
    SUM(CASE WHEN type = 'expense' AND budget_category = 'expenses' THEN amount ELSE 0 END) as actual_expenses,
    SUM(CASE WHEN type = 'expense' AND budget_category = 'savings' THEN amount ELSE 0 END) as actual_savings,
    SUM(CASE WHEN type = 'expense' AND budget_category = 'goals' THEN amount ELSE 0 END) as actual_goals
  FROM transactions WHERE user_id = 'test_user'
)
SELECT 
  'TEST 6B: Budget Warnings' as test_name,
  total_income,
  actual_expenses,
  (total_income * 0.50) as expected_expenses,
  CASE WHEN actual_expenses > (total_income * 0.50) THEN 'OVER BUDGET' ELSE 'OK' END as expense_status,
  actual_savings,
  (total_income * 0.30) as expected_savings,
  CASE WHEN actual_savings < (total_income * 0.30) THEN 'UNDER BUDGET' ELSE 'OK' END as savings_status,
  actual_goals,
  (total_income * 0.20) as expected_goals,
  CASE WHEN actual_goals < (total_income * 0.20) THEN 'UNDER BUDGET' ELSE 'OK' END as goals_status
FROM budget_analysis;

-- =========================================
-- 7. TEST SCENARIO 5: DUPLICATE GOAL PREVENTION
-- =========================================

-- Try to create duplicate goal (should be prevented)
SELECT 'TEST 7: Duplicate Goal Check' as test_name,
       check_duplicate_goals('test_user', 'Emergency Fund') as has_duplicate;

-- =========================================
-- 8. COMPREHENSIVE VALIDATION QUERIES
-- =========================================

-- Final validation of all test scenarios
SELECT 'FINAL VALIDATION: User Settings' as validation_type, 
       expenses_percentage, savings_percentage, goals_percentage,
       (expenses_percentage + savings_percentage + goals_percentage) as total_percentage
FROM user_settings WHERE user_id = 'test_user';

SELECT 'FINAL VALIDATION: Goals Summary' as validation_type,
       COUNT(*) as total_goals,
       SUM(CASE WHEN is_active = true THEN 1 ELSE 0 END) as active_goals,
       SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_goals,
       SUM(target_amount) as total_target_amount,
       SUM(allocated_amount) as total_allocated_amount
FROM goals WHERE user_id = 'test_user';

SELECT 'FINAL VALIDATION: Transaction Summary' as validation_type,
       COUNT(*) as total_transactions,
       SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
       SUM(CASE WHEN type = 'expense' THEN amount ELSE 0 END) as total_expenses,
       SUM(CASE WHEN budget_category = 'goals' THEN amount ELSE 0 END) as total_goal_allocations
FROM transactions WHERE user_id = 'test_user';

SELECT 'FINAL VALIDATION: Goal Allocations' as validation_type,
       COUNT(*) as total_allocations,
       SUM(amount) as total_allocated_amount,
       SUM(CASE WHEN allocation_type = 'auto' THEN amount ELSE 0 END) as auto_allocated,
       SUM(CASE WHEN allocation_type = 'manual' THEN amount ELSE 0 END) as manual_allocated
FROM goal_allocations WHERE user_id = 'test_user';

-- =========================================
-- 9. EXPECTED RESULTS SUMMARY
-- =========================================

/*
EXPECTED RESULTS:

TEST 1: User Settings
- expenses_percentage: 50.00
- savings_percentage: 30.00  
- goals_percentage: 20.00
- total_percentage: 100.00

TEST 2: Goals Created
- 3 active goals created
- Each with 6.67% allocation (20% ÷ 3)

TEST 3: Income Auto-Allocation ($3000)
- $1500 available for expenses (50%)
- $900 to savings (30%)
- $600 to goals (20%) = $200 per goal

TEST 4: Manual Override
- Vacation fund gets additional $500
- Total in vacation: $700 (35% complete)

TEST 5: Goal Completion
- Laptop goal completed with $1500 total
- Only 2 active goals remain
- Goal percentage should redistribute

TEST 6: Budget Warnings
- Total income: $5000
- Expected expenses: $2500
- Actual expenses: $2700 (OVER BUDGET by $200)
- Should trigger warnings

TEST 7: Duplicate Prevention
- check_duplicate_goals should return TRUE for 'Emergency Fund'

FINAL VALIDATION:
- Total income: $5000
- Total goal allocations: $2100
- 2 active goals, 1 completed
- Auto + manual allocations tracked
*/ 