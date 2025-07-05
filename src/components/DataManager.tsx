import React, { useState } from 'react';
import { Database, Trash2, Plus, RefreshCw, BarChart3, Target, MessageCircle } from 'lucide-react';
import { useCurrency } from '../contexts/CurrencyContext';
import { insertDummyData, clearAllData } from '../utils/dummyData';

interface DataManagerProps {
  onDataChange?: () => void;
}

export const DataManager: React.FC<DataManagerProps> = ({ onDataChange }) => {
  const { currencySymbol } = useCurrency();
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState('');

  const handleInsertDummyData = async () => {
    setIsLoading(true);
    setMessage('');
    
    try {
      const success = await insertDummyData();
      if (success) {
        setMessage('✅ Successfully added dummy data! Refresh the page to see the changes.');
        onDataChange?.();
      } else {
        setMessage('❌ Failed to add dummy data. Check console for errors.');
      }
    } catch (error) {
      setMessage('❌ Error adding dummy data. Check console for details.');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearData = async () => {
    if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) {
      return;
    }

    setIsLoading(true);
    setMessage('');
    
    try {
      const success = await clearAllData();
      if (success) {
        setMessage('✅ Successfully cleared all data! Refresh the page to see the changes.');
        onDataChange?.();
      } else {
        setMessage('❌ Failed to clear data. Check console for errors.');
      }
    } catch (error) {
      setMessage('❌ Error clearing data. Check console for details.');
      console.error('Error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRefreshPage = () => {
    window.location.reload();
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <div className="flex items-center gap-2">
          <Database className="h-5 w-5 text-slate-600" />
          <h2 className="text-lg font-semibold text-slate-800">Data Manager</h2>
        </div>
        <p className="text-sm text-slate-600 mt-1">
          Manage prototype data for testing and demonstration
        </p>
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Action Buttons */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={handleInsertDummyData}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">Add Dummy Data</span>
          </button>

          <button
            onClick={handleClearData}
            disabled={isLoading}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-red-500 text-white rounded-lg hover:bg-red-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Trash2 className="h-4 w-4" />
            )}
            <span className="text-sm font-medium">Clear All Data</span>
          </button>

          <button
            onClick={handleRefreshPage}
            className="flex items-center justify-center gap-2 px-4 py-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            <span className="text-sm font-medium">Refresh Page</span>
          </button>
        </div>

        {/* Status Message */}
        {message && (
          <div className={`p-4 rounded-lg ${
            message.includes('✅') 
              ? 'bg-green-50 border border-green-200 text-green-800' 
              : 'bg-red-50 border border-red-200 text-red-800'
          }`}>
            <p className="text-sm">{message}</p>
          </div>
        )}

        {/* Data Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-lg font-semibold text-blue-600">{currencySymbol}</span>
              <h3 className="font-semibold text-blue-900">Transactions</h3>
            </div>
            <p className="text-sm text-blue-800">40 realistic transactions</p>
            <p className="text-xs text-blue-600 mt-1">Income & expenses across 2 months</p>
          </div>

          <div className="bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Target className="h-5 w-5 text-green-600" />
              <h3 className="font-semibold text-green-900">Goals</h3>
            </div>
            <p className="text-sm text-green-800">5 savings goals</p>
            <p className="text-xs text-green-600 mt-1">Emergency fund, MacBook, vacation, etc.</p>
          </div>

          <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <MessageCircle className="h-5 w-5 text-purple-600" />
              <h3 className="font-semibold text-purple-900">Chat History</h3>
            </div>
            <p className="text-sm text-purple-800">12 conversation messages</p>
            <p className="text-xs text-purple-600 mt-1">Realistic AI coaching dialogue</p>
          </div>

          <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <BarChart3 className="h-5 w-5 text-amber-600" />
              <h3 className="font-semibold text-amber-900">Analytics</h3>
            </div>
            <p className="text-sm text-amber-800">Rich data for summaries</p>
            <p className="text-xs text-amber-600 mt-1">Monthly insights & trends</p>
          </div>
        </div>

        {/* What's Included */}
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <h3 className="font-semibold text-blue-900 mb-3">📊 What's included in dummy data:</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <h4 className="font-medium text-blue-800 mb-2">💰 Transactions (40 items)</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Monthly salary: {currencySymbol}4,200</li>
                <li>• Freelance income: {currencySymbol}850</li>
                <li>• Bonuses: {currencySymbol}1,750 total</li>
                <li>• Rent: {currencySymbol}1,850/month</li>
                <li>• Groceries: {currencySymbol}200-400/month</li>
                <li>• Dining: {currencySymbol}300-500/month</li>
                <li>• Utilities, transport, entertainment</li>
                <li>• Mix of daily and monthly expenses</li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium text-blue-800 mb-2">🎯 Goals & Chat</h4>
              <ul className="text-sm text-blue-700 space-y-1">
                <li>• Emergency Fund: {currencySymbol}15,000 target</li>
                <li>• MacBook Pro: {currencySymbol}2,500 target</li>
                <li>• Japan Vacation: {currencySymbol}4,500 target</li>
                <li>• Home Down Payment: {currencySymbol}50,000</li>
                <li>• New Car Fund: {currencySymbol}8,000</li>
                <li>• Realistic chat conversation</li>
                <li>• Goal setting & progress updates</li>
                <li>• Financial coaching dialogue</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Instructions */}
        <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
          <h3 className="font-semibold text-slate-800 mb-2">🚀 How to test the prototype:</h3>
          <ol className="text-sm text-slate-700 space-y-1 list-decimal list-inside">
            <li>Click "Add Dummy Data" to populate the database</li>
            <li>Click "Refresh Page" to reload all components</li>
            <li>Navigate through all tabs to see the data in action</li>
            <li>Test filtering, editing, and goal tracking features</li>
                            <li>Try the Expense Summary generation</li>
            <li>Use "Clear All Data" to reset when needed</li>
          </ol>
        </div>

        {/* Important Notes */}
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <h3 className="font-semibold text-amber-900 mb-2">⚠️ Important Notes:</h3>
          <ul className="text-sm text-amber-800 space-y-1">
            <li>• This is for prototype/demo purposes only</li>
            <li>• Data is stored in your Supabase database</li>
            <li>• Always refresh the page after adding/clearing data</li>
            <li>• AI features require OpenAI API key configuration</li>
            <li>• All financial data is realistic but fictional</li>
            <li>• Perfect for showcasing the app's capabilities</li>
          </ul>
        </div>
      </div>
    </div>
  );
};