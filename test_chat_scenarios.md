# 🧪 GOAL STRATEGY CHAT INTERFACE TEST SCENARIOS

## 📋 **PRE-TEST SETUP**

### 1. Run the SQL Test Data
```sql
-- Execute the test_goal_strategy.sql file to set up base data
-- This creates test_user with proper settings and goals
```

### 2. Switch to Test User
- If using anonymous mode, use `test_user` as user ID
- If using auth, create account with email `test@example.com`

---

## 🎯 **TEST SCENARIO 1: GOAL CREATION**

### Test Case 1A: Simple Goal Creation
**User Input:** `"I want to save $3000 for a new car by December 2025"`

**Expected AI Response:**
```
🎯 Goal created successfully!

**New Car**: $3,000
📅 Target Date: December 31, 2025

📊 Budget Allocation Update:
You have 20% allocated to goals. With 4 active goals, each gets 5.0% of your income.

Other Active Goals:
• Emergency Fund
• Vacation Fund  
• New Laptop (if not completed)

💡 Next Steps:
• Income will auto-allocate to your goals based on your budget settings
• You can adjust allocation percentages in Settings
• Specify custom amounts like "save $200 for car" for manual allocation
```

**Validation:**
- Check goals table for new car goal
- Verify percentage_allocation is updated for all goals
- Confirm goal is active and has proper target amount

### Test Case 1B: Duplicate Goal Prevention
**User Input:** `"Create a goal to save for emergency fund"`

**Expected AI Response:**
```
🎯 You already have an active goal called "Emergency Fund". Would you like to:
• Modify the existing goal amount or target date?
• Create a new goal with a different name like "Additional Emergency Fund"?
• Add money to your existing Emergency Fund goal?

Your current Emergency Fund goal: $5,000 target with $200 currently saved.
```

**Validation:**
- No new goal created
- Existing goal unchanged
- AI recognizes duplicate and offers alternatives

---

## 💰 **TEST SCENARIO 2: INCOME AUTO-ALLOCATION**

### Test Case 2A: Regular Income
**User Input:** `"I got paid $4000 from my job today"`

**Expected AI Response:**
```
💰 Income recorded: $4,000 from job

📊 Auto-Allocation Applied:
• Expenses (50%): $2,000 available for spending
• Savings (30%): $1,200 added to savings
• Goals (20%): $800 distributed among your 4 active goals

🎯 Goal Contributions:
• Emergency Fund: +$200 (now $400 total)
• Vacation Fund: +$200 (now $400 total)  
• New Laptop: +$200 (now $400 total)
• New Car: +$200 (now $200 total)

💡 Your goals are growing automatically! Check your progress in the Goals tab.
```

**Validation:**
- Income transaction created
- Auto-allocation transactions created (savings + 4 goals)
- Goal allocations table updated
- Goal progress updated in goals table

### Test Case 2B: Large Windfall
**User Input:** `"I received a $10000 bonus"`

**Expected AI Response:**
```
🎉 Bonus recorded: $10,000

📊 Auto-Allocation Applied:
• Expenses (50%): $5,000 available for spending
• Savings (30%): $3,000 added to savings  
• Goals (20%): $2,000 distributed among your goals

🎯 Goal Contributions:
• Emergency Fund: +$500 (now $900 total)
• Vacation Fund: +$500 (now $900 total)
• New Laptop: +$500 (now $900 total) 
• New Car: +$500 (now $700 total)

🚀 Amazing progress! Your New Laptop goal is now 60% complete!
```

**Validation:**
- Same percentage rules apply regardless of amount
- Large amounts distributed correctly
- Progress percentages calculated correctly

---

## 🎯 **TEST SCENARIO 3: MANUAL OVERRIDES**

### Test Case 3A: Specific Goal Allocation
**User Input:** `"Save $800 for vacation from my bonus"`

**Expected AI Response:**
```
🎯 Manual allocation: $800 → Vacation Fund

Your Vacation Fund now has $1,700 total (85% complete!)
🎉 You're almost ready for that vacation!

💡 This overrides your automatic allocation for this amount.
Your other goals continue receiving their regular allocations from income.
```

**Validation:**
- Manual transaction created with budget_category = 'goals'
- Specific goal allocation created with allocation_type = 'manual'
- Vacation goal updated with additional $800
- Other goals unchanged

### Test Case 3B: Percentage Override
**User Input:** `"Put 30% of my income toward the emergency fund"`

**Expected AI Response:**
```
🎯 Allocation override: 30% of income → Emergency Fund

📊 Updated Goal Allocations:
• Emergency Fund: 30% (was 5%)
• Vacation Fund: 5% (unchanged)
• New Laptop: 5% (unchanged)  
• New Car: 5% (unchanged)

⚠️ Note: Your total goal allocation is now 45%, which exceeds your 20% goal budget.
Consider adjusting your budget settings or other goal percentages.

💡 Future income will use these new percentages until you change them.
```

**Validation:**
- Goal percentage_allocation updated in database
- Warning shown for exceeding budget
- Future income should use new percentages

---

## 🏆 **TEST SCENARIO 4: GOAL COMPLETION**

### Test Case 4A: Goal Completion
**User Input:** `"Add $600 to my laptop fund"`

**Expected AI Response:**
```
🎯 Added $600 to New Laptop goal

🎉 GOAL COMPLETED! 🎉
Your New Laptop goal has reached $1,500 (100% complete)!

🔄 Goal Status Updated:
• New Laptop: COMPLETED ✅
• Remaining Active Goals: 3
• Your 20% goal allocation now splits among 3 goals (6.67% each)

💡 Ready to create a new goal? Your goal budget has room for more savings targets!
```

