import React, { useState, useEffect, useRef } from 'react';
import { Target, TrendingUp, Plus, X, UserX } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { useCurrency } from '../contexts/CurrencyContext';
import { formatCurrency } from '../utils/currencyUtils';

interface Goal {
  id: string;
  title: string;
  target_amount: number;
  allocated_amount: number;
  percentage_allocation: number;
  target_date: string | null;
  status: string;
  is_active: boolean;
  completion_date: string | null;
  created_at: string;
}

export const GoalTracker: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { currency } = useCurrency();
  const [goals, setGoals] = useState<Goal[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showAddGoal, setShowAddGoal] = useState(false);
  const [hasConnectionError, setHasConnectionError] = useState(false);
  const [showUpdateNotification, setShowUpdateNotification] = useState(false);
  const [newGoal, setNewGoal] = useState({
    title: '',
    target_amount: '',
    target_date: ''
  });
  const loadingRef = useRef(false);
  const realtimeChannelRef = useRef<any>(null);

  // Set up real-time subscription for transactions to update goal progress
  const setupRealtimeSubscription = React.useCallback(() => {
    if (!user?.id) return;
    
    console.log('🎯 GoalTracker: Setting up real-time subscription for user:', user.id);
    
    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      console.log('🎯 GoalTracker: Cleaning up existing subscription');
      supabase.removeChannel(realtimeChannelRef.current);
    }

    // Create new subscription for both transactions and goals
    const channel = supabase
      .channel(`goal-updates:user_id=eq.${user.id}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'transactions',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🎯 GoalTracker: Real-time transaction update received:', payload);
          
          // Show notification for real-time updates
          setShowUpdateNotification(true);
          setTimeout(() => setShowUpdateNotification(false), 3000);
          
          // Reload goals to recalculate progress when transactions change
          loadGoals();
        }
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goals',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🎯 GoalTracker: Real-time goal update received:', payload);
          
          // Show notification for real-time updates
          setShowUpdateNotification(true);
          setTimeout(() => setShowUpdateNotification(false), 3000);
          
          // Reload goals when goals are added/updated/deleted
          loadGoals();
        }
      )
      .subscribe((status) => {
        console.log('🎯 GoalTracker: Real-time subscription status:', status);
      });

    realtimeChannelRef.current = channel;
  }, [user?.id]);

  useEffect(() => {
    if (user && !loadingRef.current) {
      loadGoals();
      setupRealtimeSubscription();
    } else if (!authLoading) {
      setIsLoading(false);
      setGoals([]);
      setHasConnectionError(false);
    }

    // Cleanup subscription on component unmount or user change
    return () => {
      if (realtimeChannelRef.current) {
        console.log('🎯 GoalTracker: Cleaning up real-time subscription');
        supabase.removeChannel(realtimeChannelRef.current);
      }
    };
  }, [user, authLoading, setupRealtimeSubscription]);

  const loadGoals = async () => {
    if (!user || loadingRef.current) return;
    
    loadingRef.current = true;
    setIsLoading(true);
    setHasConnectionError(false);
    
    try {
      // Use the new goal_progress_summary view for better performance
      const { data, error } = await supabase
        .from('goal_progress_summary')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setGoals(data || []);
      setHasConnectionError(false);
    } catch (error) {
      console.error('Error loading goals:', error);
      setHasConnectionError(true);
    } finally {
      setIsLoading(false);
      loadingRef.current = false;
    }
  };



  const handleAddGoal = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!newGoal.title || !newGoal.target_amount || !user) return;

    try {
      const { data, error } = await supabase
        .from('goals')
        .insert({
          user_id: user.id,
          title: newGoal.title,
          target_amount: parseFloat(newGoal.target_amount),
          target_date: newGoal.target_date || null,
          status: 'active',
          is_active: true,
          allocated_amount: 0
        })
        .select()
        .single();

      if (error) throw error;

      setGoals(prev => [{ ...data, allocated_amount: 0 }, ...prev]);
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
        .update({ 
          status: 'completed',
          is_active: false,
          completion_date: new Date().toISOString()
        })
        .eq('id', goalId);

      if (error) throw error;

      setGoals(prev => prev.filter(g => g.id !== goalId));
    } catch (error) {
      console.error('Error completing goal:', error);
    }
  };

  const formatCurrencyWithSymbol = (amount: number) => {
    return formatCurrency(amount, currency);
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString();
  };

  const getProgressPercentage = (current: number, target: number) => {
    if (target === 0) return 0;
    return Math.min(100, Math.max(0, (current / target) * 100));
  };

  if (isLoading || authLoading) {
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
    <div className="bg-white rounded-lg shadow-md overflow-hidden relative">
      {/* Real-time Update Notification */}
      {showUpdateNotification && (
        <div className="absolute top-2 right-2 bg-blue-500 text-white px-3 py-1 rounded-full text-sm font-medium shadow-lg z-10 animate-pulse">
          🎯 Goals updated!
        </div>
      )}
      
      {/* Header */}
      <div className="bg-slate-50 px-6 py-4 border-b border-slate-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-5 w-5 text-slate-600" />
            <h2 className="text-lg font-semibold text-slate-800">Savings Goals</h2>
          </div>
          <button
            onClick={() => setShowAddGoal(true)}
            disabled={!user}
            className="flex items-center gap-2 px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
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
        {!user ? (
          <div className="text-center text-slate-500 py-8">
            <UserX className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="font-semibold">Please log in</p>
            <p className="text-sm">Sign in to track your savings goals.</p>
          </div>
        ) : goals.length === 0 ? (
          <div className="text-center text-slate-500 py-8">
            <Target className="h-12 w-12 mx-auto mb-4 text-slate-300" />
            <p className="font-semibold">No active goals yet.</p>
            <p className="text-sm">Click "Add Goal" to get started!</p>
          </div>
        ) : (
          <div className="space-y-6">
            {goals.map((goal) => {
              const progressPercentage = getProgressPercentage(goal.allocated_amount, goal.target_amount);
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
                      {formatCurrencyWithSymbol(goal.allocated_amount)}
                    </span>
                    <span className="text-sm text-slate-500">
                      of {formatCurrencyWithSymbol(goal.target_amount)}
                    </span>
                  </div>
                  
                  {goal.percentage_allocation && (
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs text-blue-600 bg-blue-50 px-2 py-1 rounded">
                        {goal.percentage_allocation.toFixed(1)}% of income allocated
                      </span>
                      <span className="text-xs text-slate-500">
                        {progressPercentage.toFixed(1)}% complete
                      </span>
                    </div>
                  )}
                  
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
                      <button
                        onClick={() => handleCompleteGoal(goal.id)}
                        className="p-2 text-slate-400 hover:text-green-500 transition-colors"
                      >
                        <TrendingUp className="h-4 w-4" />
                      </button>
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