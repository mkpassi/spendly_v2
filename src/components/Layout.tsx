import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Home,
  ChevronRight,
  User,
  MessageCircle,
  List,
  Target,
  BarChart3,
  Database,
} from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export const LayoutComponent: React.FC<LayoutProps> = ({
  children,
  title,
  description,
}) => {
  const location = useLocation();

  const getBreadcrumbs = () => {
    const path = location.pathname;
    const breadcrumbs = [{ name: 'Home', href: '/', icon: Home }];

    switch (path) {
      case '/chat':
        breadcrumbs.push({
          name: 'AI Chat',
          href: '/chat',
          icon: MessageCircle,
        });
        break;
      case '/transactions':
        breadcrumbs.push({
          name: 'Transactions',
          href: '/transactions',
          icon: List,
        });
        break;
      case '/goals':
        breadcrumbs.push({ name: 'Goals', href: '/goals', icon: Target });
        break;
      case '/summary':
        breadcrumbs.push({ name: 'Summary', href: '/summary', icon: BarChart3 });
        break;
      case '/data':
        breadcrumbs.push({
          name: 'Data Manager',
          href: '/data',
          icon: Database,
        });
        break;
      case '/profile':
        breadcrumbs.push({ name: 'Profile', href: '/profile', icon: User });
        break;
    }

    return breadcrumbs;
  };

  const navigationItems = [
    { name: 'AI Chat', href: '/chat', icon: MessageCircle },
    { name: 'Transactions', href: '/transactions', icon: List },
    { name: 'Goals', href: '/goals', icon: Target },
    { name: 'Summary', href: '/summary', icon: BarChart3 },
    { name: 'Data Manager', href: '/data', icon: Database },
    { name: 'Profile', href: '/profile', icon: User },
  ];

  const breadcrumbs = getBreadcrumbs();

  return (
    <div className="bg-slate-50 h-full flex flex-col">
      {/* Navigation Bar */}
      <nav className="bg-white border-b border-slate-200 shadow-sm">
        <div className="max-w-7xl mx-auto px-4">
          <div className="flex space-x-8 overflow-x-auto">
            {navigationItems.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  className={`flex items-center gap-2 px-3 py-4 text-sm font-medium whitespace-nowrap border-b-2 transition-colors ${
                    isActive
                      ? 'border-blue-500 text-blue-600'
                      : 'border-transparent text-slate-600 hover:text-slate-800 hover:border-slate-300'
                  }`}
                >
                  <item.icon className="h-4 w-4" />
                  {item.name}
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

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
      <div className="max-w-7xl mx-auto px-4 py-6 w-full flex-1">
        {children}
      </div>
    </div>
  );
};

export const Layout = React.memo(LayoutComponent);