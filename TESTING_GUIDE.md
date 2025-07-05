# 🧪 Goal Strategy Testing Guide

## 📋 Quick Start

### 1. **Database Setup**
```bash
# Run the comprehensive test data setup
psql your_database_url -f test_goal_strategy.sql
```

### 2. **Manual Testing via Chat Interface**
Follow the scenarios in `test_chat_scenarios.md` to test through the UI.

### 3. **Automated Testing**
```bash
# Set environment variables
export DATABASE_URL="your_postgres_connection_string"
export SUPABASE_URL="https://your-project.supabase.co"
export SUPABASE_ANON_KEY="your_anon_key"

# Run all tests
./run_tests.sh

# Or run specific test types
./run_tests.sh --sql-only
./run_tests.sh --api-only
```

---

## 🎯 **WHAT TO TEST**

### **Core Features to Validate:**

1. **✅ Goal Creation**
   - New goals created with correct percentages
   - Duplicate prevention works
   - Goal completion updates status

2. **✅ Income Auto-Allocation**
   - Income splits per user percentages (50/30/20 default)
   - Goal allocations distributed equally
   - Database transactions created correctly

3. **✅ Manual Overrides**
   - "Save $500 for vacation" works
   - Percentage changes apply to future income
   - Manual allocations tracked separately

4. **✅ Budget Warnings**
   - Over-budget expenses show warnings
   - Warnings don't block transactions
   - Multiple budget issues reported

5. **✅ Settings Integration**
   - Budget changes apply immediately
   - Goal percentages redistribute automatically

---

## 🔍 **DEBUGGING CHECKLIST**

### **If Goals Aren't Being Created:**
```sql
-- Check if LLM is detecting goals
SELECT * FROM chat_messages WHERE message LIKE '%goal%' ORDER BY created_at DESC LIMIT 5;

-- Check goals table
SELECT * FROM goals WHERE user_id = 'your_user_id' ORDER BY created_at DESC;

-- Check for duplicate prevention
SELECT check_duplicate_goals('your_user_id', 'Emergency Fund');
```

### **If Income Isn't Auto-Allocating:**
```sql
-- Check user settings
SELECT * FROM user_settings WHERE user_id = 'your_user_id';

-- Check if income transactions are being created
SELECT * FROM transactions WHERE user_id = 'your_user_id' AND type = 'income';

-- Check if allocation transactions are being created
SELECT * FROM transactions WHERE user_id = 'your_user_id' AND source = 'auto_allocation';

-- Check goal allocations
SELECT * FROM goal_allocations WHERE user_id = 'your_user_id';
```

### **If Budget Warnings Aren't Showing:**
```sql
-- Check transaction budget categories
SELECT budget_category, SUM(amount) FROM transactions 
WHERE user_id = 'your_user_id' AND type = 'expense' 
GROUP BY budget_category;

-- Check monthly budget analysis
SELECT 
  SUM(CASE WHEN type = 'income' THEN amount ELSE 0 END) as income,
  SUM(CASE WHEN type = 'expense' AND budget_category = 'expenses' THEN amount ELSE 0 END) as expenses,
  SUM(CASE WHEN type = 'expense' AND budget_category = 'savings' THEN amount ELSE 0 END) as savings,
  SUM(CASE WHEN type = 'expense' AND budget_category = 'goals' THEN amount ELSE 0 END) as goals
FROM transactions 
WHERE user_id = 'your_user_id';
```

---

## 🧪 **STEP-BY-STEP VALIDATION**

### **Test 1: Basic Goal Creation**
1. **Input:** `"I want to save $5000 for emergency fund"`
2. **Expected:** Goal created, percentage calculated, success message
3. **Validate:** Check `goals` table for new record

### **Test 2: Income Processing**
1. **Input:** `"I earned $3000 from my job"`
2. **Expected:** Income + auto-allocation transactions created
3. **Validate:** Check `transactions` and `goal_allocations` tables

### **Test 3: Manual Override**
1. **Input:** `"Save $500 for vacation"`
2. **Expected:** Manual allocation to specific goal
3. **Validate:** Check allocation_type = 'manual' in `goal_allocations`

### **Test 4: Budget Warning**
1. **Input:** `"I spent $2000 on shopping"` (after $3000 income)
2. **Expected:** Warning shown (over 50% budget)
3. **Validate:** Check transaction created but warning displayed

### **Test 5: Goal Completion**
1. **Input:** Add enough to complete a goal
2. **Expected:** Goal marked complete, percentages redistributed
3. **Validate:** Check `status = 'completed'` and `is_active = false`

---

## 📊 **EXPECTED RESULTS**

### **After $3000 Income (50/30/20 split):**
- **Expenses Budget:** $1,500 available
- **Savings:** $900 allocated
- **Goals:** $600 total ($200 per goal if 3 goals)

### **Goal Progress Example:**
```
Emergency Fund: $200 / $5000 (4% complete)
Vacation Fund: $200 / $2000 (10% complete)
New Laptop: $200 / $1500 (13% complete)
```

### **Budget Warning Triggers:**
- **Expenses > 50% of income:** Show warning
- **Savings < 30% of income:** Show warning  
- **Goals < 20% of income:** Show warning

---

## 🚨 **COMMON ISSUES & FIXES**

### **Issue: Goals not creating**
**Fix:** Check LLM system prompt includes goal detection logic

### **Issue: Auto-allocation not working**
**Fix:** Verify `user_settings` table has correct percentages

### **Issue: Manual overrides not working**
**Fix:** Check chat-response function handles manual allocations

### **Issue: Budget warnings not showing**
**Fix:** Verify budget calculation logic in TransactionList component

### **Issue: Goal progress not updating**
**Fix:** Check database triggers are working:
```sql
-- Test trigger manually
INSERT INTO goal_allocations (user_id, goal_id, amount) 
VALUES ('test_user', 'goal_id_here', 100);

-- Check if goal.allocated_amount updated
SELECT * FROM goals WHERE id = 'goal_id_here';
```

---

## 🎯 **SUCCESS CRITERIA**

**✅ All tests pass when:**
- Goals create with correct percentages
- Income auto-allocates per user settings
- Manual overrides work as expected
- Budget warnings show but don't block
- Goal completion redistributes percentages
- Settings changes apply immediately

**❌ Investigation needed if:**
- Goals aren't being detected from natural language
- Income doesn't split into correct categories
- Manual allocations don't override automatic ones
- Budget warnings don't appear for overspending
- Goal progress doesn't update in real-time

---

## 📞 **Getting Help**

If tests fail, check:
1. **Database logs** - Look for constraint violations
2. **Edge function logs** - Check Supabase function logs
3. **Frontend console** - Look for JavaScript errors
4. **Network tab** - Verify API calls are succeeding

**Debug SQL queries are provided in each test file to help identify issues quickly.** 