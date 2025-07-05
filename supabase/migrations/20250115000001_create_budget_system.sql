-- Create comprehensive budget allocation system
-- This migration adds user settings, goal allocations, and enhanced goal tracking

-- 1. User Settings Table for Budget Allocation Percentages
CREATE TABLE IF NOT EXISTS user_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  expenses_percentage DECIMAL(5,2) DEFAULT 50.00 CHECK (expenses_percentage >= 0 AND expenses_percentage <= 100),
  savings_percentage DECIMAL(5,2) DEFAULT 30.00 CHECK (savings_percentage >= 0 AND savings_percentage <= 100),
  goals_percentage DECIMAL(5,2) DEFAULT 20.00 CHECK (goals_percentage >= 0 AND goals_percentage <= 100),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT valid_percentage_total CHECK (expenses_percentage + savings_percentage + goals_percentage = 100.00),
  CONSTRAINT unique_user_settings UNIQUE (user_id)
);

-- 2. Goal Allocations Table to Track Specific Goal Contributions
CREATE TABLE IF NOT EXISTS goal_allocations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id TEXT NOT NULL,
  goal_id UUID NOT NULL REFERENCES goals(id) ON DELETE CASCADE,
  transaction_id UUID REFERENCES transactions(id) ON DELETE CASCADE,
  amount DECIMAL(10,2) NOT NULL CHECK (amount > 0),
  allocation_type TEXT CHECK (allocation_type IN ('auto', 'manual', 'percentage')) DEFAULT 'auto',
  allocation_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Enhance Goals Table with Better Progress Tracking
ALTER TABLE goals ADD COLUMN IF NOT EXISTS allocated_amount DECIMAL(10,2) DEFAULT 0.00;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS percentage_allocation DECIMAL(5,2) DEFAULT NULL CHECK (percentage_allocation >= 0 AND percentage_allocation <= 100);
ALTER TABLE goals ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE goals ADD COLUMN IF NOT EXISTS completion_date TIMESTAMPTZ DEFAULT NULL;

-- 4. Transaction Categories Enhancement
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS budget_category TEXT CHECK (budget_category IN ('expenses', 'savings', 'goals')) DEFAULT 'expenses';
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS is_allocated BOOLEAN DEFAULT false;

