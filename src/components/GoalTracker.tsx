import React, { useState, useEffect, useRef } from 'react';
import { Target, TrendingUp, Plus, X, UserX, RefreshCw, ChevronDown, ChevronUp, ArrowRight, Calendar, DollarSign, PieChart } from 'lucide-react';
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

interface GoalAllocation {
  id: string;
  goal_id: string;
  transaction_id: string;
  amount: number;
  allocation_type: 'auto' | 'manual';
  allocation_date: string;
  notes: string | null;
  transaction: {
    id: string;
    description: string;
    amount: number;
    type: 'income' | 'expense';
    category: string;
    date: string;
    source: string;
  };
}

interface GoalWithAllocations extends Goal {
  allocations: GoalAllocation[];
}

export const GoalTracker: React.FC = () => {
  const { user, loading: authLoading } = useAuth();
  const { currency } = useCurrency();
  const [goals, setGoals] = useState<GoalWithAllocations[]>([]);
  const [expandedGoals, setExpandedGoals] = useState<Set<string>>(new Set());
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

  // Toggle goal expansion
  const toggleGoalExpansion = (goalId: string) => {
    setExpandedGoals(prev => {
      const newSet = new Set(prev);
      if (newSet.has(goalId)) {
        newSet.delete(goalId);
      } else {
        newSet.add(goalId);
      }
      return newSet;
    });
  };

  // Set up real-time subscription for transactions to update goal progress
  const setupRealtimeSubscription = React.useCallback(() => {
    if (!user?.id) return;
    
    console.log('🎯 GoalTracker: Setting up real-time subscription for user:', user.id);
    
    // Clean up existing subscription
    if (realtimeChannelRef.current) {
      console.log('🎯 GoalTracker: Cleaning up existing subscription');
      supabase.removeChannel(realtimeChannelRef.current);
    }

    // Create new subscription for transactions, goals, and goal_allocations
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
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'goal_allocations',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          console.log('🎯 GoalTracker: Real-time goal allocation update received:', payload);
          
          // Show notification for real-time updates
          setShowUpdateNotification(true);
          setTimeout(() => setShowUpdateNotification(false), 3000);
          
          // Reload goals when goal allocations change (this triggers goal progress updates)
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
      console.log('🎯 GoalTracker: Loading goals for user:', user.id);
      
      // First, get all goals
      const { data: goalsData, error: goalsError } = await supabase
        .from('goals')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (goalsError) throw goalsError;

      console.log('🎯 GoalTracker: Found goals:', goalsData?.length || 0);

      // Then, get all goal allocations with transaction details
      const goalIds = goalsData?.map(g => g.id) || [];
      let goalsWithAllocations: GoalWithAllocations[] = [];

      if (goalIds.length > 0) {
        const { data: allocationsData, error: allocationsError } = await supabase
          .from('goal_allocations')
          .select(`
            *,
            transaction:transactions(
              id,
              description,
              amount,
              type,
              category,
              date,
              source
            )
          `)
          .in('goal_id', goalIds)
          .order('allocation_date', { ascending: false });

        if (allocationsError) {
          console.error('🎯 GoalTracker: Error loading allocations:', allocationsError);
          goalsWithAllocations = goalsData.map(goal => ({
            ...goal,
            allocations: []
          }));
        } else {
          console.log('🎯 GoalTracker: Found allocations:', allocationsData?.length || 0);
          
          // Group allocations by goal
          const allocationsByGoal = (allocationsData || []).reduce((acc: any, allocation) => {
            if (!acc[allocation.goal_id]) {
              acc[allocation.goal_id] = [];
            }
            acc[allocation.goal_id].push(allocation);
            return acc;
          }, {});

          // Calculate allocated amounts and attach allocations to goals
          goalsWithAllocations = goalsData.map(goal => {
            const goalAllocations = allocationsByGoal[goal.id] || [];
            const totalAllocated = goalAllocations.reduce((sum: number, alloc: any) => sum + (alloc.amount || 0), 0);
            
            return {
              ...goal,
              allocated_amount: totalAllocated,
              allocations: goalAllocations
            };
          });
        }
      } else {
        goalsWithAllocations = goalsData.map(goal => ({
          ...goal,
          allocations: []
        }));
      }

      console.log('🎯 GoalTracker: Final goals with allocations:', goalsWithAllocations);
      setGoals(goalsWithAllocations);
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
          <div className="flex items-center gap-2">
            <button
              onClick={() => loadGoals()}
              disabled={!user || isLoading}
              className="flex items-center gap-2 px-3 py-1 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors disabled:bg-slate-300 disabled:cursor-not-allowed"
            >
              <RefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span className="text-sm">Refresh</span>
            </button>
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
              const isExpanded = expandedGoals.has(goal.id);
              const hasAllocations = goal.allocations.length > 0;
              
              return (
                <div key={goal.id} className="border border-slate-200 rounded-lg overflow-hidden">
                  {/* Goal Header */}
                  <div className="p-4 bg-gradient-to-r from-blue-50 to-indigo-50">
                    <div className="flex items-center justify-between mb-3">
                      <h3 className="font-semibold text-slate-800 flex items-center gap-2">
                        <Target className="h-5 w-5 text-blue-600" />
                        {goal.title}
                      </h3>
                      <div className="flex items-center gap-2">
                        {isComplete && (
                          <span className="px-2 py-1 bg-green-100 text-green-800 rounded-full text-xs font-medium">
                            ✅ Complete
                          </span>
                        )}
                        {hasAllocations && (
                          <button
                            onClick={() => toggleGoalExpansion(goal.id)}
                            className="p-1 text-slate-500 hover:text-blue-600 transition-colors"
                          >
                            {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </button>
                        )}
                      </div>
                    </div>
                    
                    {/* Progress Overview */}
                    <div className="grid grid-cols-2 gap-4 mb-3">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">
                          {formatCurrencyWithSymbol(goal.allocated_amount)}
                        </div>
                        <div className="text-xs text-slate-500">Current Amount</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-slate-700">
                          {formatCurrencyWithSymbol(goal.target_amount)}
                        </div>
                        <div className="text-xs text-slate-500">Target Amount</div>
                      </div>
                    </div>
                    
                    {/* Progress Bar */}
                    <div className="mb-3">
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium text-slate-700">
                          {progressPercentage.toFixed(1)}% Complete
                        </span>
                        {goal.percentage_allocation && (
                          <span className="text-xs text-blue-600 bg-blue-100 px-2 py-1 rounded">
                            {goal.percentage_allocation.toFixed(1)}% of income
                          </span>
                        )}
                      </div>
                      <div className="w-full bg-slate-200 rounded-full h-3">
                        <div
                          className={`h-3 rounded-full transition-all duration-500 ${
                            isComplete ? 'bg-gradient-to-r from-green-500 to-green-600' : 'bg-gradient-to-r from-blue-500 to-indigo-600'
                          }`}
                          style={{ width: `${Math.min(progressPercentage, 100)}%` }}
                        />
                      </div>
                    </div>
                    
                    {/* Goal Details */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        {hasAllocations && (
                          <button
                            onClick={() => toggleGoalExpansion(goal.id)}
                            className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition-colors"
                          >
                            <PieChart className="h-4 w-4" />
                            {goal.allocations.length} contributions
                          </button>
                        )}
                        {goal.target_date && (
                          <span className="flex items-center gap-1 text-sm text-slate-500">
                            <Calendar className="h-4 w-4" />
                            {formatDate(goal.target_date)}
                          </span>
                        )}
                      </div>
                      
                      {isComplete && (
                        <button
                          onClick={() => handleCompleteGoal(goal.id)}
                          className="px-3 py-1 bg-green-500 text-white rounded-lg hover:bg-green-600 transition-colors text-sm"
                        >
                          Mark Complete
                        </button>
                      )}
                    </div>
                  </div>
                  
                  {/* Expanded Allocations Breakdown */}
                  {isExpanded && hasAllocations && (
                    <div className="border-t border-slate-200">
                      <div className="p-4 bg-slate-50">
                        <h4 className="font-medium text-slate-800 mb-3 flex items-center gap-2">
                          <DollarSign className="h-4 w-4 text-green-600" />
                          Money Flow Breakdown
                        </h4>
                        
                        <div className="space-y-3">
                          {goal.allocations.map((allocation, index) => (
                            <div key={allocation.id} className="bg-white rounded-lg p-3 border border-slate-200">
                              <div className="flex items-start justify-between">
                                <div className="flex-1">
                                  <div className="flex items-center gap-2 mb-1">
                                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                                      allocation.allocation_type === 'auto' 
                                        ? 'bg-blue-100 text-blue-800' 
                                        : 'bg-purple-100 text-purple-800'
                                    }`}>
                                      {allocation.allocation_type === 'auto' ? '🤖 Auto' : '✋ Manual'}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      {formatDate(allocation.allocation_date)}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-2 mb-2">
                                    <span className="font-medium text-slate-800">
                                      {allocation.transaction.description}
                                    </span>
                                    <ArrowRight className="h-3 w-3 text-slate-400" />
                                    <span className="text-sm text-slate-600">
                                      {goal.title}
                                    </span>
                                  </div>
                                  
                                  <div className="flex items-center gap-4 text-sm">
                                    <span className={`px-2 py-1 rounded text-xs ${
                                      allocation.transaction.type === 'income' 
                                        ? 'bg-green-100 text-green-800' 
                                        : 'bg-red-100 text-red-800'
                                    }`}>
                                      {allocation.transaction.category}
                                    </span>
                                    <span className="text-slate-500">
                                      from {formatCurrencyWithSymbol(allocation.transaction.amount)} {allocation.transaction.type}
                                    </span>
                                  </div>
                                  
                                  {allocation.notes && (
                                    <div className="mt-2 text-sm text-slate-600 italic">
                                      "{allocation.notes}"
                                    </div>
                                  )}
                                </div>
                                
                                <div className="text-right">
                                  <div className="text-lg font-bold text-green-600">
                                    +{formatCurrencyWithSymbol(allocation.amount)}
                                  </div>
                                  <div className="text-xs text-slate-500">
                                    {((allocation.amount / goal.target_amount) * 100).toFixed(1)}% of goal
                                  </div>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                        
                        {/* Summary Stats */}
                        <div className="mt-4 p-3 bg-blue-50 rounded-lg">
                          <div className="grid grid-cols-3 gap-4 text-center">
                            <div>
                              <div className="text-lg font-bold text-blue-600">
                                {goal.allocations.filter(a => a.allocation_type === 'auto').length}
                              </div>
                              <div className="text-xs text-slate-600">Auto Allocations</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-purple-600">
                                {goal.allocations.filter(a => a.allocation_type === 'manual').length}
                              </div>
                              <div className="text-xs text-slate-600">Manual Allocations</div>
                            </div>
                            <div>
                              <div className="text-lg font-bold text-green-600">
                                {formatCurrencyWithSymbol(goal.target_amount - goal.allocated_amount)}
                              </div>
                              <div className="text-xs text-slate-600">Remaining</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  {/* Achievement Badge */}
                  {isComplete && (
                    <div className="p-3 bg-gradient-to-r from-green-500 to-green-600 text-white text-center">
                      <div className="flex items-center justify-center gap-2">
                        <span className="text-2xl">🎉</span>
                        <span className="font-medium">Congratulations! Goal achieved!</span>
                        <span className="text-2xl">🎉</span>
                      </div>
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