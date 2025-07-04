import { supabase } from '../lib/supabase';

export interface DummyTransaction {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  source: string;
}

export const dummyTransactions: DummyTransaction[] = [
  // January 2025 - Recent transactions
  {
    date: '2025-01-04',
    description: 'Monthly Salary - Tech Corp',
    amount: 4200.00,
    category: 'Salary',
    type: 'income',
    source: 'manual'
  },
  {
    date: '2025-01-04',
    description: 'Morning Coffee - Blue Bottle',
    amount: 6.50,
    category: 'Dining',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2025-01-04',
    description: 'Lunch - Mediterranean Grill',
    amount: 18.75,
    category: 'Dining',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2025-01-03',
    description: 'Weekly Groceries - Whole Foods',
    amount: 142.30,
    category: 'Groceries',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2025-01-03',
    description: 'Gas Station - Shell',
    amount: 52.40,
    category: 'Transportation',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2025-01-03',
    description: 'Freelance Design Project',
    amount: 850.00,
    category: 'Salary',
    type: 'income',
    source: 'manual'
  },
  {
    date: '2025-01-02',
    description: 'Netflix Subscription',
    amount: 15.99,
    category: 'Entertainment',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2025-01-02',
    description: 'Spotify Premium',
    amount: 9.99,
    category: 'Entertainment',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2025-01-02',
    description: 'Dinner - Italian Bistro',
    amount: 67.80,
    category: 'Dining',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2025-01-01',
    description: 'New Year Bonus',
    amount: 1000.00,
    category: 'Salary',
    type: 'income',
    source: 'manual'
  },
  {
    date: '2025-01-01',
    description: 'Uber Rides - New Year',
    amount: 45.20,
    category: 'Transportation',
    type: 'expense',
    source: 'manual'
  },
  
  // December 2024 - Previous month for comparison
  {
    date: '2024-12-31',
    description: 'Rent Payment - Downtown Apt',
    amount: 1850.00,
    category: 'Rent',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-30',
    description: 'Electric Bill - PG&E',
    amount: 95.60,
    category: 'Utilities',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-30',
    description: 'Internet Bill - Comcast',
    amount: 79.99,
    category: 'Utilities',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-29',
    description: 'Holiday Shopping - Amazon',
    amount: 324.50,
    category: 'Shopping',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-28',
    description: 'Doctor Visit Copay',
    amount: 35.00,
    category: 'Health',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-27',
    description: 'Pharmacy - CVS',
    amount: 24.99,
    category: 'Health',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-26',
    description: 'Post-Holiday Groceries',
    amount: 89.45,
    category: 'Groceries',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-25',
    description: 'Christmas Bonus',
    amount: 750.00,
    category: 'Salary',
    type: 'income',
    source: 'manual'
  },
  {
    date: '2024-12-24',
    description: 'Christmas Eve Dinner',
    amount: 125.00,
    category: 'Dining',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-23',
    description: 'Movie Theater - AMC',
    amount: 32.50,
    category: 'Entertainment',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-22',
    description: 'Gym Membership - Equinox',
    amount: 89.99,
    category: 'Health',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-21',
    description: 'Online Course - Udemy',
    amount: 49.99,
    category: 'Education',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-20',
    description: 'Phone Bill - Verizon',
    amount: 85.00,
    category: 'Utilities',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-19',
    description: 'Coffee Shop - Local Roasters',
    amount: 4.75,
    category: 'Dining',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-18',
    description: 'Clothing - H&M',
    amount: 156.80,
    category: 'Shopping',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-17',
    description: 'Gas Station Fill-up',
    amount: 48.30,
    category: 'Transportation',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-16',
    description: 'Lunch - Sushi Restaurant',
    amount: 28.90,
    category: 'Dining',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-15',
    description: 'Consulting Payment',
    amount: 1200.00,
    category: 'Salary',
    type: 'income',
    source: 'manual'
  },
  {
    date: '2024-12-14',
    description: 'Grocery Store - Safeway',
    amount: 76.25,
    category: 'Groceries',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-13',
    description: 'Book Purchase - Amazon',
    amount: 19.99,
    category: 'Education',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-12',
    description: 'Dinner Date - Fine Dining',
    amount: 145.60,
    category: 'Dining',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-11',
    description: 'Car Insurance - Geico',
    amount: 125.00,
    category: 'Transportation',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-10',
    description: 'Coffee & Pastry',
    amount: 8.50,
    category: 'Dining',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-09',
    description: 'Weekend Groceries',
    amount: 112.40,
    category: 'Groceries',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-08',
    description: 'Concert Tickets',
    amount: 89.00,
    category: 'Entertainment',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-07',
    description: 'Uber Eats Delivery',
    amount: 23.45,
    category: 'Dining',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-06',
    description: 'Haircut - Salon',
    amount: 65.00,
    category: 'Other',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-05',
    description: 'Monthly Salary - Tech Corp',
    amount: 4200.00,
    category: 'Salary',
    type: 'income',
    source: 'manual'
  },
  {
    date: '2024-12-04',
    description: 'Lunch - Fast Casual',
    amount: 14.25,
    category: 'Dining',
    type: 'expense',
    source: 'manual'
  },
  {
    date: '2024-12-03',
    description: 'Office Supplies - Staples',
    amount: 42.80,
    category: 'Other',
    type: 'expense',
    source: 'manual'
  }
];

