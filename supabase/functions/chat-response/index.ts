import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface ChatMessage {
  id: string;
  message: string;
  sender: 'user' | 'ai';
  created_at: string;
}

interface TransactionSummary {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  topCategory: string;
  transactionCount: number;
}

interface GoalSummary {
  id: string;
  title: string;
  target_amount: number;
  current_amount: number;
  progress_percentage: number;
}

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { message } = await req.json();
    
    if (!message || typeof message !== 'string') {
      throw new Error("Valid message is required");
    }

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );

    // Get the user from the session
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }), 
        { status: 401, headers: corsHeaders }
      );
    }
    const userId = user.id;

    // Get recent chat history for context (last 10 messages)
    const { data: recentMessages } = await supabase
      .from('chat_messages')
      .select('message, sender, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10);

    // Get recent transactions for financial context
    const { data: recentTransactions } = await supabase
      .from('transactions')
      .select('date, description, amount, category, type')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(20);

    // Get active goals for context
    const { data: activeGoals } = await supabase
      .from('goals')
      .select('title, target_amount, current_amount, target_date')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5);

    // Calculate financial summary
    const financialSummary = calculateFinancialSummary(recentTransactions || []);
    const goalsSummary = calculateGoalsSummary(activeGoals || []);

    // Create comprehensive context for AI
    const systemPrompt = `You are Spendly, a friendly, knowledgeable, and encouraging AI financial wellness coach. Your mission is to help users achieve financial wellness through smart tracking and easy saving.

PERSONALITY & TONE:
- Warm, supportive, and motivational
- Use encouraging language and celebrate progress
- Be conversational but professional
- Use emojis sparingly but effectively (1-2 per response)
- Keep responses concise (under 150 words typically)
- Always end on a positive, actionable note

CORE CAPABILITIES:
- Help track expenses and income
- Provide personalized financial insights
- Assist with savings goal setting and monitoring
- Offer practical budgeting advice
- Answer general personal finance questions
- Motivate users to build healthy financial habits

CURRENT USER CONTEXT:
Financial Summary (Last 20 transactions):
- Total Income: $${financialSummary.totalIncome.toFixed(2)}
- Total Expenses: $${financialSummary.totalExpenses.toFixed(2)}
- Net Savings: $${financialSummary.netSavings.toFixed(2)}
- Top Spending Category: ${financialSummary.topCategory}
- Transaction Count: ${financialSummary.transactionCount}

Active Goals:
${goalsSummary.length > 0 ? goalsSummary.map(goal => 
  `- ${goal.title}: $${goal.current_amount.toFixed(2)} of $${goal.target_amount.toFixed(2)} (${goal.progress_percentage.toFixed(1)}%)`
).join('\n') : '- No active goals set'}

Recent Chat Context:
${recentMessages ? recentMessages.slice(0, 5).reverse().map(msg => 
  `${msg.sender}: ${msg.message}`
).join('\n') : 'No previous conversation'}

RESPONSE GUIDELINES:
- Reference specific financial data when relevant
- Acknowledge progress and celebrate achievements
- Provide actionable advice based on their situation
- If they mention transactions, acknowledge and encourage tracking
- If they ask about goals, reference their current goals
- For general questions, provide helpful financial education
- Always maintain the encouraging, coach-like tone

IMPORTANT: You are not a licensed financial advisor. Provide general guidance and education, not specific investment advice.

User's current message: "${message}"`;

    // Call OpenAI API
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: systemPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
        presence_penalty: 0.1,
        frequency_penalty: 0.1,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponse = openaiData.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error("No response generated from AI");
    }

    // Store both user message and AI response in database
    const messagesToInsert = [
      {
        user_id: userId,
        message: message.trim(),
        sender: 'user' as const
      },
      {
        user_id: userId,
        message: aiResponse.trim(),
        sender: 'ai' as const
      }
    ];

    const { error: insertError } = await supabase
      .from('chat_messages')
      .insert(messagesToInsert);

    if (insertError) {
      console.error('Error storing messages:', insertError);
      // Don't fail the request if storage fails, just log it
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: aiResponse.trim()
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in chat-response function:', error);
    
    // Provide helpful fallback response
    const fallbackResponse = "I'm having trouble connecting to my AI brain right now! 🤖 But I'm still here to help. Try asking me about budgeting tips, savings strategies, or tell me about a recent purchase. I'll do my best to assist you!";
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        response: fallbackResponse
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function calculateFinancialSummary(transactions: any[]): TransactionSummary {
  const totalIncome = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const totalExpenses = transactions
    .filter(t => t.type === 'expense')
    .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

  const netSavings = totalIncome - totalExpenses;

  // Find top spending category
  const categoryTotals = transactions
    .filter(t => t.type === 'expense')
    .reduce((acc, t) => {
      acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount.toString());
      return acc;
    }, {} as Record<string, number>);

  const topCategory = Object.entries(categoryTotals)
    .sort(([,a], [,b]) => b - a)[0]?.[0] || 'None';

  return {
    totalIncome,
    totalExpenses,
    netSavings,
    topCategory,
    transactionCount: transactions.length
  };
}

function calculateGoalsSummary(goals: any[]): GoalSummary[] {
  return goals.map(goal => ({
    id: goal.id,
    title: goal.title,
    target_amount: parseFloat(goal.target_amount.toString()),
    current_amount: parseFloat(goal.current_amount?.toString() || '0'),
    progress_percentage: goal.target_amount > 0 
      ? (parseFloat(goal.current_amount?.toString() || '0') / parseFloat(goal.target_amount.toString())) * 100 
      : 0
  }));
}