import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { DollarSign, Edit, Trash2, Filter, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';

interface Transaction {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  source: string;
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
  const loadingRef = useRef(false);

  // Memoize user ID to prevent unnecessary re-renders
  const userId = useMemo(() => user?.id, [user?.id]);

  const loadTransactions = useCallback(async () => {
    if (!userId) {
      return;
    }

    if (loadingRef.current) {
      return;
    }
    
    loadingRef.current = true;
    setIsLoading(true);
    setHasConnectionError(false);
    
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;
      
      setTransactions(data || []);
      setHasConnectionError(false);
    } catch (error) {
      console.error('Error loading transactions:', error);
      setHasConnectionError(true);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  }, [userId]);

  useEffect(() => {
    if (userId && !loadingRef.current) {
      loadTransactions();
    } else if (!authLoading) {
      setIsLoading(false);
      setTransactions([]);
      setHasConnectionError(false);
    }
  }, [userId, authLoading, refreshTrigger, loadTransactions]);

  const filterTransactions = useCallback(() => {
    if (filter === 'all') {
      setFilteredTransactions(transactions);
    } else {
      setFilteredTransactions(transactions.filter(t => t.type === filter));
    }
  }, [filter, transactions]);

  useEffect(() => {
    filterTransactions();
  }, [filterTransactions]);

  const handleEdit = useCallback((transaction: Transaction) => {
    setEditingTransaction(transaction);
  }, []);

  const handleSaveEdit = useCallback(async (updatedTransaction: Transaction) => {
    try {
      const { error } = await supabase
        .from('transactions')
        .update({
          date: updatedTransaction.date,
          description: updatedTransaction.description,
          amount: updatedTransaction.amount,
          category: updatedTransaction.category,
          type: updatedTransaction.type,
          updated_at: new Date().toISOString()
        })
        .eq('id', updatedTransaction.id);

      if (error) throw error;
      
      setTransactions(prev => prev.map(t => 
        t.id === updatedTransaction.id ? updatedTransaction : t
      ));
      setEditingTransaction(null);
    } catch (error) {
      console.error('Error updating transaction:', error);
      alert('Failed to update transaction. Please try again.');
    }
  }, []);

  const handleDelete = useCallback(async (id: string) => {
    if (!confirm('Are you sure you want to delete this transaction?')) return;

    try {
      const { error } = await supabase
        .from('transactions')
        .delete()
        .eq('id', id);

      if (error) throw error;
      
      setTransactions(prev => prev.filter(t => t.id !== id));
    } catch (error) {
      console.error('Error deleting transaction:', error);
      alert('Failed to delete transaction. Please try again.');
    }
  }, []);

  const formatCurrency = useCallback((amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  }, []);

  const formatDate = useCallback((dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  }, []);

  if (isLoading || authLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-16 bg-slate-200 rounded"></div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">Recent Transactions</h2>
          </div>
          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-slate-600" />
            <select
              value={filter}
              onChange={(e) => setFilter(e.target.value as 'all' | 'income' | 'expense')}
              className="text-sm border border-slate-300 rounded px-2 py-1"
            >
              <option value="all">All</option>
              <option value="income">Income</option>
              <option value="expense">Expenses</option>
            </select>
          </div>
        </div>
      </div>

      {/* Transactions */}
      <div className="max-h-96 overflow-y-auto">
        {!user ? (
          <div className="p-8 text-center text-slate-500">
            <UserX className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="font-semibold">Please log in</p>
            <p className="text-sm">Sign in to view your transactions.</p>
          </div>
        ) : hasConnectionError ? (
          <div className="p-8 text-center text-red-500">
            <div className="h-12 w-12 mx-auto mb-4 text-red-300 border-2 border-red-300 rounded-full flex items-center justify-center">
              <span className="text-lg">⚠️</span>
            </div>
            <p className="font-semibold">Connection Error</p>
            <p className="text-sm text-slate-600">Unable to load transactions. Please check your connection.</p>
            <button 
              onClick={() => loadTransactions()} 
              className="mt-3 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
            >
              Try Again
            </button>
          </div>
        ) : filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p>No transactions yet.</p>
            <p className="text-sm">Add a transaction via the chat to get started!</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-200">
            {filteredTransactions.map((transaction) => (
              <div key={transaction.id} className="p-4 hover:bg-slate-50 transition-colors">
                {editingTransaction?.id === transaction.id ? (
                  <EditTransactionForm
                    transaction={editingTransaction}
                    onSave={handleSaveEdit}
                    onCancel={() => setEditingTransaction(null)}
                  />
                ) : (
                  <div className="flex items-center justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <div className="flex-1">
                          <p className="font-medium text-slate-800">{transaction.description}</p>
                          <div className="flex items-center gap-4 text-sm text-slate-600">
                            <span>{formatDate(transaction.date)}</span>
                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs font-medium">
                              {transaction.category}
                            </span>
                          </div>
                        </div>
                        <div className="text-right">
                          <p className={`font-semibold ${
                            transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                          }`}>
                            {transaction.type === 'income' ? '+' : '-'}{formatCurrency(transaction.amount)}
                          </p>
                          <p className="text-xs text-slate-500 capitalize">{transaction.source}</p>
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 ml-4">
                      <button
                        onClick={() => handleEdit(transaction)}
                        className="p-2 text-slate-400 hover:text-blue-500 transition-colors"
                      >
                        <Edit className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(transaction.id)}
                        className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

interface EditTransactionFormProps {
  transaction: Transaction;
  onSave: (transaction: Transaction) => void;
  onCancel: () => void;
}

const EditTransactionForm: React.FC<EditTransactionFormProps> = ({ 
  transaction, 
  onSave, 
  onCancel 
}) => {
  const [formData, setFormData] = useState(transaction);

  const categories = [
    'Groceries', 'Dining', 'Transportation', 'Utilities', 'Rent', 
    'Shopping', 'Entertainment', 'Health', 'Education', 'Salary', 'Other'
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(formData);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      <div className="grid grid-cols-2 gap-3">
        <input
          type="date"
          value={formData.date}
          onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
          className="px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
        <input
          type="number"
          step="0.01"
          value={formData.amount}
          onChange={(e) => setFormData(prev => ({ ...prev, amount: parseFloat(e.target.value) }))}
          className="px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      </div>
      
      <input
        type="text"
        value={formData.description}
        onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
        className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        placeholder="Description"
      />
      
      <div className="grid grid-cols-2 gap-3">
        <select
          value={formData.category}
          onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
          className="px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          {categories.map(cat => (
            <option key={cat} value={cat}>{cat}</option>
          ))}
        </select>
        
        <select
          value={formData.type}
          onChange={(e) => setFormData(prev => ({ ...prev, type: e.target.value as 'income' | 'expense' }))}
          className="px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>
      </div>
      
      <div className="flex gap-2">
        <button
          type="submit"
          className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
        >
          Save
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 bg-slate-300 text-slate-700 rounded hover:bg-slate-400 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  );
};

export const TransactionList = React.memo(TransactionListComponent, (prevProps, nextProps) => {
  // Only re-render if refreshTrigger actually changes
  const shouldNotRerender = prevProps.refreshTrigger === nextProps.refreshTrigger;
  
  return shouldNotRerender;
});