export const dummyGoals = [
  {
    title: 'Emergency Fund (6 months expenses)',
    target_amount: 15000.00,
    target_date: '2025-12-31',
    status: 'active'
  },
  {
    title: 'New MacBook Pro',
    target_amount: 2500.00,
    target_date: '2025-04-15',
    status: 'active'
  },
  {
    title: 'Summer Vacation to Japan',
    target_amount: 4500.00,
    target_date: '2025-07-01',
    status: 'active'
  },
  {
    title: 'Home Down Payment Fund',
    target_amount: 50000.00,
    target_date: '2026-06-30',
    status: 'active'
  },
  {
    title: 'New Car Fund',
    target_amount: 8000.00,
    target_date: '2025-09-01',
    status: 'active'
  }
];

export const dummyChatMessages = [
  {
    message: "Hi! I'm your Financial Wellness Coach from Spendly. Track Smart, Save Easy. 💰\n\nTell me about a recent transaction (like 'Bought groceries for $75') or upload a bank statement to get started!\n\n💡 Tip: Try the 'Data' tab to add sample transactions for testing!",
    sender: 'ai' as const,
    created_at: new Date('2025-01-01T10:00:00Z').toISOString()
  },
  {
    message: "Hi! I just started using Spendly. How does this work?",
    sender: 'user' as const,
    created_at: new Date('2025-01-01T10:05:00Z').toISOString()
  },
  {
    message: "Welcome to Spendly! 🎉 I'm here to help you track your finances and reach your savings goals.\n\nYou can:\n• Tell me about transactions (e.g., 'Bought coffee for $5')\n• Set savings goals\n• Get spending insights\n• Upload bank statements\n\nWhat would you like to start with?",
    sender: 'ai' as const,
    created_at: new Date('2025-01-01T10:05:15Z').toISOString()
  },
  {
    message: "I want to save $2500 for a new MacBook Pro by April",
    sender: 'user' as const,
    created_at: new Date('2025-01-01T10:10:00Z').toISOString()
  },
  {
    message: "Excellent goal! 💻 I've added your MacBook Pro savings goal of $2,500 by April 15th.\n\nThat's about $208 per month - totally achievable! I'll help you track your progress and find ways to optimize your spending to reach this goal faster.",
    sender: 'ai' as const,
    created_at: new Date('2025-01-01T10:10:20Z').toISOString()
  },
  {
    message: "Got my salary today - $4200",
    sender: 'user' as const,
    created_at: new Date('2025-01-04T09:00:00Z').toISOString()
  },
  {
    message: "Fantastic! 🎉 Added your salary of $4,200 for today. That's a great way to start the new year!\n\nWith this income, you're well on track for your MacBook goal. You could save $500+ this month if you keep expenses reasonable. Keep it up!",
    sender: 'ai' as const,
    created_at: new Date('2025-01-04T09:00:30Z').toISOString()
  },
  {
    message: "Bought coffee for $6.50 at Blue Bottle",
    sender: 'user' as const,
    created_at: new Date('2025-01-04T11:30:00Z').toISOString()
  },
  {
    message: "Got it! Added expense of $6.50 for coffee at Blue Bottle in Dining. ☕\n\nI notice you enjoy good coffee! At $6.50 per day, that's about $195/month. Consider brewing premium coffee at home sometimes - you could save $100+ monthly toward your MacBook!",
    sender: 'ai' as const,
    created_at: new Date('2025-01-04T11:30:15Z').toISOString()
  },
  {
    message: "How am I doing with my spending this month?",
    sender: 'user' as const,
    created_at: new Date('2025-01-04T15:00:00Z').toISOString()
  },
  {
    message: "You're doing fantastic! 📊 This month so far:\n\n💰 Income: $6,050 (salary + freelance + bonus)\n💸 Expenses: $216.94\n📈 Net Savings: $5,833.06\n\nTop spending: Dining ($93.05). You're saving 96% of your income - incredible discipline! At this rate, you'll hit your MacBook goal in just 5 weeks! 🚀",
    sender: 'ai' as const,
    created_at: new Date('2025-01-04T15:00:20Z').toISOString()
  },
  {
    message: "What about my other goals?",
    sender: 'user' as const,
    created_at: new Date('2025-01-04T16:00:00Z').toISOString()
  },
  {
    message: "Great question! Here's your goal progress: 🎯\n\n💻 MacBook Pro: $5,833 of $2,500 (233% - ACHIEVED! 🎉)\n🏠 Emergency Fund: $5,833 of $15,000 (39%)\n✈️ Japan Trip: $5,833 of $4,500 (130% - ACHIEVED! 🎉)\n🏡 Home Down Payment: $5,833 of $50,000 (12%)\n🚗 New Car: $5,833 of $8,000 (73%)\n\nYou've already achieved 2 goals this month! Amazing work! 🌟",
    sender: 'ai' as const,
    created_at: new Date('2025-01-04T16:00:25Z').toISOString()
  }
];