**Validation:**
- Goal marked as completed and inactive
- Percentage allocation redistributed among remaining goals
- Completion date set
- Status changed to 'completed'

### Test Case 4B: New Goal After Completion
**User Input:** `"I want to save $2000 for a gaming setup"`

**Expected AI Response:**
```
🎯 Goal created successfully!

**Gaming Setup**: $2,000

📊 Budget Allocation Update:
You have 20% allocated to goals. With 4 active goals, each gets 5.0% of your income.

Active Goals:
• Emergency Fund (5.0%)
• Vacation Fund (5.0%)
• New Car (5.0%)
• Gaming Setup (5.0%)

💡 Your completed "New Laptop" goal freed up space for this new goal!
```

**Validation:**
- New goal created successfully
- Percentages redistributed equally
- Completed goals don't affect allocation

---

## ⚠️ **TEST SCENARIO 5: BUDGET WARNINGS**

### Test Case 5A: Expense Over Budget
**User Input:** `"I spent $3000 on rent and utilities"`

**Expected AI Response:**
```
💳 Expense recorded: $3,000 on rent and utilities

⚠️ BUDGET ALERT ⚠️
Your expenses are over budget this month:
• Budgeted: $2,500 (50% of $5,000 income)
• Actual: $3,000 
• Over by: $500

💡 Tips to get back on track:
• Review other planned expenses this month
• Consider adjusting your budget percentages in Settings
• Look for areas to cut back temporarily

Don't worry - this is just a warning to help you stay aware of your spending!
```

**Validation:**
- Expense transaction created
- Budget calculation performed correctly
- Warning shown but transaction not blocked
- Helpful suggestions provided

### Test Case 5B: Multiple Budget Issues
**User Input:** `"I haven't saved anything this month but spent $4000 on expenses"`

**Expected AI Response:**
```
📊 Monthly Budget Review:

⚠️ MULTIPLE BUDGET ALERTS ⚠️

💸 Expenses: $4,000 / $2,500 budgeted (60% over)
💰 Savings: $0 / $1,500 budgeted (100% under)
🎯 Goals: $800 / $1,000 budgeted (20% under)

🔧 Suggested Actions:
1. Review your budget allocation in Settings
2. Consider increasing expense percentage if this is your new normal
3. Set up automatic savings to stay on track
4. Focus on one financial priority at a time

Remember: Budgets are guides, not restrictions. Adjust as needed! 💪
```

**Validation:**
- Multiple budget categories analyzed
- Comprehensive warnings shown
- Constructive advice provided
- No transactions blocked

---

## 🔧 **TEST SCENARIO 6: SETTINGS INTEGRATION**

### Test Case 6A: Budget Percentage Change
**Steps:**
1. Go to Settings page
2. Change allocation to: 40% expenses, 35% savings, 25% goals
3. Save settings
4. Add income: `"I earned $2000 freelancing"`

**Expected AI Response:**
```
💰 Income recorded: $2,000 from freelancing

📊 Auto-Allocation Applied (Updated Settings):
• Expenses (40%): $800 available for spending
• Savings (35%): $700 added to savings
• Goals (25%): $500 distributed among your 4 active goals

🎯 Goal Contributions:
• Emergency Fund: +$125 (6.25% each)
• Vacation Fund: +$125
• New Car: +$125  
• Gaming Setup: +$125

✨ Your updated budget settings are now active!
```

**Validation:**
- New percentages applied correctly
- Goal allocations recalculated
- Settings change reflected immediately

---

## 📊 **COMPREHENSIVE VALIDATION QUERIES**

After running all test scenarios, execute these queries to verify everything worked:

```sql
-- 1. Verify user settings
SELECT * FROM user_settings WHERE user_id = 'test_user';

-- 2. Check all goals and their progress
SELECT title, target_amount, allocated_amount, 
       ROUND((allocated_amount/target_amount*100), 2) as progress_pct,
       status, is_active
FROM goals WHERE user_id = 'test_user';

-- 3. Verify all transactions
SELECT date, description, amount, type, budget_category, is_allocated
FROM transactions WHERE user_id = 'test_user' ORDER BY created_at;

-- 4. Check goal allocations
SELECT g.title, ga.amount, ga.allocation_type, ga.notes
FROM goal_allocations ga
JOIN goals g ON ga.goal_id = g.id
WHERE ga.user_id = 'test_user'
ORDER BY ga.created_at;

-- 5. Budget analysis
SELECT 
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as total_income,
  SUM(CASE WHEN type = 'expense' AND budget_category = 'expenses' THEN amount ELSE 0 END) as total_expenses,
  SUM(CASE WHEN type = 'expense' AND budget_category = 'savings' THEN amount ELSE 0 END) as total_savings,
  SUM(CASE WHEN type = 'expense' AND budget_category = 'goals' THEN amount ELSE 0 END) as total_goals
FROM transactions WHERE user_id = 'test_user';
```

---

## 🎯 **SUCCESS CRITERIA**

✅ **Goal Creation**
- New goals created with correct percentages
- Duplicate prevention works
- Goal completion updates status and redistributes percentages

✅ **Income Processing**
- Auto-allocation follows user-defined percentages
- Goal allocations created in database
- Progress updates in real-time

✅ **Manual Overrides**
- Specific goal allocations work
- Percentage overrides update future allocations
- Manual allocations tracked separately

✅ **Budget Warnings**
- Over-budget expenses show warnings
- Multiple budget issues reported
- Warnings don't block transactions

✅ **Settings Integration**
- Budget changes apply immediately
- New percentages used for future income
- Goal percentages redistribute automatically

If any test fails, check the corresponding database tables and edge function logs for debugging. 