-- 5. Create Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON user_settings(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_allocations_user_id ON goal_allocations(user_id);
CREATE INDEX IF NOT EXISTS idx_goal_allocations_goal_id ON goal_allocations(goal_id);
CREATE INDEX IF NOT EXISTS idx_goal_allocations_transaction_id ON goal_allocations(transaction_id);
CREATE INDEX IF NOT EXISTS idx_goal_allocations_date ON goal_allocations(allocation_date DESC);
CREATE INDEX IF NOT EXISTS idx_goals_user_active ON goals(user_id, is_active);
CREATE INDEX IF NOT EXISTS idx_transactions_budget_category ON transactions(budget_category);
CREATE INDEX IF NOT EXISTS idx_transactions_allocated ON transactions(is_allocated);

-- 6. Enable Row Level Security
ALTER TABLE user_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE goal_allocations ENABLE ROW LEVEL SECURITY;

-- 7. Create RLS Policies for user_settings
CREATE POLICY "Users can view their own settings" ON user_settings FOR SELECT USING (
  auth.uid()::text = user_id OR user_id = 'anonymous_user'
);

CREATE POLICY "Users can insert their own settings" ON user_settings FOR INSERT WITH CHECK (
  auth.uid()::text = user_id OR user_id = 'anonymous_user'
);

CREATE POLICY "Users can update their own settings" ON user_settings FOR UPDATE USING (
  auth.uid()::text = user_id OR user_id = 'anonymous_user'
);

CREATE POLICY "Users can delete their own settings" ON user_settings FOR DELETE USING (
  auth.uid()::text = user_id OR user_id = 'anonymous_user'
);

-- 8. Create RLS Policies for goal_allocations
CREATE POLICY "Users can view their own goal allocations" ON goal_allocations FOR SELECT USING (
  auth.uid()::text = user_id OR user_id = 'anonymous_user'
);

CREATE POLICY "Users can insert their own goal allocations" ON goal_allocations FOR INSERT WITH CHECK (
  auth.uid()::text = user_id OR user_id = 'anonymous_user'
);

CREATE POLICY "Users can update their own goal allocations" ON goal_allocations FOR UPDATE USING (
  auth.uid()::text = user_id OR user_id = 'anonymous_user'
);

CREATE POLICY "Users can delete their own goal allocations" ON goal_allocations FOR DELETE USING (
  auth.uid()::text = user_id OR user_id = 'anonymous_user'
);

-- 9. Create Functions for Goal Progress Calculation
CREATE OR REPLACE FUNCTION calculate_goal_progress(goal_id_param UUID)
RETURNS DECIMAL(10,2) AS $$
DECLARE
  total_allocated DECIMAL(10,2);
BEGIN
  SELECT COALESCE(SUM(amount), 0.00)
  INTO total_allocated
  FROM goal_allocations
  WHERE goal_id = goal_id_param;
  
  RETURN total_allocated;
END;
$$ LANGUAGE plpgsql;

-- 10. Create Function to Update Goal Progress
CREATE OR REPLACE FUNCTION update_goal_progress()
RETURNS TRIGGER AS $$
BEGIN
  -- Update the goal's allocated_amount when allocations change
  IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
    UPDATE goals 
    SET allocated_amount = calculate_goal_progress(NEW.goal_id),
        updated_at = NOW()
    WHERE id = NEW.goal_id;
    
    -- Check if goal is completed
    UPDATE goals 
    SET status = 'completed', 
        completion_date = NOW(),
        updated_at = NOW()
    WHERE id = NEW.goal_id 
      AND allocated_amount >= target_amount 
      AND status != 'completed';
      
    RETURN NEW;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    UPDATE goals 
    SET allocated_amount = calculate_goal_progress(OLD.goal_id),
        updated_at = NOW()
    WHERE id = OLD.goal_id;
    
    RETURN OLD;
  END IF;
  
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- 11. Create Trigger for Goal Progress Updates
CREATE TRIGGER update_goal_progress_trigger
  AFTER INSERT OR UPDATE OR DELETE ON goal_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_goal_progress();

-- 12. Create Function to Get User Budget Settings with Defaults
CREATE OR REPLACE FUNCTION get_user_budget_settings(user_id_param TEXT)
RETURNS TABLE (
  expenses_percentage DECIMAL(5,2),
  savings_percentage DECIMAL(5,2),
  goals_percentage DECIMAL(5,2)
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    COALESCE(us.expenses_percentage, 50.00) as expenses_percentage,
    COALESCE(us.savings_percentage, 30.00) as savings_percentage,
    COALESCE(us.goals_percentage, 20.00) as goals_percentage
  FROM (SELECT 1) as dummy
  LEFT JOIN user_settings us ON us.user_id = user_id_param;
END;
$$ LANGUAGE plpgsql;

-- 13. Create Function to Check for Duplicate Goals
CREATE OR REPLACE FUNCTION check_duplicate_goals(user_id_param TEXT, title_param TEXT)
RETURNS BOOLEAN AS $$
DECLARE
  goal_count INTEGER;
BEGIN
  SELECT COUNT(*)
  INTO goal_count
  FROM goals
  WHERE user_id = user_id_param 
    AND LOWER(TRIM(title)) = LOWER(TRIM(title_param))
    AND is_active = true;
    
  RETURN goal_count > 0;
END;
$$ LANGUAGE plpgsql;

-- 14. Insert Default Settings for Anonymous User
INSERT INTO user_settings (user_id, expenses_percentage, savings_percentage, goals_percentage)
VALUES ('anonymous_user', 50.00, 30.00, 20.00)
ON CONFLICT (user_id) DO NOTHING;

-- 15. Create Function to Update Timestamps
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 16. Create Triggers for Updated At Timestamps
CREATE TRIGGER update_user_settings_updated_at
  BEFORE UPDATE ON user_settings
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_goal_allocations_updated_at
  BEFORE UPDATE ON goal_allocations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- 17. Update existing goals to be active by default
UPDATE goals SET is_active = true WHERE is_active IS NULL;

-- 18. Create View for Goal Progress Summary
CREATE OR REPLACE VIEW goal_progress_summary AS
SELECT 
  g.id,
  g.user_id,
  g.title,
  g.target_amount,
  g.allocated_amount,
  g.percentage_allocation,
  g.target_date,
  g.status,
  g.is_active,
  g.completion_date,
  g.created_at,
  g.updated_at,
  CASE 
    WHEN g.target_amount > 0 THEN (g.allocated_amount / g.target_amount * 100)
    ELSE 0
  END as progress_percentage,
  CASE 
    WHEN g.allocated_amount >= g.target_amount THEN true
    ELSE false
  END as is_completed
FROM goals g
WHERE g.is_active = true;

-- 19. Create View for Budget Status Summary
CREATE OR REPLACE VIEW budget_status_summary AS
SELECT 
  t.user_id,
  DATE_TRUNC('month', t.date) as month,
  SUM(CASE WHEN t.type = 'income' THEN t.amount ELSE 0 END) as total_income,
  SUM(CASE WHEN t.type = 'expense' AND t.budget_category = 'expenses' THEN t.amount ELSE 0 END) as expenses_spent,
  SUM(CASE WHEN t.type = 'expense' AND t.budget_category = 'savings' THEN t.amount ELSE 0 END) as savings_allocated,
  SUM(CASE WHEN t.type = 'expense' AND t.budget_category = 'goals' THEN t.amount ELSE 0 END) as goals_allocated,
  us.expenses_percentage,
  us.savings_percentage,
  us.goals_percentage
FROM transactions t
LEFT JOIN user_settings us ON us.user_id = t.user_id
GROUP BY t.user_id, DATE_TRUNC('month', t.date), us.expenses_percentage, us.savings_percentage, us.goals_percentage; 