-- Clear all data except user profiles and settings
-- This will preserve users and user_settings but clear all financial data

-- Clear dependent tables first
DELETE FROM goal_allocations;
DELETE FROM transactions;
DELETE FROM goals;
DELETE FROM chat_sessions;

-- Reset user settings to defaults (optional - keeps existing settings)
UPDATE user_settings SET 
  expenses_percentage = 50,
  savings_percentage = 30,
  goals_percentage = 20
WHERE user_id IS NOT NULL;
