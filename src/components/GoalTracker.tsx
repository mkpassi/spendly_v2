import React, { useState, useEffect } from 'react';
import { Target, TrendingUp, Plus, X } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface Goal {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  target_date: string | null;
  status: string;
  created_at: string;
}

interface GoalTrackerProps {
  userId?: string;
}

export const GoalTracker: React.FC<GoalTrackerProps> = ({ 
  userId = 'anonymous_user' 
}) => {
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    target_amount: '',
    target_date: ''
  });

  useEffect(() => {
    loadGoals();
  }, [userId]);

  const loadGoals = async () => {
    try {
      const { data, error } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', userId)
        .eq('status', 'active')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Calculate current progress for each goal
      const goalsWithProgress = await Promise.all(
        (data || []).map(async (goal) => {
          const progress = await calculateGoalProgress(goal.id, goal.created_at);
          return {
            ...goal,
            current_amount: progress
          };
        })
      );

      setGoals(goalsWithProgress);
    } catch (error) {
      console.error('Error loading goals:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const calculateGoalProgress = async (goalId: string, goalCreatedAt: string) => {
    try {
      // Get transactions since goal was created
      const { data: transactions, error } = await supabase
        .from('transactions')
        .select('amount, type')
        .eq('user_id', userId)
        .gte('created_at', goalCreatedAt);

      if (error) throw error;

      if (!transactions) return 0;

      // Calculate net savings since goal creation
      const totalIncome = transactions
        .filter(t => t.type === 'income')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

      const totalExpenses = transactions
        .filter(t => t.type === 'expense')
        .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

      return Math.max(0, totalIncome - totalExpenses);
    } catch (error) {
      console.error('Error calculating goal progress:', error);
      return 0;
    }
  };

  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newGoal.title || !newGoal.target_amount) return;

    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          user_id: userId,
          title: newGoal.title,
          target_amount: parseFloat(newGoal.target_amount),
          target_date: newGoal.target_date || null,
          status: 'active'
        })
        .select()
        .single();

      if (error) throw error;

      setGoals(prev => [{ ...data, current_amount: 0 }, ...prev]);
      setNewGoal({ title: '', target_amount: '', target_date: '' });
      setShowAddGoal(false);
    } catch (error) {
      console.error('Error adding goal:', error);
    }
  };

  const handleCompleteGoal = async (goalId: string) => {
    try {
      const { error } = await supabase
        .from('goals')
        .update({ status: 'completed' })
        .eq('id', goalId);

      if (error) throw error;

      setGoals(prev => prev.filter(g => g.id !== goalId));
    } catch (error) {
      console.error('Error completing goal:', error);
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

  const getProgressPercentage = (current: number, target: number) => {
    return Math.min(100, Math.max(0, (current / target) * 100));
  };

  if (isLoading) {
    return (
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="animate-pulse">
          <div className="h-4 bg-slate-200 rounded w-1/3 mb-4"></div>
          <div className="h-16 bg-slate-200 rounded"></div>
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
            <Target className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">Savings Goals</h2>
          </div>
          <button
            onClick={() => setShowAddGoal(true)}
            className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="text-sm">Add Goal</span>
          </button>
        </div>
      </div>

      {/* Add Goal Form */}
      {showAddGoal && (
        <div className="p-6 bg-green-50 border-b border-green-200">
          <form onSubmit={handleAddGoal} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">
                Goal Title
              </label>
              <input
                type="text"
                value={newGoal.title}
                onChange={(e) => setNewGoal(prev => ({ ...prev, title: e.target.value }))}
                placeholder="e.g., Emergency Fund, New Phone, Vacation"
                className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                required
              />
            </div>
            
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Target Amount
                </label>
                <input
                  type="number"
                  step="0.01"
                  value={newGoal.target_amount}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, target_amount: e.target.value }))}
                  placeholder="1000"
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">
                  Target Date (Optional)
                </label>
                <input
                  type="date"
                  value={newGoal.target_date}
                  onChange={(e) => setNewGoal(prev => ({ ...prev, target_date: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded focus:outline-none focus:ring-2 focus:ring-green-500"
                />
              </div>
            </div>
            
            <div className="flex gap-2">
              <button
                type="submit"
                className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600 transition-colors"
              >
                Add Goal
              </button>
              <button
                type="button"
                onClick={() => setShowAddGoal(false)}
                className="px-4 py-2 bg-slate-300 text-slate-700 rounded hover:bg-slate-400 transition-colors"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Goals List */}
      <div className="p-6">
        {goals.length === 0 ? (
          <div className="text-center py-8 text-slate-500">
            <Target className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p>No savings goals yet.</p>
            <p className="text-sm">Add your first goal to start tracking progress!</p>
          </div>
        ) : (
          <div className="space-y-4">
            {goals.map((goal) => {
              const progressPercentage = getProgressPercentage(goal.current_amount, goal.target_amount);
              const isComplete = progressPercentage >= 100;
              
              return (
                <div key={goal.id} className="border border-slate-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="font-semibold text-slate-800">{goal.title}</h3>
                    {isComplete && (
                      <button
                        onClick={() => handleCompleteGoal(goal.id)}
                        className="text-green-600 hover:text-green-700 transition-colors"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm text-slate-600">
                      {formatCurrency(goal.current_amount)} of {formatCurrency(goal.target_amount)}
                    </span>
                    <span className="text-sm font-medium text-slate-700">
                      {progressPercentage.toFixed(0)}%
                    </span>
                  </div>
                  
                  <div className="w-full bg-slate-200 rounded-full h-2 mb-2">
                    <div
                      className={`h-2 rounded-full transition-all duration-300 ${
                        isComplete ? 'bg-green-500' : 'bg-blue-500'
                      }`}
                      style={{ width: `${progressPercentage}%` }}
                    />
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <TrendingUp className="h-4 w-4 text-green-500" />
                      <span className="text-sm text-slate-600">
                        {formatCurrency(goal.target_amount - goal.current_amount)} to go
                      </span>
                    </div>
                    
                    {goal.target_date && (
                      <span className="text-sm text-slate-500">
                        by {formatDate(goal.target_date)}
                      </span>
                    )}
                  </div>
                  
                  {isComplete && (
                    <div className="mt-2 px-3 py-1 bg-green-100 text-green-800 rounded-full text-sm text-center">
                      🎉 Goal achieved! Great job!
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};