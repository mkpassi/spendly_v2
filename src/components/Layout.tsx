import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, Home, ChevronRight, User, Settings, LogOut, ChevronDown } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

// Mock user data - in a real app this would come from authentication
const mockUser = {
  id: 'user_123',
  name: 'Alex Johnson',
  email: 'alex.johnson@example.com',
  avatar: 'https://images.pexels.com/photos/2379004/pexels-photo-2379004.jpeg?auto=compress&cs=tinysrgb&w=150&h=150&dpr=2',
  joinedDate: '2024-01-15',
  isLoggedIn: true
};

export const Layout: React.FC<LayoutProps> = ({ children, title, description }) => {
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);

  const getBreadcrumbs = () => {
    const path = location.pathname;
    const breadcrumbs = [
      { name: 'Home', href: '/', icon: Home }
    ];

    switch (path) {
      case '/chat':
        breadcrumbs.push({ name: 'AI Chat', href: '/chat' });
        break;
      case '/transactions':
        breadcrumbs.push({ name: 'Transactions', href: '/transactions' });
        break;
      case '/goals':
        breadcrumbs.push({ name: 'Goals', href: '/goals' });
        break;
      case '/summary':
        breadcrumbs.push({ name: 'Summary', href: '/summary' });
        break;
      case '/data':
        breadcrumbs.push({ name: 'Data Manager', href: '/data' });
        break;
      case '/profile':
        breadcrumbs.push({ name: 'Profile', href: '/profile' });
        break;
    }

    return breadcrumbs;
  };

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <div className="bg-white shadow-sm border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <Link to="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-blue-500 rounded-lg flex items-center justify-center">
                <Wallet className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-xl font-bold text-slate-800">Spendly</h1>
                <p className="text-sm text-slate-600">Track Smart, Save Easy. Powered by AI.</p>
              </div>
            </Link>

            {/* User Profile Section */}
            {mockUser.isLoggedIn && (
              <div className="relative">
                <button
                  onClick={() => setShowUserMenu(!showUserMenu)}
                  className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-slate-50 transition-colors"
                >
                  <div className="flex items-center gap-2">
                    <img
                      src={mockUser.avatar}
                      alt={mockUser.name}
                      className="w-8 h-8 rounded-full object-cover border-2 border-slate-200"
                    />
                    <div className="text-left hidden sm:block">
                      <p className="text-sm font-medium text-slate-800">{mockUser.name}</p>
                      <p className="text-xs text-slate-500">Online</p>
                    </div>
                  </div>
                  <ChevronDown className="h-4 w-4 text-slate-400" />
                </button>

                {/* User Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-slate-200 py-2 z-50">
                    <div className="px-4 py-3 border-b border-slate-200">
                      <div className="flex items-center gap-3">
                        <img
                          src={mockUser.avatar}
                          alt={mockUser.name}
                          className="w-12 h-12 rounded-full object-cover"
                        />
                        <div>
                          <p className="font-medium text-slate-800">{mockUser.name}</p>
                          <p className="text-sm text-slate-500">{mockUser.email}</p>
                        </div>
                      </div>
                    </div>
                    
                    <div className="py-2">
                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <User className="h-4 w-4" />
                        <span>View Profile</span>
                      </Link>
                      <Link
                        to="/profile"
                        onClick={() => setShowUserMenu(false)}
                        className="flex items-center gap-3 px-4 py-2 text-slate-700 hover:bg-slate-50 transition-colors"
                      >
                        <Settings className="h-4 w-4" />
                        <span>Account Settings</span>
                      </Link>
                    </div>
                    
                    <div className="border-t border-slate-200 pt-2">
                      <button className="flex items-center gap-3 px-4 py-2 text-red-600 hover:bg-red-50 transition-colors w-full text-left">
                        <LogOut className="h-4 w-4" />
                        <span>Sign Out</span>
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Breadcrumbs */}
      {location.pathname !== '/' && (
        <div className="bg-white border-b border-slate-200">
          <div className="max-w-7xl mx-auto px-4 py-3">
            <nav className="flex items-center space-x-2 text-sm">
              {breadcrumbs.map((breadcrumb, index) => (
                <React.Fragment key={breadcrumb.href}>
                  {index > 0 && (
                    <ChevronRight className="h-4 w-4 text-slate-400" />
                  )}
                  <Link
                    to={breadcrumb.href}
                    className={`flex items-center gap-1 px-2 py-1 rounded transition-colors ${
                      index === breadcrumbs.length - 1
                        ? 'text-blue-600 bg-blue-50'
                        : 'text-slate-600 hover:text-blue-600 hover:bg-slate-50'
                    }`}
                  >
                    {breadcrumb.icon && <breadcrumb.icon className="h-4 w-4" />}
                    {breadcrumb.name}
                  </Link>
                </React.Fragment>
              ))}
            </nav>
          </div>
        </div>
      )}

      {/* Page Header */}
      <div className="bg-white border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <h1 className="text-2xl font-bold text-slate-800">{title}</h1>
          {description && (
            <p className="text-slate-600 mt-1">{description}</p>
          )}
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {children}
      </div>

      {/* Click outside to close menu */}
      {showUserMenu && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setShowUserMenu(false)}
        />
      )}
    </div>
  );
};