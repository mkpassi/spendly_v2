import React, { useState, useEffect } from 'react';
import { DollarSign, Edit, Trash2, Filter } from 'lucide-react';
import { supabase } from '../lib/supabase';

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
  userId?: string;
  refreshTrigger?: number;
}

export const TransactionList: React.FC<TransactionListProps> = ({ 
  userId = 'anonymous_user',
  refreshTrigger = 0
}) => {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [filteredTransactions, setFilteredTransactions] = useState<Transaction[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filter, setFilter] = useState<'all' | 'income' | 'expense'>('all');
  const [editingTransaction, setEditingTransaction] = useState<Transaction | null>(null);

  useEffect(() => {
    loadTransactions();
  }, [userId, refreshTrigger]);

  useEffect(() => {
    filterTransactions();
  }, [transactions, filter]);

  const loadTransactions = async () => {
    try {
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .order('date', { ascending: false });

      if (error) throw error;

      setTransactions(data || []);
    } catch (error) {
      console.error('Error loading transactions:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const filterTransactions = () => {
    if (filter === 'all') {
      setFilteredTransactions(transactions);
    } else {
      setFilteredTransactions(transactions.filter(t => t.type === filter));
    }
  };

  const handleEdit = (transaction: Transaction) => {
    setEditingTransaction(transaction);
  };

  const handleSaveEdit = async (updatedTransaction: Transaction) => {
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
    }
  };

  const handleDelete = async (id: string) => {
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
    }
  };

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
    }).format(amount);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  if (isLoading) {
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
        {filteredTransactions.length === 0 ? (
          <div className="p-8 text-center text-slate-500">
            <DollarSign className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p>No transactions yet.</p>
            <p className="text-sm">Start by telling me about a transaction!</p>
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
                            <span className="px-2 py-1 bg-slate-100 rounded-full text-xs">
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