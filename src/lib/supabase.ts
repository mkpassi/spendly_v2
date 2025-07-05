import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  console.error('Missing Supabase environment variables:');
  console.error('VITE_SUPABASE_URL:', supabaseUrl ? '✅ Set' : '❌ Missing');
  console.error('VITE_SUPABASE_ANON_KEY:', supabaseAnonKey ? '✅ Set' : '❌ Missing');
  throw new Error('Missing Supabase environment variables. Please check your .env file.');
}

console.log('🔧 Supabase Configuration:');
console.log('URL:', supabaseUrl);
console.log('Anon Key:', supabaseAnonKey ? `${supabaseAnonKey.substring(0, 20)}...` : 'Missing');

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    flowType: 'pkce'
  }
});

// Test the connection
supabase.auth.getSession().then(({ data, error }) => {
  if (error) {
    console.error('❌ Supabase connection test failed:', error);
  } else {
    console.log('✅ Supabase connection successful');
    console.log('Current session:', data.session ? 'Active' : 'None');
  }
});

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