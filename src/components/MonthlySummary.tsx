import React, { useState, useRef, useEffect } from 'react';
import { BarChart3, Calendar, TrendingUp, Loader2, DollarSign, Target, TrendingDown, AlertCircle, RefreshCw, PieChart, Activity, CalendarDays } from 'lucide-react';
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

interface DateRange {
  startDate: string;
  endDate: string;
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
  const [dateRange, setDateRange] = useState<DateRange>({ startDate: '', endDate: '' });
  const loadingRef = useRef(false);

  // Set default date range to current month
  useEffect(() => {
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    
    setDateRange({
      startDate: startOfMonth.toISOString().split('T')[0],
      endDate: endOfMonth.toISOString().split('T')[0]
    });
  }, []);

  const generateSummary = async () => {
    if (!user || loadingRef.current) return;
    
    // Validate date range
    if (!dateRange.startDate || !dateRange.endDate) {
      setError('Please select a valid date range');
      return;
    }
    
    if (new Date(dateRange.startDate) > new Date(dateRange.endDate)) {
      setError('Start date must be before end date');
      return;
    }
    
    loadingRef.current = true;
    setIsLoading(true);
    setShowSummary(true);
    setError(null);

    try {
      console.log('📊 ExpenseSummary: Generating summary for user:', user.id);
      console.log('📊 ExpenseSummary: Date range:', dateRange);
      
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session) {
        throw new Error('No active session found');
      }

      console.log('📊 ExpenseSummary: Calling monthly-summary function...');
      
      // Use direct fetch for better control
      const functionUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monthly-summary`;
      
      const requestBody = {
        startDate: dateRange.startDate,
        endDate: dateRange.endDate,
        userId: user.id
      };

      console.log('📊 ExpenseSummary: Request body:', requestBody);

      const response = await fetch(functionUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
          'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
        },
        body: JSON.stringify(requestBody),
      });

      console.log('📊 ExpenseSummary: Response status:', response.status);

      if (!response.ok) {
        const errorText = await response.text();
        console.error('📊 ExpenseSummary: Response error:', errorText);
        throw new Error(`Server error: ${response.status}`);
      }

      const result = await response.json();
      console.log('📊 ExpenseSummary: Response data:', result);

      if (!result.success) {
        throw new Error(result.error || 'Failed to generate summary');
      }

      setSummary(result.summary);
      setSummaryData(result.data);
      setLastGenerated(new Date());
      setError(null);

    } catch (error) {
      console.error('📊 ExpenseSummary: Error generating summary:', error);
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

  const getDateRangeLabel = () => {
    if (!dateRange.startDate || !dateRange.endDate) return 'Select Date Range';
    
    const start = new Date(dateRange.startDate);
    const end = new Date(dateRange.endDate);
    
    // Check if it's the same month
    if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
      return start.toLocaleString('default', { month: 'long', year: 'numeric' });
    }
    
    // Different months or years
    return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
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

  const handleDateRangeChange = (field: 'startDate' | 'endDate', value: string) => {
    setDateRange(prev => ({
      ...prev,
      [field]: value
    }));
    
    // Clear previous results when date range changes
    if (showSummary) {
      setSummary('');
      setSummaryData(null);
      setLastGenerated(null);
    }
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
              <h2 className="text-xl font-bold text-slate-800">Expense Summary</h2>
              <p className="text-sm text-slate-600">{getDateRangeLabel()}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={generateSummary}
              disabled={isLoading || !user || !dateRange.startDate || !dateRange.endDate}
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
        
        {/* Date Range Picker */}
        <div className="mt-4 flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-slate-500" />
            <label className="text-sm font-medium text-slate-700">Date Range:</label>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={dateRange.startDate}
              onChange={(e) => handleDateRangeChange('startDate', e.target.value)}
              className="px-3 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <span className="text-slate-500 text-sm">to</span>
            <input
              type="date"
              value={dateRange.endDate}
              onChange={(e) => handleDateRangeChange('endDate', e.target.value)}
              className="px-3 py-1 border border-slate-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>
        
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
                Get Your Financial Analytics Report
              </h3>
              <p className="text-slate-600 mb-6">
                Select a date range and discover insights about your spending patterns, savings progress, and get personalized recommendations from your AI financial coach.
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
                        <p className="text-sm text-green-700">Selected period</p>
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
                        <p className="text-sm text-red-700">Selected period</p>
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