export const insertDummyData = async (userId: string = 'anonymous_user') => {
  try {
    // Insert dummy transactions
    const { error: transactionError } = await supabase
      .from('transactions')
      .insert(
        dummyTransactions.map(tx => ({
          user_id: userId,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          type: tx.type,
          source: tx.source
        }))
      );

    if (transactionError) {
      console.error('Error inserting dummy transactions:', transactionError);
      return false;
    }

    // Insert dummy goals
    const { error: goalError } = await supabase
      .from('goals')
      .insert(
        dummyGoals.map(goal => ({
          user_id: userId,
          title: goal.title,
          target_amount: goal.target_amount,
          target_date: goal.target_date,
          status: goal.status
        }))
      );

    if (goalError) {
      console.error('Error inserting dummy goals:', goalError);
      return false;
    }

    // Insert dummy chat messages
    const { error: chatError } = await supabase
      .from('chat_messages')
      .insert(
        dummyChatMessages.map(msg => ({
          user_id: userId,
          message: msg.message,
          sender: msg.sender,
          created_at: msg.created_at
        }))
      );

    if (chatError) {
      console.error('Error inserting dummy chat messages:', chatError);
      return false;
    }

    console.log('Successfully inserted all dummy data!');
    return true;
  } catch (error) {
    console.error('Error inserting dummy data:', error);
    return false;
  }
};

export const clearAllData = async (userId: string = 'anonymous_user') => {
  try {
    // Clear transactions
    await supabase
      .from('transactions')
      .delete()
      .eq('user_id', userId);

    // Clear goals
    await supabase
      .from('goals')
      .delete()
      .eq('user_id', userId);

    // Clear chat messages
    await supabase
      .from('chat_messages')
      .delete()
      .eq('user_id', userId);

    console.log('Successfully cleared all data!');
    return true;
  } catch (error) {
    console.error('Error clearing data:', error);
    return false;
  }
};