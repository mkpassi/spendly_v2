import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Wallet, Home, ChevronRight } from 'lucide-react';

interface LayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
}

export const Layout: React.FC<LayoutProps> = ({ children, title, description }) => {
  const location = useLocation();

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
    </div>
  );
};