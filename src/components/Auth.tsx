import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { X, Loader2, AlertCircle } from 'lucide-react';

interface AuthProps {
  onClose: () => void;
}

export const Auth: React.FC<AuthProps> = ({ onClose }) => {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      setError('Please enter both email and password');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      let result;
      
      if (isSignUp) {
        // Sign up new user
        result = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin + '/chat'
          }
        });
      } else {
        // Sign in existing user
        result = await supabase.auth.signInWithPassword({
          email,
          password
        });
      }

      if (result.error) {
        throw result.error;
      }

      if (isSignUp && !result.data.session) {
        setError('Please check your email for a confirmation link before signing in.');
        setIsSignUp(false);
        return;
      }

      // Success - the AuthContext will handle the redirect
      onClose();
    } catch (error: any) {
      console.error('Auth error:', error);
      setError(error.message || 'Authentication failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleAuth = async () => {
    setIsLoading(true);
    setError(null);

    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: window.location.origin + '/chat'
        }
      });

      if (error) throw error;
      
      // OAuth will redirect, so we don't need to close the modal here
    } catch (error: any) {
      console.error('Google auth error:', error);
      setError(error.message || 'Google authentication failed');
      setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-xl shadow-2xl p-8 max-w-md w-full relative">
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          disabled={isLoading}
        >
          <X size={24} />
        </button>

        <div className="text-center mb-6">
          <h2 className="text-2xl font-bold text-slate-800 mb-2">
            {isSignUp ? 'Create Account' : 'Welcome Back!'}
          </h2>
          <p className="text-slate-600">
            {isSignUp ? 'Join Spendly to start your financial journey' : 'Sign in to continue to Spendly'}
          </p>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-center gap-2 text-red-700">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            <span className="text-sm">{error}</span>
          </div>
        )}

        {/* Email/Password Form */}
        <form onSubmit={handleEmailAuth} className="space-y-4 mb-6">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-slate-700 mb-1">
              Email Address
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              required
            />
          </div>

          <div>
            <label htmlFor="password" className="block text-sm font-medium text-slate-700 mb-1">
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder={isSignUp ? "Create a password (min 6 characters)" : "Enter your password"}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              disabled={isLoading}
              minLength={6}
              required
            />
          </div>

          <button
            type="submit"
            disabled={isLoading || !email || !password}
            className="w-full bg-blue-500 text-white font-semibold py-3 px-4 rounded-lg hover:bg-blue-600 disabled:bg-slate-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                {isSignUp ? 'Creating Account...' : 'Signing In...'}
              </>
            ) : (
              isSignUp ? 'Create Account' : 'Sign In'
            )}
          </button>
        </form>

        {/* Toggle Sign Up/Sign In */}
        <div className="text-center mb-4">
          <button
            onClick={() => {
              setIsSignUp(!isSignUp);
              setError(null);
            }}
            className="text-blue-500 hover:text-blue-600 text-sm transition-colors"
            disabled={isLoading}
          >
            {isSignUp ? 'Already have an account? Sign in' : "Don't have an account? Sign up"}
          </button>
        </div>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-slate-300"></div>
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-2 bg-white text-slate-500">Or continue with</span>
          </div>
        </div>

        {/* Google Sign In */}
        <button
          onClick={handleGoogleAuth}
          disabled={isLoading}
          className="w-full bg-white border border-slate-300 text-slate-700 font-semibold py-3 px-4 rounded-lg hover:bg-slate-50 disabled:bg-slate-100 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-3"
        >
          {isLoading ? (
            <Loader2 className="h-5 w-5 animate-spin" />
          ) : (
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          Continue with Google
        </button>

        {/* Help Text */}
        <div className="mt-6 text-center">
          <p className="text-xs text-slate-500">
            By signing in, you agree to our Terms of Service and Privacy Policy
          </p>
        </div>
      </div>
    </div>
  );
};