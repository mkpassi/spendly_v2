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
    let mounted = true;

    const getSession = async () => {
      try {
        console.log('🔍 AuthContext: Getting initial session...');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('❌ AuthContext: Error getting session:', error);
          throw error;
        }

        if (!mounted) return;

        console.log('📋 AuthContext: Initial session data:', data.session);
        console.log('👤 AuthContext: Initial user data:', data.session?.user);
        
        setSession(data.session);
        setUser(data.session?.user ?? null);
        previousUserRef.current = data.session?.user ?? null;
      } catch (error) {
        console.error('❌ AuthContext: Failed to get initial session:', error);
        if (mounted) {
          setSession(null);
          setUser(null);
          previousUserRef.current = null;
        }
      } finally {
        if (mounted) {
          setLoading(false);
        }
      }
    };

    getSession();

    const { data: authListener } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (!mounted) return;

        console.log('🔄 AuthContext: Auth state changed:', event);
        console.log('📋 AuthContext: Session data:', session);
        console.log('👤 AuthContext: User data:', session?.user);
        
        const previousUser = previousUserRef.current;
        setSession(session);
        setUser(session?.user ?? null);
        previousUserRef.current = session?.user ?? null;
        
        // Handle different auth events
        switch (event) {
          case 'SIGNED_IN':
            if (session?.user && !previousUser) {
              console.log('🚀 AuthContext: User signed in, redirecting to chat');
              navigate('/chat');
            }
            break;
          case 'SIGNED_OUT':
            console.log('👋 AuthContext: User signed out');
            setUserProfile(null);
            navigate('/');
            break;
          case 'TOKEN_REFRESHED':
            console.log('🔄 AuthContext: Token refreshed');
            break;
          case 'USER_UPDATED':
            console.log('🔄 AuthContext: User updated');
            break;
        }
      }
    );

    return () => {
      mounted = false;
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
        profileData = {
          full_name: dbProfile.full_name,
          avatar_url: dbProfile.avatar_url,
          email: dbProfile.email || user.email || null
        };
      } else {
        console.log('⚠️ AuthContext: Database profile not found, falling back to auth metadata');
        profileData = {
          full_name: user.user_metadata?.full_name || null,
          avatar_url: user.user_metadata?.avatar_url || null,
          email: user.email || null
        };

        // Create user profile in database if it doesn't exist
        if (dbError?.code === 'PGRST116') { // Row not found
          console.log('📝 AuthContext: Creating user profile in database...');
          const { error: insertError } = await supabase
            .from('users')
            .insert({
              id: user.id,
              full_name: user.user_metadata?.full_name || null,
              avatar_url: user.user_metadata?.avatar_url || null,
              email: user.email || null
            });

          if (insertError) {
            console.error('❌ AuthContext: Failed to create user profile:', insertError);
          } else {
            console.log('✅ AuthContext: User profile created in database');
          }
        }
      }

      console.log('📄 AuthContext: Final profile data:', profileData);
      setUserProfile(profileData);
    } catch (error) {
      console.error('💥 AuthContext: Error fetching profile:', error);
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
    try {
      console.log('👋 AuthContext: Signing out...');
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      
      setUserProfile(null);
      navigate('/');
    } catch (error) {
      console.error('❌ AuthContext: Error signing out:', error);
    }
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