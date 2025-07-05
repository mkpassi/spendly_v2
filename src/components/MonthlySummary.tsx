import React, { useState, useRef } from 'react';
import { BarChart3, Calendar, TrendingUp, Loader2, DollarSign, Target, TrendingDown, AlertCircle, RefreshCw, PieChart, Activity } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { formatCurrency } from '../utils/currencyUtils';

interface MonthlySummaryProps {
  userId?: string;
}

interface SummaryData {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  expensesByCategory: Record<string, number>;
  incomeByCategory: Record<string, number>;
  transactionCount: number;
  topSpendingCategory: string;
  topIncomeCategory: string;
  averageTransactionAmount: number;
  daysWithTransactions: number;
}

export const MonthlySummary: React.FC<MonthlySummaryProps> = ({ userId }) => {
  const { user } = useAuth();
  const { currency } = useCurrency();
  const [summary, setSummary] = useState<string>('');
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastGenerated, setLastGenerated] = useState<Date | null>(null);
  const [showDebug, setShowDebug] = useState(false);
  const loadingRef = useRef(false);

  // Test function for debugging
  const testMonthlySummary = async () => {
    if (!user) return;
    
    console.log('🧪 MonthlySummary: Testing monthly summary function...');
    setShowDebug(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        console.error('🧪 No session found for testing');
        return;
      }

      console.log('🧪 Testing monthly summary with direct call...');
      const testRequestBody = {
        month: new Date().getMonth() + 1,
        year: new Date().getFullYear(),
        userId: user.id
      };
      
      console.log('🧪 Test request body:', testRequestBody);
      
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const functionUrl = `${supabaseUrl}/functions/v1/monthly-summary`;
      
      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': supabaseAnonKey,
        },
        body: JSON.stringify(testRequestBody),
      });
      
      console.log('🧪 Test response status:', response.status);
      const result = await response.json();
      console.log('🧪 Test response data:', result);
      
    } catch (err) {
      console.error('🧪 Monthly summary test failed:', err);
    }
  };

  const generateSummary = async () => {
    if (!user || loadingRef.current) return;
    
    loadingRef.current = true;
    setIsLoading(true);
    setShowSummary(true);
    setError(null);

    try {
      console.log('📊 MonthlySummary: Generating summary for user:', user.id);
      
      const currentDate = new Date();
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }

      console.log('📊 MonthlySummary: Calling monthly-summary function...');
      
      // Use direct fetch for better control
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monthly-summary`;
      
      const requestBody = {
        month: currentDate.getMonth() + 1,
        year: currentDate.getFullYear(),
        userId: user.id
      };

      console.log('📊 MonthlySummary: Request body:', requestBody);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📊 MonthlySummary: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📊 MonthlySummary: Response error:', errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 MonthlySummary: Response data:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate summary');
      }

      setSummary(result.summary);
      setSummaryData(result.data);
      setLastGenerated(new Date());
      setError(null);

    } catch (error) {
      console.error('📊 MonthlySummary: Error generating summary:', error);
      setError(error instanceof Error ? error.message : 'Failed to generate summary');
      setSummary('');
      setSummaryData(null);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };

  const formatCurrencyWithSymbol = (amount: number) => {
    return formatCurrency(amount, currency);
  };

  const formatMessage = (message: string) => {
    return message.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < message.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const getCurrentMonthName = () => {
    return new Date().toLocaleString('default', { month: 'long', year: 'numeric' });
  };

  const getProgressBarColor = (savingsRate: number) => {
    if (savingsRate >= 20) return 'bg-green-500';
    if (savingsRate >= 10) return 'bg-blue-500';
    if (savingsRate >= 0) return 'bg-yellow-500';
    return 'bg-red-500';
  };

  const getSavingsRateLabel = (savingsRate: number) => {
    if (savingsRate >= 20) return 'Excellent';
    if (savingsRate >= 10) return 'Good';
    if (savingsRate >= 0) return 'Fair';
    return 'Needs Improvement';
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-50 to-purple-50 px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <BarChart3 className="h-6 w-6 text-blue-600" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-slate-800">Monthly Summary</h2>
              <p className="text-sm text-slate-600">{getCurrentMonthName()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {/* Debug Button */}
            <button
              onClick={() => setShowDebug(!showDebug)}
              className="px-2 py-1 text-xs bg-gray-200 text-gray-600 rounded hover:bg-gray-300 transition-colors"
            >
              🔧 Debug
            </button>
            <button
              onClick={generateSummary}
              disabled={isLoading || !user}
              className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors shadow-sm"
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <TrendingUp className="h-4 w-4" />
              )}
              <span className="text-sm font-medium">
                {isLoading ? 'Generating...' : 'Generate Summary'}
              </span>
            </button>
          </div>
        </div>
        
        {/* Debug Panel */}
        {showDebug && (
          <div className="mt-4 p-3 bg-gray-50 border border-gray-200 rounded-lg">
            <h4 className="text-sm font-semibold text-gray-800 mb-2">Debug Panel</h4>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={testMonthlySummary}
                className="px-3 py-1 bg-purple-500 text-white rounded text-xs hover:bg-purple-600 transition-colors"
              >
                🧪 Test Monthly Summary
              </button>
              <button
                onClick={() => console.log('User:', user)}
                className="px-3 py-1 bg-blue-500 text-white rounded text-xs hover:bg-blue-600 transition-colors"
              >
                👤 Log User Info
              </button>
              <button
                onClick={() => console.log('Summary Data:', summaryData)}
                className="px-3 py-1 bg-green-500 text-white rounded text-xs hover:bg-green-600 transition-colors"
              >
                📊 Log Summary Data
              </button>
            </div>
          </div>
        )}
        
        {lastGenerated && (
          <div className="mt-2 text-xs text-slate-500">
            Last updated: {lastGenerated.toLocaleString()}
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-6">
        {!showSummary ? (
          <div className="text-center py-12">
            <div className="max-w-md mx-auto">
              <Calendar className="h-16 w-16 mx-auto mb-4 text-slate-300" />
              <h3 className="text-xl font-semibold text-slate-800 mb-2">
                Get Your Financial Health Report
              </h3>
              <p className="text-slate-600 mb-6">
                Discover insights about your spending patterns, savings progress, and get personalized recommendations from your AI financial coach.
              </p>
              <div className="grid grid-cols-2 gap-4 text-sm text-slate-500">
                <div className="flex items-center gap-2">
                  <PieChart className="h-4 w-4" />
                  <span>Spending Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <Target className="h-4 w-4" />
                  <span>Savings Insights</span>
                </div>
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  <span>Trend Analysis</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>AI Recommendations</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="space-y-6">
            {/* Loading State */}
            {isLoading && (
              <div className="flex items-center justify-center py-12">
                <div className="text-center">
                  <Loader2 className="h-12 w-12 animate-spin text-blue-500 mx-auto mb-4" />
                  <h3 className="text-lg font-semibold text-slate-800 mb-2">
                    Analyzing Your Financial Data
                  </h3>
                  <p className="text-slate-600">
                    Our AI is reviewing your transactions and generating personalized insights...
                  </p>
                </div>
              </div>
            )}

            {/* Error State */}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-6 w-6 text-red-500 flex-shrink-0 mt-0.5" />
                  <div className="flex-1">
                    <h3 className="font-semibold text-red-900 mb-1">
                      Unable to Generate Summary
                    </h3>
                    <p className="text-red-800 text-sm mb-3">{error}</p>
                    <button
                      onClick={generateSummary}
                      className="flex items-center gap-2 px-3 py-1 bg-red-100 text-red-800 rounded hover:bg-red-200 transition-colors text-sm"
                    >
                      <RefreshCw className="h-4 w-4" />
                      Try Again
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Success State */}
            {!isLoading && !error && summaryData && (
              <>
                {/* Financial Overview Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  <div className="bg-gradient-to-br from-green-50 to-green-100 border border-green-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-green-200 rounded-lg">
                        <TrendingUp className="h-5 w-5 text-green-700" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-green-900">Total Income</h3>
                        <p className="text-sm text-green-700">This month</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-green-800">
                      {formatCurrencyWithSymbol(summaryData.totalIncome)}
                    </p>
                    {summaryData.topIncomeCategory && (
                      <p className="text-sm text-green-600 mt-1">
                        Top: {summaryData.topIncomeCategory}
                      </p>
                    )}
                  </div>

                  <div className="bg-gradient-to-br from-red-50 to-red-100 border border-red-200 rounded-lg p-4">
                    <div className="flex items-center gap-3 mb-3">
                      <div className="p-2 bg-red-200 rounded-lg">
                        <TrendingDown className="h-5 w-5 text-red-700" />
                      </div>
                      <div>
                        <h3 className="font-semibold text-red-900">Total Expenses</h3>
                        <p className="text-sm text-red-700">This month</p>
                      </div>
                    </div>
                    <p className="text-2xl font-bold text-red-800">
                      {formatCurrencyWithSymbol(summaryData.totalExpenses)}
                    </p>
                    {summaryData.topSpendingCategory && (
                      <p className="text-sm text-red-600 mt-1">
                        Top: {summaryData.topSpendingCategory}
                      </p>
                    )}
                  </div>

                  <div className={`bg-gradient-to-br rounded-lg p-4 border ${
                    summaryData.netSavings >= 0 
                      ? 'from-blue-50 to-blue-100 border-blue-200' 
                      : 'from-orange-50 to-orange-100 border-orange-200'
                  }`}>
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 rounded-lg ${
                        summaryData.netSavings >= 0 ? 'bg-blue-200' : 'bg-orange-200'
                      }`}>
                        <Target className={`h-5 w-5 ${
                          summaryData.netSavings >= 0 ? 'text-blue-700' : 'text-orange-700'
                        }`} />
                      </div>
                      <div>
                        <h3 className={`font-semibold ${
                          summaryData.netSavings >= 0 ? 'text-blue-900' : 'text-orange-900'
                        }`}>
                          Net {summaryData.netSavings >= 0 ? 'Savings' : 'Deficit'}
                        </h3>
                        <p className={`text-sm ${
                          summaryData.netSavings >= 0 ? 'text-blue-700' : 'text-orange-700'
                        }`}>
                          {summaryData.savingsRate.toFixed(1)}% rate
                        </p>
                      </div>
                    </div>
                    <p className={`text-2xl font-bold ${
                      summaryData.netSavings >= 0 ? 'text-blue-800' : 'text-orange-800'
                    }`}>
                      {summaryData.netSavings >= 0 ? '+' : ''}{formatCurrencyWithSymbol(summaryData.netSavings)}
                    </p>
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-slate-600">Savings Rate</span>
                        <span className={`font-medium ${
                          summaryData.netSavings >= 0 ? 'text-blue-700' : 'text-orange-700'
                        }`}>
                          {getSavingsRateLabel(summaryData.savingsRate)}
                        </span>
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-2">
                        <div
                          className={`h-2 rounded-full transition-all duration-300 ${getProgressBarColor(summaryData.savingsRate)}`}
                          style={{ width: `${Math.min(Math.max(Math.abs(summaryData.savingsRate), 0), 100)}%` }}
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Quick Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-800">
                      {summaryData.transactionCount}
                    </div>
                    <div className="text-sm text-slate-600">Transactions</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-800">
                      {summaryData.daysWithTransactions}
                    </div>
                    <div className="text-sm text-slate-600">Active Days</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-800">
                      {formatCurrencyWithSymbol(summaryData.averageTransactionAmount)}
                    </div>
                    <div className="text-sm text-slate-600">Avg Transaction</div>
                  </div>
                  <div className="bg-slate-50 rounded-lg p-4 text-center">
                    <div className="text-2xl font-bold text-slate-800">
                      {Object.keys(summaryData.expensesByCategory).length}
                    </div>
                    <div className="text-sm text-slate-600">Categories</div>
                  </div>
                </div>

                {/* AI Summary */}
                <div className="bg-gradient-to-br from-blue-50 to-purple-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-start gap-4">
                    <div className="p-3 bg-blue-500 rounded-full flex-shrink-0">
                      <BarChart3 className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold text-blue-900 mb-3">
                        Your AI Financial Coach Says:
                      </h3>
                      <div className="text-blue-800 leading-relaxed">
                        {formatMessage(summary)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category Breakdown */}
                {Object.keys(summaryData.expensesByCategory).length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-6">
                    <h3 className="text-lg font-semibold text-slate-800 mb-4 flex items-center gap-2">
                      <PieChart className="h-5 w-5" />
                      Expense Breakdown
                    </h3>
                    <div className="space-y-3">
                      {Object.entries(summaryData.expensesByCategory)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 6)
                        .map(([category, amount]) => {
                          const percentage = summaryData.totalExpenses > 0 
                            ? (amount / summaryData.totalExpenses) * 100 
                            : 0;
                          return (
                            <div key={category} className="flex items-center justify-between">
                              <div className="flex items-center gap-3 flex-1">
                                <div className="w-4 h-4 bg-blue-500 rounded-full flex-shrink-0"></div>
                                <span className="text-sm font-medium text-slate-700">{category}</span>
                                <div className="flex-1 mx-3">
                                  <div className="w-full bg-slate-200 rounded-full h-2">
                                    <div
                                      className="h-2 bg-blue-500 rounded-full transition-all duration-300"
                                      style={{ width: `${percentage}%` }}
                                    />
                                  </div>
                                </div>
                              </div>
                              <div className="text-right flex-shrink-0">
                                <div className="text-sm font-semibold text-slate-800">
                                  {formatCurrencyWithSymbol(amount)}
                                </div>
                                <div className="text-xs text-slate-500">
                                  {percentage.toFixed(1)}%
                                </div>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {/* Regenerate Button */}
            {!isLoading && !error && summary && (
              <div className="text-center pt-4 border-t border-slate-200">
                <button
                  onClick={generateSummary}
                  className="text-blue-500 hover:text-blue-600 text-sm font-medium transition-colors flex items-center gap-2 mx-auto"
                >
                  <RefreshCw className="h-4 w-4" />
                  Generate New Summary
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
};