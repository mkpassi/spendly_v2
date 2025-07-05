import React, { createContext, useState, useEffect, useContext, useRef, useMemo, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { Session, User } from '@supabase/supabase-js';

interface AuthContextType {
  session: Session | null;
  user: User | null;
  userProfile: {
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null;
  loading: boolean;
  signOut: () => Promise<void>;
  refreshUserProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<{
    full_name: string | null;
    avatar_url: string | null;
    email: string | null;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const previousUserRef = useRef<User | null>(null);

  useEffect(() => {
    const getSession = async () => {
      console.log('🔍 AuthContext: Getting initial session...');
      const { data } = await supabase.auth.getSession();
      console.log('📋 AuthContext: Initial session data:', data.session);
      console.log('👤 AuthContext: Initial user data:', data.session?.user);
      console.log('🏷️ AuthContext: User metadata:', data.session?.user?.user_metadata);
      setSession(data.session);
      setUser(data.session?.user ?? null);
      previousUserRef.current = data.session?.user ?? null;
      setLoading(false);
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      (event, session) => {
        console.log('🔄 AuthContext: Auth state changed:', event);
        console.log('📋 AuthContext: Session data:', session);
        console.log('👤 AuthContext: User data:', session?.user);
        console.log('🏷️ AuthContext: User metadata:', session?.user?.user_metadata);
        
        // Check if this is a user metadata update
        if (event === 'USER_UPDATED' && session?.user) {
          console.log('🔄 AuthContext: USER_UPDATED event detected');
          console.log('📝 AuthContext: Updated full_name:', session.user.user_metadata?.full_name);
          console.log('🖼️ AuthContext: Updated avatar_url:', session.user.user_metadata?.avatar_url);
        }
        
        const previousUser = previousUserRef.current;
        setSession(session);
        setUser(session?.user ?? null);
        previousUserRef.current = session?.user ?? null;
        setLoading(false);
        
        // Only redirect to chat page when user signs in from the landing page
        if (event === 'SIGNED_IN' && session?.user && !previousUser && window.location.pathname === '/') {
          console.log('🚀 AuthContext: Redirecting to chat page from landing page');
          navigate('/chat');
        }
      }
    );

    return () => {
      authListener?.subscription.unsubscribe();
    };
  }, [navigate]);

  const refreshUserProfile = useCallback(async () => {
    if (!user) {
      console.log('🔍 AuthContext: No user, clearing profile');
      setUserProfile(null);
      return;
    }

    console.log('🔄 AuthContext: Refreshing user profile from database...');
    console.log('👤 AuthContext: User ID for profile fetch:', user.id);

    try {
      // First try to get profile from database
      const { data: dbProfile, error: dbError } = await supabase
        .from('users')
        .select('full_name, avatar_url, email')
        .eq('id', user.id)
        .single();

      console.log('📋 AuthContext: Database profile response:', dbProfile);
      console.log('❗ AuthContext: Database profile error:', dbError);

      let profileData = {
        full_name: null as string | null,
        avatar_url: null as string | null,
        email: user.email || null
      };

      if (dbProfile && !dbError) {
        console.log('✅ AuthContext: Using database profile data');
        console.log('🖼️ AuthContext: Database avatar_url value:', dbProfile.avatar_url);
        console.log('👤 AuthContext: Database full_name value:', dbProfile.full_name);
        profileData = {
          full_name: dbProfile.full_name,
          avatar_url: dbProfile.avatar_url,
          email: dbProfile.email || user.email || null
        };
      } else {
        console.log('⚠️ AuthContext: Database profile not found, falling back to auth metadata');
        console.log('🖼️ AuthContext: Auth metadata avatar_url:', user.user_metadata?.avatar_url);
        console.log('👤 AuthContext: Auth metadata full_name:', user.user_metadata?.full_name);
        profileData = {
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          email: user.email || null
        };
      }

      console.log('📄 AuthContext: Final profile data:', profileData);
      setUserProfile(profileData);
    } catch (error) {
      console.log('💥 AuthContext: Error fetching profile:', error);
      // Fallback to auth metadata
      const fallbackProfile = {
        full_name: user.user_metadata?.full_name || null,
        avatar_url: user.user_metadata?.avatar_url || null,
        email: user.email || null
      };
      console.log('🔄 AuthContext: Using fallback profile:', fallbackProfile);
      setUserProfile(fallbackProfile);
    }
  }, [user]);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUserProfile(null);
    navigate('/');
  }, [navigate]);

  // Refresh user profile when user changes
  useEffect(() => {
    if (user && !loading) {
      console.log('🔄 AuthContext: User changed, refreshing profile...');
      refreshUserProfile();
    }
  }, [user, loading, refreshUserProfile]);

  const value = useMemo(() => ({
    session,
    user,
    userProfile,
    loading,
    signOut,
    refreshUserProfile,
  }), [session, user, userProfile, loading, signOut, refreshUserProfile]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}; 