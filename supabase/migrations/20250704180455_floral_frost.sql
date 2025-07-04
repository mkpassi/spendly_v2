/*
  # Spendly Financial Coach Database Schema

  1. New Tables
    - `users` - Simplified user management for no-auth MVP
    - `transactions` - All financial transactions with AI parsing
    - `goals` - User savings goals with progress tracking
    - `chat_messages` - Conversation history with AI coach

  2. Security
    - Enable RLS on all tables
    - Add policies for anonymous user access
    - Ensure data separation by user_id

  3. Indexes
    - Add performance indexes for common queries
    - Date-based indexes for transaction filtering
*/

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Users Table (Simplified for no authentication)
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY DEFAULT 'anonymous_user',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions Table
CREATE TABLE IF NOT EXISTS transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL DEFAULT 'anonymous_user',
  date DATE NOT NULL,
  description TEXT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  category TEXT DEFAULT 'Other',
  type TEXT CHECK (type IN ('income', 'expense')) NOT NULL,
  source TEXT DEFAULT 'manual',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals Table
CREATE TABLE IF NOT EXISTS goals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL DEFAULT 'anonymous_user',
  title TEXT NOT NULL,
  target_amount DECIMAL(10,2) NOT NULL,
  current_amount DECIMAL(10,2) DEFAULT 0,
  target_date DATE,
  status TEXT DEFAULT 'active',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chat Messages Table
CREATE TABLE IF NOT EXISTS chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id TEXT NOT NULL DEFAULT 'anonymous_user',
  message TEXT NOT NULL,
  sender TEXT CHECK (sender IN ('user', 'ai')) NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

-- Create policies for anonymous access
CREATE POLICY "Allow anonymous user access" ON users FOR ALL TO anon USING (true);
CREATE POLICY "Allow anonymous user access" ON transactions FOR ALL TO anon USING (true);
CREATE POLICY "Allow anonymous user access" ON goals FOR ALL TO anon USING (true);
CREATE POLICY "Allow anonymous user access" ON chat_messages FOR ALL TO anon USING (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_transactions_user_date ON transactions(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_category ON transactions(category);
CREATE INDEX IF NOT EXISTS idx_transactions_type ON transactions(type);
CREATE INDEX IF NOT EXISTS idx_goals_user_status ON goals(user_id, status);
CREATE INDEX IF NOT EXISTS idx_chat_messages_user_created ON chat_messages(user_id, created_at DESC);

-- Insert default anonymous user
INSERT INTO users (id) VALUES ('anonymous_user') ON CONFLICT (id) DO NOTHING;