import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Auth } from './Auth';
import { 
  LogIn, 
  User, 
  Settings, 
  LogOut, 
  ChevronDown, 
  Wallet,
  History
} from 'lucide-react';

export const Header: React.FC = () => {
  const { user, userProfile, signOut, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showUserMenu, setShowUserMenu] = useState(false);

  // Debug logging for user data
  React.useEffect(() => {
    console.log('🎯 Header: User data changed:', user);
    console.log('📄 Header: User profile data:', userProfile);
    console.log('🏷️ Header: User metadata (fallback):', user?.user_metadata);
  }, [user, userProfile]);

  const handleLoginClick = () => setShowAuthModal(true);
  const handleCloseModal = () => setShowAuthModal(false);

  // Fallback user display data - prioritize database profile over auth metadata
  const getUserDisplayName = () => {
    // First priority: Database profile
    if (userProfile?.full_name) {
      console.log('🎯 Header: Using database full_name:', userProfile.full_name);
      return userProfile.full_name;
    }
    // Second priority: Auth metadata
    if (user?.user_metadata?.full_name) {
      console.log('🎯 Header: Using auth metadata full_name:', user.user_metadata.full_name);
      return user.user_metadata.full_name;
    }
    // Third priority: Extract from email
    if (user?.email) {
      const emailName = user.email.split('@')[0];
      const displayName = emailName.charAt(0).toUpperCase() + emailName.slice(1);
      console.log('🎯 Header: Using email-derived name:', displayName);
      return displayName;
    }
    console.log('🎯 Header: Using fallback name: User');
    return 'User';
  };

  const getUserAvatarUrl = () => {
    console.log('🔍 Header: getUserAvatarUrl called');
    console.log('📄 Header: userProfile?.avatar_url:', userProfile?.avatar_url);
    console.log('🏷️ Header: user?.user_metadata?.avatar_url:', user?.user_metadata?.avatar_url);
    
    // First priority: Database profile
    if (userProfile?.avatar_url) {
      console.log('🎯 Header: Using database avatar_url:', userProfile.avatar_url);
      console.log('🎯 Header: Avatar URL is valid:', userProfile.avatar_url.startsWith('http'));
      return userProfile.avatar_url;
    }
    // Second priority: Auth metadata
    if (user?.user_metadata?.avatar_url) {
      console.log('🎯 Header: Using auth metadata avatar_url:', user.user_metadata.avatar_url);
      return user.user_metadata.avatar_url;
    }
    // Third priority: Generate avatar
    const name = user?.email || 'User';
    const generatedUrl = `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=random&color=fff&size=128`;
    console.log('🎯 Header: Using generated avatar:', generatedUrl);
    return generatedUrl;
  };

  return (
    <>
      <header className="bg-white shadow-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-6 py-5">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-4 hover:opacity-80 transition-opacity">
              <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center">
                <Wallet className="h-7 w-7 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-slate-800">Spendly</h1>
                <p className="text-sm text-slate-600">Track Smart, Save Easy.</p>
              </div>
            </Link>

            <div className="relative">
              {loading ? (
                <div className="w-24 h-10 bg-slate-200 rounded-lg animate-pulse"></div>
              ) : user ? (
                <>
                  <button
                    onClick={() => setShowUserMenu(!showUserMenu)}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg hover:bg-slate-50 transition-colors"
                  >
                    <img
                      src={getUserAvatarUrl()}
                      alt={getUserDisplayName()}
                      className="w-10 h-10 rounded-full object-cover border-2 border-slate-200"
                    />
                    <div className="text-left hidden sm:block">
                      <p className="text-sm font-medium text-slate-800">{getUserDisplayName()}</p>
                      <p className="text-xs text-slate-500">Online</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-slate-400" />
                  </button>
                  {showUserMenu && (
                    <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                      <div className="px-4 py-3 border-b border-slate-200">
                        <p className="font-medium text-slate-800 truncate">{getUserDisplayName()}</p>
                        <p className="text-sm text-slate-500 truncate">{user.email}</p>
                      </div>
                      <div className="py-2">
                        <Link to="/profile" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
                          <User className="h-4 w-4" />
                          <span>View Profile</span>
                        </Link>
                        <Link to="/chat-history" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
                          <History className="h-4 w-4" />
                          <span>Chat History</span>
                        </Link>
                        <Link to="/settings" onClick={() => setShowUserMenu(false)} className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors">
                          <Settings className="h-4 w-4" />
                          <span>Budget Settings</span>
                        </Link>
                      </div>
                      <div className="border-t border-slate-200 pt-2">
                        <button onClick={() => { signOut(); setShowUserMenu(false); }} className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors w-full text-left">
                          <LogOut className="h-4 w-4" />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    </div>
                  )}
                </>
              ) : (
                <button
                  onClick={handleLoginClick}
                  className="bg-slate-800 text-white font-bold py-3 px-6 rounded-lg flex items-center hover:bg-slate-700 transition-colors text-lg"
                >
                  <LogIn className="mr-2 h-5 w-5" />
                  Login
                </button>
              )}
            </div>
          </div>
        </div>
      </header>
      {showAuthModal && <Auth onClose={handleCloseModal} />}
      {showUserMenu && <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />}
    </>
  );
}; 