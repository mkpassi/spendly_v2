import React from 'react';
import { supabase } from '../lib/supabase';
import { X } from 'lucide-react';

interface AuthProps {
  onClose: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onClose }) => {
  const handleGoogleLogin = async () => {
    await supabase.auth.signInWithOAuth({
      provider: 'google',
    });
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-sm w-full relative">
        <button
          onClick={onClose}
          className="absolute top-2 right-2 text-slate-500 hover:text-slate-800"
        >
          <X size={24} />
        </button>
        <div className="text-center">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">Welcome Back!</h2>
          <p className="text-slate-600 mb-6">Sign in to continue to Spendly.</p>
        </div>
        <button
          onClick={handleGoogleLogin}
          className="w-full bg-blue-500 text-white font-bold py-3 px-4 rounded-lg flex items-center justify-center hover:bg-blue-600 transition-colors"
        >
          <svg className="w-6 h-6 mr-3" viewBox="0 0 48 48">
            <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8c-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4C12.955 4 4 12.955 4 24s8.955 20 20 20s20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z" />
            <path fill="#FF3D00" d="M6.306 14.691c-1.242 2.379-1.95 5.093-1.95 8.019c0 2.926.708 5.64 1.95 8.019l-5.657 5.657C.22 32.66 0 28.491 0 24c0-4.491.22-8.66 1.649-12.339l4.657 3.03z" />
            <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-5.657-5.657A12.012 12.012 0 0 1 24 36c-2.926 0-5.64-.708-8.019-1.95l-5.657 5.657C14.14 41.023 18.834 44 24 44z" />
            <path fill="#1976D2" d="M43.611 20.083H24v8h11.303a12.012 12.012 0 0 1-5.657 5.657l5.657 5.657C41.023 35.86 44 31.166 44 24c0-1.341-.138-2.65-.389-3.917z" />
          </svg>
          Sign in with Google
        </button>
      </div>
    </div>
  );
}; 