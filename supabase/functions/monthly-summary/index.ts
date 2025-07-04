import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { userId = 'anonymous_user', month, year } = await req.json();
    
    // Default to current month if not specified
    const currentDate = new Date();
    const targetYear = year || currentDate.getFullYear();
    const targetMonth = month || (currentDate.getMonth() + 1);

    // Initialize Supabase client
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get transactions for the specified month
    const startDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
    const endDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-31`;

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    if (!transactions || transactions.length === 0) {
      return new Response(
        JSON.stringify({ 
          success: true, 
          summary: "No transactions found for this month. Start tracking your expenses to get personalized insights!" 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate totals
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + parseFloat(t.amount.toString()), 0);

    const netSavings = totalIncome - totalExpenses;

    // Group expenses by category
    const expensesByCategory = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + parseFloat(t.amount.toString());
        return acc;
      }, {} as Record<string, number>);

    // Create summary prompt for AI
    const summaryPrompt = `You are Spendly, a friendly financial wellness coach. Create a conversational monthly summary based on this data:

    Monthly Financial Data:
    - Total Income: $${totalIncome.toFixed(2)}
    - Total Expenses: $${totalExpenses.toFixed(2)}
    - Net Savings: $${netSavings.toFixed(2)}
    - Expense Categories: ${JSON.stringify(expensesByCategory)}
    
    Guidelines:
    - Be encouraging and positive
    - Highlight accomplishments
    - Provide specific actionable advice
    - Identify savings opportunities
    - Keep under 200 words
    - Use a warm, supportive tone
    - Include specific numbers and insights
    
    Create a personalized monthly financial health summary.`;

    // Call OpenAI API
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-3.5-turbo',
        messages: [
          {
            role: 'system',
            content: summaryPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 300,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiSummary = openaiData.choices[0]?.message?.content;
    
    if (!aiSummary) {
      throw new Error("No response from OpenAI");
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        summary: aiSummary,
        data: {
          totalIncome,
          totalExpenses,
          netSavings,
          expensesByCategory,
          transactionCount: transactions.length
        }
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error generating monthly summary:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        summary: "Unable to generate your monthly summary right now. Please try again later."
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});