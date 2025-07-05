import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { supabase } from '../lib/supabase';
import { 
  Cog6ToothIcon, 
  CurrencyDollarIcon, 
  ChartPieIcon, 
  ExclamationTriangleIcon,
  CheckCircleIcon,
  ArrowPathIcon
} from '@heroicons/react/24/outline';

interface BudgetSettings {
  expenses_percentage: number;
  savings_percentage: number;
  goals_percentage: number;
}

interface Goal {
  id: string;
  title: string;
  target_amount: number;
  allocated_amount: number;
  percentage_allocation: number;
  is_active: boolean;
}

export default function SettingsPage() {
  const { user } = useAuth();
  const [settings, setSettings] = useState<BudgetSettings>({
    expenses_percentage: 50,
    savings_percentage: 30,
    goals_percentage: 20
  });
  const [activeGoals, setActiveGoals] = useState<Goal[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error' | 'warning', text: string } | null>(null);

  useEffect(() => {
    if (user) {
      loadSettings();
      loadActiveGoals();
    }
  }, [user]);

  const loadSettings = async () => {
    try {
      const { data, error } = await supabase
        .rpc('get_user_budget_settings', {
          user_id_param: user?.id || 'anonymous_user'
        });

      if (error) throw error;

      if (data && data.length > 0) {
        setSettings({
          expenses_percentage: parseFloat(data[0].expenses_percentage),
          savings_percentage: parseFloat(data[0].savings_percentage),
          goals_percentage: parseFloat(data[0].goals_percentage)
        });
      }
    } catch (error) {
      console.error('Error loading settings:', error);
      setMessage({ type: 'error', text: 'Failed to load settings. Using defaults.' });
    } finally {
      setLoading(false);
    }
  };

  const loadActiveGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('id, title, target_amount, allocated_amount, percentage_allocation, is_active')
        .eq('user_id', user?.id || 'anonymous_user')
        .eq('is_active', true);

      if (error) throw error;

      setActiveGoals(data || []);
    } catch (error) {
      console.error('Error loading goals:', error);
    }
  };

  const handlePercentageChange = (field: keyof BudgetSettings, value: number) => {
    const newSettings = { ...settings, [field]: value };
    
    // Ensure total doesn't exceed 100%
    const total = newSettings.expenses_percentage + newSettings.savings_percentage + newSettings.goals_percentage;
    
    if (total <= 100) {
      setSettings(newSettings);
      setMessage(null);
    } else {
      setMessage({ 
        type: 'warning', 
        text: `Total allocation cannot exceed 100%. Current total: ${total.toFixed(1)}%` 
      });
    }
  };

  const saveSettings = async () => {
    setSaving(true);
    setMessage(null);

    try {
      const total = settings.expenses_percentage + settings.savings_percentage + settings.goals_percentage;
      
      if (total !== 100) {
        throw new Error(`Total allocation must equal 100%. Current total: ${total.toFixed(1)}%`);
      }

      // Insert or update settings
      const { error } = await supabase
        .from('user_settings')
        .upsert({
          user_id: user?.id || 'anonymous_user',
          expenses_percentage: settings.expenses_percentage,
          savings_percentage: settings.savings_percentage,
          goals_percentage: settings.goals_percentage
        }, {
          onConflict: 'user_id'
        });

      if (error) throw error;

      setMessage({ type: 'success', text: 'Settings saved successfully!' });
      
      // Auto-hide success message after 3 seconds
      setTimeout(() => setMessage(null), 3000);
    } catch (error: any) {
      console.error('Error saving settings:', error);
      setMessage({ type: 'error', text: error.message || 'Failed to save settings' });
    } finally {
      setSaving(false);
    }
  };

  const resetToDefaults = () => {
    setSettings({
      expenses_percentage: 50,
      savings_percentage: 30,
      goals_percentage: 20
    });
    setMessage(null);
  };

  const getPercentageColor = (percentage: number) => {
    if (percentage >= 60) return 'text-red-600';
    if (percentage >= 40) return 'text-yellow-600';
    return 'text-green-600';
  };

  const getPercentageBgColor = (percentage: number) => {
    if (percentage >= 60) return 'bg-red-100 border-red-300';
    if (percentage >= 40) return 'bg-yellow-100 border-yellow-300';
    return 'bg-green-100 border-green-300';
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <ArrowPathIcon className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-gray-600">Loading settings...</p>
        </div>
      </div>
    );
  }

  const total = settings.expenses_percentage + settings.savings_percentage + settings.goals_percentage;

  return (
    <div className="min-h-screen bg-gray-50 py-8">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center space-x-3 mb-4">
            <Cog6ToothIcon className="h-8 w-8 text-blue-600" />
            <h1 className="text-3xl font-bold text-gray-900">Budget Settings</h1>
          </div>
          <p className="text-gray-600">
            Configure how your income is automatically allocated across expenses, savings, and goals.
          </p>
        </div>

        {/* Message Display */}
        {message && (
          <div className={`mb-6 p-4 rounded-lg border flex items-center space-x-3 ${
            message.type === 'success' 
              ? 'bg-green-50 border-green-200 text-green-800' 
              : message.type === 'error'
              ? 'bg-red-50 border-red-200 text-red-800'
              : 'bg-yellow-50 border-yellow-200 text-yellow-800'
          }`}>
            {message.type === 'success' && <CheckCircleIcon className="h-5 w-5 text-green-600" />}
            {message.type === 'error' && <ExclamationTriangleIcon className="h-5 w-5 text-red-600" />}
            {message.type === 'warning' && <ExclamationTriangleIcon className="h-5 w-5 text-yellow-600" />}
            <span>{message.text}</span>
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Budget Allocation Settings */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-semibold text-gray-900 mb-6 flex items-center">
                <ChartPieIcon className="h-6 w-6 text-blue-600 mr-2" />
                Budget Allocation
              </h2>

              <div className="space-y-6">
                {/* Expenses */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Expenses ({settings.expenses_percentage.toFixed(1)}%)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.expenses_percentage}
                      onChange={(e) => handlePercentageChange('expenses_percentage', parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.expenses_percentage}
                      onChange={(e) => handlePercentageChange('expenses_percentage', parseFloat(e.target.value) || 0)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    Percentage of income allocated to living expenses and discretionary spending
                  </p>
                </div>

                {/* Savings */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Savings ({settings.savings_percentage.toFixed(1)}%)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.savings_percentage}
                      onChange={(e) => handlePercentageChange('savings_percentage', parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.savings_percentage}
                      onChange={(e) => handlePercentageChange('savings_percentage', parseFloat(e.target.value) || 0)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    Percentage of income allocated to general savings and emergency fund
                  </p>
                </div>

                {/* Goals */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    Goals ({settings.goals_percentage.toFixed(1)}%)
                  </label>
                  <div className="flex items-center space-x-4">
                    <input
                      type="range"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.goals_percentage}
                      onChange={(e) => handlePercentageChange('goals_percentage', parseFloat(e.target.value))}
                      className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer"
                    />
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={settings.goals_percentage}
                      onChange={(e) => handlePercentageChange('goals_percentage', parseFloat(e.target.value) || 0)}
                      className="w-20 px-3 py-2 border border-gray-300 rounded-md text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                  <p className="text-sm text-gray-600">
                    Percentage of income allocated to your active savings goals
                  </p>
                </div>

                {/* Total Display */}
                <div className={`p-4 rounded-lg border-2 ${getPercentageBgColor(total)}`}>
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-gray-900">Total Allocation:</span>
                    <span className={`text-lg font-bold ${getPercentageColor(total)}`}>
                      {total.toFixed(1)}%
                    </span>
                  </div>
                  {total !== 100 && (
                    <p className="text-sm text-gray-600 mt-1">
                      {total < 100 ? `${(100 - total).toFixed(1)}% remaining` : 'Exceeds 100%'}
                    </p>
                  )}
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex space-x-4 mt-8">
                <button
                  onClick={saveSettings}
                  disabled={saving || total !== 100}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-medium hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {saving ? 'Saving...' : 'Save Settings'}
                </button>
                <button
                  onClick={resetToDefaults}
                  className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg font-medium hover:bg-gray-50 transition-colors"
                >
                  Reset to Defaults
                </button>
              </div>
            </div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Current Goals */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4 flex items-center">
                <CurrencyDollarIcon className="h-5 w-5 text-green-600 mr-2" />
                Active Goals ({activeGoals.length})
              </h3>
              
              {activeGoals.length === 0 ? (
                <p className="text-gray-500 text-sm">
                  No active goals. Create a goal by chatting about what you want to save for!
                </p>
              ) : (
                <div className="space-y-3">
                  {activeGoals.map((goal) => (
                    <div key={goal.id} className="p-3 bg-gray-50 rounded-lg">
                      <div className="flex justify-between items-start mb-2">
                        <h4 className="font-medium text-gray-900 text-sm">{goal.title}</h4>
                        <span className="text-xs text-gray-500">
                          {goal.percentage_allocation?.toFixed(1)}%
                        </span>
                      </div>
                      <div className="text-sm text-gray-600">
                        <div className="flex justify-between">
                          <span>Progress:</span>
                          <span>${goal.allocated_amount.toFixed(2)} / ${goal.target_amount.toFixed(2)}</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-blue-600 h-2 rounded-full" 
                            style={{ width: `${Math.min((goal.allocated_amount / goal.target_amount) * 100, 100)}%` }}
                          ></div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* How It Works */}
            <div className="bg-blue-50 rounded-lg border border-blue-200 p-6">
              <h3 className="text-lg font-semibold text-blue-900 mb-4">How It Works</h3>
              <div className="space-y-3 text-sm text-blue-800">
                <div className="flex items-start space-x-2">
                  <span className="font-medium">1.</span>
                  <span>When you add income, it's automatically split according to your percentages.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="font-medium">2.</span>
                  <span>Goal allocation is divided equally among your active goals.</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="font-medium">3.</span>
                  <span>You can override with specific amounts like "save $200 for vacation".</span>
                </div>
                <div className="flex items-start space-x-2">
                  <span className="font-medium">4.</span>
                  <span>Expenses beyond your budget will show warnings but won't be blocked.</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 