import React, { useState } from 'react';
import { BarChart3, Calendar, TrendingUp, Loader2, DollarSign, Target, TrendingDown } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface MonthlySummaryProps {
  userId?: string;
}

interface SummaryData {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  expensesByCategory: Record<string, number>;
  transactionCount: number;
  topCategory: string;
  savingsRate: number;
}

export const MonthlySummary: React.FC<MonthlySummaryProps> = ({ 
  userId = 'anonymous_user' 
}) => {
  const [summary, setSummary] = useState<string>('');
  const [summaryData, setSummaryData] = useState<SummaryData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [showSummary, setShowSummary] = useState(false);

  const generateSummary = async () => {
    setIsLoading(true);
    setShowSummary(true);

    try {
      const currentDate = new Date();
      
      // First, try to get data from the edge function
      try {
        const response = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/monthly-summary`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            userId,
            month: currentDate.getMonth() + 1,
            year: currentDate.getFullYear()
          })
        });

        const result = await response.json();
        
        if (result.success) {
          setSummary(result.summary);
          setSummaryData(result.data);
          return;
        }
      } catch (edgeFunctionError) {
        console.log('Edge function failed, generating local summary:', edgeFunctionError);
      }

      // Fallback: Generate summary locally
      await generateLocalSummary();
      
    } catch (error) {
      console.error('Error generating monthly summary:', error);
      setSummary("I'm having trouble generating your monthly summary. Please try again!");
      setSummaryData(null);
    } finally {
      setIsLoading(false);
    }
  };

  const generateLocalSummary = async () => {
    try {
      const currentDate = new Date();
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth() + 1;
      
      const startDate = `${year}-${month.toString().padStart(2, '0')}-01`;
      const endDate = `${year}-${month.toString().padStart(2, '0')}-31`;

      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', startDate)
        .lte('date', endDate)
        .order('date', { ascending: false });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        setSummary("No transactions found for this month. Start tracking your expenses to get personalized insights!");
        setSummaryData(null);
        return;
      }

      // Calculate totals
      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

      const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

      const netSavings = totalIncome - totalExpenses;
      const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

      // Group expenses by category
      const expensesByCategory = transactions
        .filter(t => t.type === 'expense')
        .reduce((acc, t) => {
          acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount.toString());
          return acc;
        }, {} as Record<string, number>);

      const topCategory = Object.entries(expensesByCategory)
        .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

      const data: SummaryData = {
        totalIncome,
        totalExpenses,
        netSavings,
        expensesByCategory,
        transactionCount: transactions.length,
        topCategory,
        savingsRate
      };

      setSummaryData(data);

      // Generate a friendly summary
      const monthName = new Date(year, month - 1).toLocaleString('default', { month: 'long' });
      let summaryText = `🎉 Here's your ${monthName} financial summary!\n\n`;
      
      summaryText += `💰 Income: $${totalIncome.toLocaleString()}\n`;
      summaryText += `💸 Expenses: $${totalExpenses.toLocaleString()}\n`;
      summaryText += `📈 Net Savings: $${netSavings.toLocaleString()}\n`;
      summaryText += `📊 Savings Rate: ${savingsRate.toFixed(1)}%\n\n`;
      
      if (netSavings > 0) {
        summaryText += `🌟 Great job! You saved money this month. `;
        if (savingsRate >= 20) {
          summaryText += `Your ${savingsRate.toFixed(1)}% savings rate is excellent!`;
        } else if (savingsRate >= 10) {
          summaryText += `Your ${savingsRate.toFixed(1)}% savings rate is solid!`;
        } else {
          summaryText += `Try to increase your savings rate next month.`;
        }
      } else {
        summaryText += `💡 You spent more than you earned this month. Let's work on reducing expenses!`;
      }
      
      if (topCategory && expensesByCategory[topCategory] > 0) {
        summaryText += `\n\n🏆 Top spending category: ${topCategory} ($${expensesByCategory[topCategory].toLocaleString()})`;
        
        if (topCategory === 'Dining') {
          summaryText += `\n💡 Tip: Try meal prepping to reduce dining expenses!`;
        } else if (topCategory === 'Shopping') {
          summaryText += `\n💡 Tip: Consider a 24-hour rule before non-essential purchases!`;
        } else if (topCategory === 'Entertainment') {
          summaryText += `\n💡 Tip: Look for free or low-cost entertainment options!`;
        }
      }

      setSummary(summaryText);
    } catch (error) {
      console.error('Error generating local summary:', error);
      setSummary("Unable to generate summary. Please ensure you have transaction data.");
      setSummaryData(null);
    }
  };

  const formatMessage = (message: string) => {
    return message.split('\n').map((line, index) => (
      <React.Fragment key={index}>
        {line}
        {index < message.split('\n').length - 1 && <br />}
      </React.Fragment>
    ));
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">Monthly Summary</h2>
          </div>
          <button
            onClick={generateSummary}
            disabled={isLoading}
            className="flex items-center gap-2 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isLoading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <TrendingUp className="h-4 w-4" />
            )}
            <span className="text-sm">Generate Summary</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {!showSummary ? (
          <div className="text-center py-8 text-slate-500">
            <Calendar className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-medium mb-2">Get your personalized monthly financial summary</p>
            <p className="text-sm">Click the button above to analyze your spending patterns and savings potential</p>
          </div>
        ) : (
          <div className="space-y-6">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <div className="text-center">
                  <Loader2 className="h-8 w-8 animate-spin text-blue-500 mx-auto mb-4" />
                  <p className="text-slate-600">Analyzing your financial data...</p>
                  <p className="text-sm text-slate-500">This might take a moment</p>
                </div>
              </div>
            ) : (
              <>
                {/* Summary Stats */}
                {summaryData && (
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                    <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <h3 className="font-semibold text-green-900">Income</h3>
                      </div>
                      <p className="text-2xl font-bold text-green-800">
                        {formatCurrency(summaryData.totalIncome)}
                      </p>
                    </div>

                    <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                      <div className="flex items-center gap-2 mb-2">
                        <TrendingDown className="h-5 w-5 text-red-600" />
                        <h3 className="font-semibold text-red-900">Expenses</h3>
                      </div>
                      <p className="text-2xl font-bold text-red-800">
                        {formatCurrency(summaryData.totalExpenses)}
                      </p>
                    </div>

                    <div className={`${summaryData.netSavings >= 0 ? 'bg-blue-50 border-blue-200' : 'bg-orange-50 border-orange-200'} border rounded-lg p-4`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Target className="h-5 w-5 text-blue-600" />
                        <h3 className={`font-semibold ${summaryData.netSavings >= 0 ? 'text-blue-900' : 'text-orange-900'}`}>
                          Net {summaryData.netSavings >= 0 ? 'Savings' : 'Deficit'}
                        </h3>
                      </div>
                      <p className={`text-2xl font-bold ${summaryData.netSavings >= 0 ? 'text-blue-800' : 'text-orange-800'}`}>
                        {formatCurrency(Math.abs(summaryData.netSavings))}
                      </p>
                      <p className="text-sm text-slate-600 mt-1">
                        {summaryData.savingsRate.toFixed(1)}% savings rate
                      </p>
                    </div>
                  </div>
                )}

                {/* AI Summary */}
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-6">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                      <BarChart3 className="h-4 w-4 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-blue-900 mb-2">
                        Your Monthly Financial Health Report
                      </h3>
                      <div className="text-blue-800 leading-relaxed">
                        {formatMessage(summary)}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Category Breakdown */}
                {summaryData && Object.keys(summaryData.expensesByCategory).length > 0 && (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-4">
                    <h3 className="font-semibold text-slate-800 mb-3">Expense Breakdown by Category</h3>
                    <div className="space-y-2">
                      {Object.entries(summaryData.expensesByCategory)
                        .sort(([,a], [,b]) => b - a)
                        .slice(0, 5)
                        .map(([category, amount]) => {
                          const percentage = summaryData.totalExpenses > 0 
                            ? (amount / summaryData.totalExpenses) * 100 
                            : 0;
                          return (
                            <div key={category} className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <div className="w-3 h-3 bg-blue-500 rounded-full"></div>
                                <span className="text-sm font-medium text-slate-700">{category}</span>
                              </div>
                              <div className="text-right">
                                <span className="text-sm font-semibold text-slate-800">
                                  {formatCurrency(amount)}
                                </span>
                                <span className="text-xs text-slate-500 ml-2">
                                  ({percentage.toFixed(1)}%)
                                </span>
                              </div>
                            </div>
                          );
                        })}
                    </div>
                  </div>
                )}
              </>
            )}
            
            {!isLoading && summary && (
              <div className="text-center">
                <button
                  onClick={generateSummary}
                  className="text-blue-500 hover:text-blue-600 text-sm transition-colors"
                >
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