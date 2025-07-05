import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DollarSign, Edit, Trash2, Filter, UserX, AlertCircle, Plus, Save, X, Calendar, Tag, TrendingUp, TrendingDown, Target } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  budget_category?: 'expenses' | 'savings' | 'goals';
  is_allocated?: boolean;
  source?: string;
  created_at?: string;
  updated_at?: string;
  user_id: string;
}

interface TransactionListProps {
  refreshTrigger?: number;
}

const TransactionListComponent: React.FC<TransactionListProps> = ({ 
  refreshTrigger = 0
}) => {
  const { user, loading: authLoading } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const loadingRef = useRef(false);
  const realtimeChannelRef = useRef<any>(null);

  // Memoize user ID to prevent unnecessary re-renders
  const userId = useMemo(() => user?.id, [user?.id]);

  const loadTransactions = useCallback(async () => {
    if (!userId) {
      console.log('💰 TransactionList: No user ID, skipping load');
      return;
    }

    if (loadingRef.current) {
      console.log('💰 TransactionList: Already loading, skipping');
      return;
    }
    
    loadingRef.current = true;
    setIsLoading(true);
    setHasConnectionError(false);
    
    try {
      console.log('💰 TransactionList: Loading transactions for user:', userId);
      
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      
      console.log('💰 TransactionList: Loaded', data?.length || 0, 'transactions');
      setTransactions(data || []);
      setHasConnectionError(false);
    } catch (error) {
      console.error('💰 TransactionList: Error loading transactions:', error);
      setHasConnectionError(true);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [userId]);

  // Set up real-time subscription for transactions
  const setupRealtimeSubscription = useCallback(() => {
    if (!userId) return;
    
    console.log('💰 TransactionList: Setting up real-time subscription for user:', userId);
    
    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      console.log('💰 TransactionList: Cleaning up existing subscription');
      supabase.removeChannel(realtimeChannelRef.current);
    }

    // Create new subscription
    const channel = supabase
      .channel(`transactions:user_id=eq.${userId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          console.log('💰 TransactionList: Real-time update received:', payload);
          
          // Show notification for real-time updates
          setShowUpdateNotification(true);
          setTimeout(() => setShowUpdateNotification(false), 3000);
          
          // Reload transactions when changes occur
          loadTransactions();
        }
      )
      .subscribe((status) => {
        console.log('💰 TransactionList: Real-time subscription status:', status);
      });

    realtimeChannelRef.current = channel;
  }, [userId, loadTransactions]);

  useEffect(() => {
    if (userId && !loadingRef.current) {
      loadTransactions();
      setupRealtimeSubscription();
    } else if (!authLoading) {
      setIsLoading(false);
      setTransactions([]);
      setHasConnectionError(false);
    }

    // Cleanup subscription on component unmount or user change
    return () => {
      if (realtimeChannelRef.current) {
        console.log('💰 TransactionList: Cleaning up real-time subscription');
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [userId, authLoading, refreshTrigger, loadTransactions, setupRealtimeSubscription]);

  const filterTransactions = useCallback(() => {
    let filtered = transactions;
    
    // Apply type filter
    if (filter !== 'all') {
      filtered = filtered.filter(t => t.type === filter);
    }
    
    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(t => 
        t.description.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.category.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (t.source && t.source.toLowerCase().includes(searchTerm.toLowerCase()))
      );
    }
    
    setFilteredTransactions(filtered);
  }, [filter, transactions, searchTerm]);

  useEffect(() => {
    filterTransactions();
  }, [filterTransactions]);

  const handleEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
  }, []);

  const handleSaveEdit = useCallback(async (updatedTransaction: Transaction) => {
    try {
      console.log('💰 TransactionList: Updating transaction:', updatedTransaction.id);
      
      const { error } = await supabase
        .from('transactions')
        .update({
          date: updatedTransaction.date,
          description: updatedTransaction.description,
          amount: updatedTransaction.amount,
          category: updatedTransaction.category,
          type: updatedTransaction.type,
          source: updatedTransaction.source,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedTransaction.id);

      if (error) throw error;
      
      setTransactions(prev => prev.map(t => 
        t.id === updatedTransaction.id ? { ...t, ...updatedTransaction } : t
      ));
      setEditingTransaction(null);
      console.log('💰 TransactionList: Transaction updated successfully');
    } catch (error) {
      console.error('💰 TransactionList: Error updating transaction:', error);
      alert('Failed to update transaction. Please try again.');
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction? This action cannot be undone.')) return;

    try {
      console.log('💰 TransactionList: Deleting transaction:', id);
      
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setTransactions(prev => prev.filter(t => t.id !== id));
      console.log('💰 TransactionList: Transaction deleted successfully');
    } catch (error) {
      console.error('💰 TransactionList: Error deleting transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    }
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(Math.abs(amount));
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  }, []);

  const formatTimestamp = useCallback((timestamp: string) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now.getTime() - date.getTime()) / (1000 * 60 * 60);
    
    if (diffInHours < 24) {
      return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else {
      return date.toLocaleDateString([], { month: 'short', day: 'numeric' }) + 
             ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    }
  }, []);

  const getTransactionStats = useMemo(() => {
    const currentMonth = new Date();
    const startOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    const endOfMonth = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    
    // Filter transactions for current month
    const monthlyTransactions = filteredTransactions.filter(t => {
      const transactionDate = new Date(t.date);
      return transactionDate >= startOfMonth && transactionDate <= endOfMonth;
    });
    
    const income = monthlyTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const expenses = monthlyTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const budgetExpenses = monthlyTransactions
      .filter(t => t.type === 'expense' && t.budget_category === 'expenses')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const savings = monthlyTransactions
      .filter(t => t.type === 'expense' && t.budget_category === 'savings')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    const goalAllocations = monthlyTransactions
      .filter(t => t.type === 'expense' && t.budget_category === 'goals')
      .reduce((sum, t) => sum + Math.abs(t.amount), 0);
    
    // Calculate budget allocations (assuming 50/30/20 default)
    const expectedExpenses = income * 0.5;
    const expectedSavings = income * 0.3;
    const expectedGoals = income * 0.2;
    
    return {
      income,
      expenses,
      budgetExpenses,
      savings,
      goalAllocations,
      net: income - expenses,
      count: filteredTransactions.length,
      // Budget warnings
      expensesOverBudget: budgetExpenses > expectedExpenses,
      savingsUnderBudget: savings < expectedSavings,
      goalsUnderBudget: goalAllocations < expectedGoals,
      expectedExpenses,
      expectedSavings,
      expectedGoals
    };
  }, [filteredTransactions]);

  if (isLoading || authLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-6 bg-slate-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-3 gap-4 mb-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-slate-200 rounded"></div>
            ))}
          </div>
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map(i => (
              <div key={i} className="h-20 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden relative">
      {/* Real-time Update Notification */}
      {showUpdateNotification && (
        <div className="absolute top-2 right-2 bg-green-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg z-10 animate-pulse">
          🔄 Data updated!
        </div>
      )}
      
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">Transactions</h2>
          </div>
          <div className="text-sm text-slate-500">
            {getTransactionStats.count} transactions
          </div>
        </div>

        {/* Budget Warning Banner */}
        {transactions.length > 0 && getTransactionStats.income > 0 && 
         (getTransactionStats.expensesOverBudget || getTransactionStats.savingsUnderBudget || getTransactionStats.goalsUnderBudget) && (
          <div className="mb-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex items-center gap-2 mb-2">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <h3 className="font-medium text-yellow-800">Budget Alert</h3>
            </div>
            <div className="text-sm text-yellow-700">
              {getTransactionStats.expensesOverBudget && (
                <div>• Expenses are over budget by {formatCurrency(getTransactionStats.budgetExpenses - getTransactionStats.expectedExpenses)}</div>
              )}
              {getTransactionStats.savingsUnderBudget && (
                <div>• Savings are {formatCurrency(getTransactionStats.expectedSavings - getTransactionStats.savings)} short of target</div>
              )}
              {getTransactionStats.goalsUnderBudget && (
                <div>• Goal allocations are {formatCurrency(getTransactionStats.expectedGoals - getTransactionStats.goalAllocations)} short of target</div>
              )}
            </div>
          </div>
        )}

        {/* Stats Cards */}
        {transactions.length > 0 && (
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-4">
            <div className="bg-green-50 border border-green-200 rounded-lg p-3">
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-green-600" />
                <span className="text-xs font-medium text-green-800">Income</span>
              </div>
              <div className="text-lg font-semibold text-green-900">
                {formatCurrency(getTransactionStats.income)}
              </div>
            </div>
            
            <div className={`border rounded-lg p-3 ${
              getTransactionStats.expensesOverBudget 
                ? 'bg-red-100 border-red-300' 
                : 'bg-red-50 border-red-200'
            }`}>
              <div className="flex items-center gap-2">
                <TrendingDown className="h-4 w-4 text-red-600" />
                <span className="text-xs font-medium text-red-800">Expenses</span>
                {getTransactionStats.expensesOverBudget && (
                  <AlertCircle className="h-3 w-3 text-red-600" />
                )}
              </div>
              <div className="text-lg font-semibold text-red-900">
                {formatCurrency(getTransactionStats.budgetExpenses)}
              </div>
              {getTransactionStats.income > 0 && (
                <div className="text-xs text-red-600 mt-1">
                  {getTransactionStats.expensesOverBudget ? 'Over' : 'of'} {formatCurrency(getTransactionStats.expectedExpenses)} budgeted
                </div>
              )}
            </div>
            
            <div className={`border rounded-lg p-3 ${
              getTransactionStats.savingsUnderBudget 
                ? 'bg-yellow-100 border-yellow-300' 
                : 'bg-blue-50 border-blue-200'
            }`}>
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-blue-800">Savings</span>
                {getTransactionStats.savingsUnderBudget && (
                  <AlertCircle className="h-3 w-3 text-yellow-600" />
                )}
              </div>
              <div className="text-lg font-semibold text-blue-900">
                {formatCurrency(getTransactionStats.savings)}
              </div>
              {getTransactionStats.income > 0 && (
                <div className="text-xs text-blue-600 mt-1">
                  {getTransactionStats.savingsUnderBudget ? 'Under' : 'of'} {formatCurrency(getTransactionStats.expectedSavings)} target
                </div>
              )}
            </div>
            
            <div className={`border rounded-lg p-3 ${
              getTransactionStats.goalsUnderBudget 
                ? 'bg-orange-100 border-orange-300' 
                : 'bg-purple-50 border-purple-200'
            }`}>
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-purple-600" />
                <span className="text-xs font-medium text-purple-800">Goals</span>
                {getTransactionStats.goalsUnderBudget && (
                  <AlertCircle className="h-3 w-3 text-orange-600" />
                )}
              </div>
              <div className="text-lg font-semibold text-purple-900">
                {formatCurrency(getTransactionStats.goalAllocations)}
              </div>
              {getTransactionStats.income > 0 && (
                <div className="text-xs text-purple-600 mt-1">
                  {getTransactionStats.goalsUnderBudget ? 'Under' : 'of'} {formatCurrency(getTransactionStats.expectedGoals)} target
                </div>
              )}
            </div>
            
            <div className={`border rounded-lg p-3 ${
              getTransactionStats.net >= 0 
                ? 'bg-emerald-50 border-emerald-200' 
                : 'bg-orange-50 border-orange-200'
            }`}>
              <div className="flex items-center gap-2">
                <DollarSign className={`h-4 w-4 ${
                  getTransactionStats.net >= 0 ? 'text-emerald-600' : 'text-orange-600'
                }`} />
                <span className={`text-xs font-medium ${
                  getTransactionStats.net >= 0 ? 'text-emerald-800' : 'text-orange-800'
                }`}>Net</span>
              </div>
              <div className={`text-lg font-semibold ${
                getTransactionStats.net >= 0 ? 'text-emerald-900' : 'text-orange-900'
              }`}>
                {getTransactionStats.net >= 0 ? '+' : ''}{formatCurrency(getTransactionStats.net)}
              </div>
            </div>
          </div>
        )}

        {/* Filters */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-600" />
            <div className="flex bg-white border border-slate-300 rounded-lg overflow-hidden">
              <button
                onClick={() => setFilter('all')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  filter === 'all'
                    ? 'bg-blue-500 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilter('income')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  filter === 'income'
                    ? 'bg-green-500 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Income
              </button>
              <button
                onClick={() => setFilter('expense')}
                className={`px-3 py-1 text-sm font-medium transition-colors ${
                  filter === 'expense'
                    ? 'bg-red-500 text-white'
                    : 'text-slate-600 hover:bg-slate-50'
                }`}
              >
                Expenses
              </button>
            </div>
          </div>

          <div className="flex-1">
            <input
              type="text"
              placeholder="Search transactions..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full px-3 py-1 text-sm border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Transactions List */}
      <div className="max-h-96 overflow-y-auto">
        {!user ? (
          <div className="p-8 text-center text-slate-500">
            <UserX className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="font-semibold">Please log in</p>
            <p className="text-sm">Sign in to view your transactions.</p>
          </div>
        ) : hasConnectionError ? (
          <div className="p-8 text-center text-red-500">
            <AlertCircle className="h-12 w-12 mx-auto mb-4 text-red-300" />
            <p className="font-semibold">Connection Error</p>
            <p className="text-sm">Unable to load transactions. Please try again.</p>
            <button
              onClick={loadTransactions}
              className="mt-4 px-4 py-2 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors"
            >
              Retry
            </button>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            {transactions.length === 0 ? (
              <>
                <p className="font-semibold">No transactions yet</p>
                <p className="text-sm">Start by chatting with Spendly to track your expenses!</p>
              </>
            ) : (
              <>
                <p className="font-semibold">No matching transactions</p>
                <p className="text-sm">Try adjusting your filters or search terms.</p>
              </>
            )}
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredTransactions.map((transaction) => (
              <TransactionRow
                key={transaction.id}
                transaction={transaction}
                onEdit={handleEdit}
                onDelete={handleDelete}
                formatCurrency={formatCurrency}
                formatDate={formatDate}
                formatTimestamp={formatTimestamp}
              />
            ))}
          </div>
        )}
      </div>

      {/* Edit Transaction Modal */}
      {editingTransaction && (
        <EditTransactionModal
          transaction={editingTransaction}
          onSave={handleSaveEdit}
          onCancel={() => setEditingTransaction(null)}
        />
      )}
    </div>
  );
};

// Transaction Row Component
interface TransactionRowProps {
  transaction: Transaction;
  onEdit: (transaction: Transaction) => void;
  onDelete: (id: string) => void;
  formatCurrency: (amount: number) => string;
  formatDate: (date: string) => string;
  formatTimestamp: (timestamp: string) => string;
}

const TransactionRow: React.FC<TransactionRowProps> = React.memo(({ 
  transaction, 
  onEdit, 
  onDelete, 
  formatCurrency, 
  formatDate,
  formatTimestamp 
}) => {
  const isIncome = transaction.type === 'income';
  
  return (
    <div className="p-4 hover:bg-slate-50 transition-colors">
      <div className="flex items-center justify-between">
        <div className="flex-1">
          <div className="flex items-center gap-3">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
              isIncome ? 'bg-green-100' : 'bg-red-100'
            }`}>
              {isIncome ? (
                <TrendingUp className="h-5 w-5 text-green-600" />
              ) : (
                <TrendingDown className="h-5 w-5 text-red-600" />
              )}
            </div>
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-medium text-slate-900 truncate">
                  {transaction.description}
                </h3>
                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-slate-100 text-slate-700">
                  {transaction.category}
                </span>
                {transaction.budget_category && (
                  <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${
                    transaction.budget_category === 'expenses' 
                      ? 'bg-red-100 text-red-700'
                      : transaction.budget_category === 'savings'
                      ? 'bg-blue-100 text-blue-700'
                      : 'bg-green-100 text-green-700'
                  }`}>
                    {transaction.budget_category}
                  </span>
                )}
                {transaction.source === 'auto_allocated' && (
                  <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-purple-100 text-purple-700">
                    Auto-allocated
                  </span>
                )}
              </div>
              
              <div className="flex items-center gap-4 mt-1 text-sm text-slate-500">
                <span className="flex items-center gap-1">
                  <Calendar className="h-3 w-3" />
                  {formatDate(transaction.date)}
                </span>
                {transaction.created_at && (
                  <span className="flex items-center gap-1 text-xs text-slate-400">
                    Added {formatTimestamp(transaction.created_at)}
                  </span>
                )}
                {transaction.source && (
                  <span className="flex items-center gap-1">
                    <Tag className="h-3 w-3" />
                    {transaction.source}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>
        
        <div className="flex items-center gap-3">
          <div className={`text-lg font-semibold ${
            isIncome ? 'text-green-600' : 'text-red-600'
          }`}>
            {isIncome ? '+' : '-'}{formatCurrency(transaction.amount)}
          </div>
          
          <div className="flex items-center gap-1">
            <button
              onClick={() => onEdit(transaction)}
              className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Edit transaction"
            >
              <Edit className="h-4 w-4" />
            </button>
            <button
              onClick={() => onDelete(transaction.id)}
              className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Delete transaction"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
});

// Edit Transaction Modal Component
interface EditTransactionModalProps {
  transaction: Transaction;
  onSave: (transaction: Transaction) => void;
  onCancel: () => void;
}

const EditTransactionModal: React.FC<EditTransactionModalProps> = ({ 
  transaction, 
  onSave, 
  onCancel 
}) => {
  const [formData, setFormData] = useState({
    description: transaction.description,
    amount: Math.abs(transaction.amount).toString(),
    category: transaction.category,
    type: transaction.type,
    date: transaction.date,
    source: transaction.source || ''
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const updatedTransaction: Transaction = {
      ...transaction,
      description: formData.description.trim(),
      amount: parseFloat(formData.amount),
      category: formData.category.trim(),
      type: formData.type as 'income' | 'expense',
      date: formData.date,
      source: formData.source.trim()
    };

    onSave(updatedTransaction);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-y-auto">
        <div className="p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-slate-800">Edit Transaction</h3>
            <button
              onClick={onCancel}
              className="text-slate-400 hover:text-slate-600"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Description
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Type
                </label>
                                 <select
                   value={formData.type}
                   onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'income' | 'expense' }))}
                   className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                 >
                  <option value="expense">Expense</option>
                  <option value="income">Income</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Category
                </label>
                <input
                  type="text"
                  value={formData.category}
                  onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Date
                </label>
                <input
                  type="date"
                  value={formData.date}
                  onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Source (optional)
              </label>
              <input
                type="text"
                value={formData.source}
                onChange={(e) => setFormData(prev => ({ ...prev, source: e.target.value }))}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="e.g., Bank transfer, Cash, Credit card"
              />
            </div>

            <div className="flex gap-3 pt-4">
              <button
                type="submit"
                className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center gap-2"
              >
                <Save className="h-4 w-4" />
                Save Changes
              </button>
              <button
                type="button"
                onClick={onCancel}
                className="flex-1 bg-slate-500 text-white py-2 px-4 rounded-lg hover:bg-slate-600 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

// Memoize the entire component for performance
export const TransactionList = React.memo(TransactionListComponent);