import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { Auth } from '../components/Auth';
import { 
  Wallet, 
  MessageCircle, 
  Target, 
  BarChart3, 
  Database,
  ArrowRight,
  Sparkles,
  TrendingUp,
  Shield,
  User,
  Home
} from 'lucide-react';

export const LandingPage: React.FC = () => {
  const { user, loading } = useAuth();
  const [showAuthModal, setShowAuthModal] = useState(false);

  const handleStartChatting = () => {
    if (user) {
      // User is logged in, navigate to chat
      window.location.href = '/chat';
    } else {
      // User is not logged in, show auth modal
      setShowAuthModal(true);
    }
  };

  const handleCloseAuthModal = () => {
    setShowAuthModal(false);
  };

  // Show loading while checking auth
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="text-center">
          <div className="w-12 h-12 bg-blue-500 rounded-xl flex items-center justify-center mx-auto mb-4">
            <Wallet className="h-7 w-7 text-white animate-pulse" />
          </div>
          <p className="text-slate-600">Loading...</p>
        </div>
      </div>
    );
  }

  const features = [
    {
      icon: MessageCircle,
      title: 'AI Chat Assistant',
      description: 'Talk to your personal financial coach. Add transactions naturally by typing "Bought coffee for $5"',
      href: '/chat',
      color: 'bg-blue-500',
      hoverColor: 'hover:bg-blue-600'
    },
    {
      icon: Wallet,
      title: 'Transaction Management',
      description: 'View, edit, and organize all your financial transactions in one place',
      href: '/transactions',
      color: 'bg-green-500',
      hoverColor: 'hover:bg-green-600'
    },
    {
      icon: Target,
      title: 'Savings Goals',
      description: 'Set and track your financial goals with intelligent progress monitoring',
      href: '/goals',
      color: 'bg-purple-500',
      hoverColor: 'hover:bg-purple-600'
    },
    {
      icon: BarChart3,
      title: 'Monthly Summary',
      description: 'Get AI-powered insights and analysis of your spending patterns',
      href: '/summary',
      color: 'bg-amber-500',
      hoverColor: 'hover:bg-amber-600'
    }
  ];

  const stats = [
    { label: 'Smart Tracking', value: 'AI-Powered', icon: Sparkles },
    { label: 'Goal Achievement', value: '95% Success', icon: Target },
    { label: 'Savings Growth', value: '+$2,500 Avg', icon: TrendingUp },
    { label: 'Data Security', value: 'Bank-Level', icon: Shield }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      {user ? (
        // Dashboard view for logged-in users
        <div className="max-w-7xl mx-auto px-6 py-8">
          <div className="text-center mb-12">
            <h1 className="text-4xl font-bold text-slate-800 mb-4">
              Welcome back, {user.user_metadata?.full_name || user.email?.split('@')[0]}! 👋
            </h1>
            <p className="text-xl text-slate-600 mb-8">
              Ready to continue your financial wellness journey? Pick up where you left off.
            </p>
            <button
              onClick={handleStartChatting}
              className="inline-flex items-center gap-2 px-8 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-lg font-semibold shadow-lg hover:shadow-xl"
            >
              Start Chatting with AI
              <ArrowRight className="h-5 w-5" />
            </button>
          </div>

          {/* Quick Stats */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-12">
            {stats.map((stat, index) => (
              <div key={index} className="bg-white rounded-xl p-6 text-center shadow-md hover:shadow-lg transition-shadow">
                <stat.icon className="h-8 w-8 text-blue-500 mx-auto mb-3" />
                <div className="text-2xl font-bold text-slate-800 mb-1">{stat.value}</div>
                <div className="text-sm text-slate-600">{stat.label}</div>
              </div>
            ))}
          </div>

          {/* Quick Actions */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, index) => (
              <Link
                key={index}
                to={feature.href}
                className="group bg-white rounded-2xl p-8 shadow-md hover:shadow-xl transition-all duration-300 hover:-translate-y-1"
              >
                <div className={`w-16 h-16 ${feature.color} rounded-xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform`}>
                  <feature.icon className="h-8 w-8 text-white" />
                </div>
                
                <h3 className="text-xl font-semibold text-slate-800 mb-3 group-hover:text-blue-600 transition-colors">
                  {feature.title}
                </h3>
                
                <p className="text-slate-600 mb-4 leading-relaxed">
                  {feature.description}
                </p>
                
                <div className="flex items-center text-blue-500 font-medium group-hover:text-blue-600 transition-colors">
                  Go to {feature.title}
                  <ArrowRight className="h-4 w-4 ml-2 group-hover:translate-x-1 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </div>
      ) : (
        // Marketing view for logged-out users
        <>
          {/* Hero Section */}
          <div className="max-w-7xl mx-auto px-4 py-16">
            <div className="text-center mb-16">
              <h1 className="text-5xl font-bold text-slate-800 mb-6">
                Your AI-Powered
                <span className="text-blue-500 block">Financial Wellness Coach</span>
              </h1>
              <p className="text-xl text-slate-600 mb-8 max-w-3xl mx-auto">
                Transform your financial habits with intelligent tracking, personalized insights, 
                and goal-driven savings strategies. Start your journey to financial wellness today.
              </p>
              <button
                onClick={handleStartChatting}
                className="inline-flex items-center gap-2 px-8 py-4 bg-blue-500 text-white rounded-xl hover:bg-blue-600 transition-colors text-lg font-semibold shadow-lg hover:shadow-xl"
              >
                Start Chatting with AI
                <ArrowRight className="h-5 w-5" />
              </button>
            </div>

            {/* Stats */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-6 mb-16">
              {stats.map((stat, index) => (
                <div key={index} className="bg-white rounded-xl p-6 text-center shadow-md hover:shadow-lg transition-shadow">
                  <stat.icon className="h-8 w-8 text-blue-500 mx-auto mb-3" />
                  <div className="text-2xl font-bold text-slate-800 mb-1">{stat.value}</div>
                  <div className="text-sm text-slate-600">{stat.label}</div>
                </div>
              ))}
            </div>

            {/* Features Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
              {features.map((feature, index) => (
                <div
                  key={index}
                  className="bg-white rounded-2xl p-8 shadow-md"
                >
                  <div className={`w-16 h-16 ${feature.color} rounded-xl flex items-center justify-center mb-6`}>
                    <feature.icon className="h-8 w-8 text-white" />
                  </div>
                  
                  <h3 className="text-xl font-semibold text-slate-800 mb-3">
                    {feature.title}
                  </h3>
                  
                  <p className="text-slate-600 mb-4 leading-relaxed">
                    {feature.description}
                  </p>
                  
                  <div className="flex items-center text-slate-400 font-medium">
                    Sign in to explore
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </div>
                </div>
              ))}
            </div>

            {/* CTA Section */}
            <div className="mt-20 text-center bg-gradient-to-r from-blue-500 to-green-500 rounded-3xl p-12 text-white">
              <h2 className="text-3xl font-bold mb-4">Ready to Transform Your Finances?</h2>
              <p className="text-xl mb-8 opacity-90">
                Join thousands of users who've improved their financial wellness with Spendly
              </p>
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleStartChatting}
                  className="px-8 py-4 bg-white text-blue-600 rounded-xl hover:bg-gray-50 transition-colors font-semibold shadow-lg"
                >
                  Start Free Today
                </button>
                <button
                  onClick={handleStartChatting}
                  className="px-8 py-4 bg-transparent border-2 border-white text-white rounded-xl hover:bg-white hover:text-blue-600 transition-colors font-semibold"
                >
                  Try Demo Data
                </button>
              </div>
            </div>
          </div>
        </>
      )}
      {showAuthModal && <Auth onClose={handleCloseAuthModal} />}
    </div>
  );
};