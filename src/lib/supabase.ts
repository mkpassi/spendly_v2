import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export type Database = {
  public: {
    Tables: {
      users: {
        Row: {
          id: string;
          full_name: string | null;
          avatar_url: string | null;
          email: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          full_name?: string | null;
          avatar_url?: string | null;
          email?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      transactions: {
        Row: {
          id: string;
          user_id: string;
          date: string;
          description: string;
          amount: number;
          category: string;
          type: 'income' | 'expense';
          source: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          date: string;
          description: string;
          amount: number;
          category?: string;
          type: 'income' | 'expense';
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          date?: string;
          description?: string;
          amount?: number;
          category?: string;
          type?: 'income' | 'expense';
          source?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      goals: {
        Row: {
          id: string;
          user_id: string;
          title: string;
          target_amount: number;
          current_amount: number;
          target_date: string | null;
          status: string;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          title: string;
          target_amount: number;
          current_amount?: number;
          target_date?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          title?: string;
          target_amount?: number;
          current_amount?: number;
          target_date?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
        };
      };
      chat_messages: {
        Row: {
          id: string;
          user_id: string;
          message: string;
          sender: 'user' | 'ai';
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id?: string;
          message: string;
          sender: 'user' | 'ai';
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          message?: string;
          sender?: 'user' | 'ai';
          created_at?: string;
        };
      };
    };
  };
};