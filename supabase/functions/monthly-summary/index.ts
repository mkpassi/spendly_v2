import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  "Access-Control-Max-Age": "86400",
};

interface TransactionData {
  id: string;
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
  source?: string;
  user_id: string;
}

interface SummaryData {
  totalIncome: number;
  totalExpenses: number;
  netSavings: number;
  savingsRate: number;
  expensesByCategory: Record<string, number>;
  incomeByCategory: Record<string, number>;
  transactionCount: number;
  topSpendingCategory: string;
  topIncomeCategory: string;
  averageTransactionAmount: number;
  daysWithTransactions: number;
}

serve(async (req: Request) => {
  console.log("📊 Monthly Summary: Function invoked");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Parse request body
    const requestBody = await req.text();
    console.log("📊 Monthly Summary: Request body:", requestBody);
    
    const { month, year, userId } = requestBody ? JSON.parse(requestBody) : {};
    
    // Default to current month if not specified
    const currentDate = new Date();
    const targetYear = year || currentDate.getFullYear();
    const targetMonth = month || (currentDate.getMonth() + 1);
    
    console.log("📊 Monthly Summary: Target period:", { year: targetYear, month: targetMonth });

    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT token for security
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("📊 Monthly Summary: No valid authorization header");
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - No valid token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("📊 Monthly Summary: Auth error:", authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const authenticatedUserId = user.id;
    console.log("📊 Monthly Summary: Authenticated user:", authenticatedUserId);

    // Use the authenticated user ID (ignore any userId from request body for security)
    const finalUserId = authenticatedUserId;

    // Get transactions for the specified month
    const startDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
    const endDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-31`;

    console.log("📊 Monthly Summary: Fetching transactions from", startDate, "to", endDate);

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', finalUserId)
      .gte('date', startDate)
      .lte('date', endDate)
      .order('date', { ascending: false });

    if (error) {
      console.error("📊 Monthly Summary: Database error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log("📊 Monthly Summary: Found", transactions?.length || 0, "transactions");

    if (!transactions || transactions.length === 0) {
      const monthName = new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' });
      return new Response(
        JSON.stringify({ 
          success: true, 
          summary: `No transactions found for ${monthName} ${targetYear}. Start tracking your expenses to get personalized insights! 💰\n\nTip: Try adding a transaction like "Bought coffee for $5" in the chat to get started.`,
          data: {
            totalIncome: 0,
            totalExpenses: 0,
            netSavings: 0,
            savingsRate: 0,
            expensesByCategory: {},
            incomeByCategory: {},
            transactionCount: 0,
            topSpendingCategory: '',
            topIncomeCategory: '',
            averageTransactionAmount: 0,
            daysWithTransactions: 0
          }
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Calculate comprehensive metrics
    const totalIncome = transactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount.toString())), 0);

    const totalExpenses = transactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + Math.abs(parseFloat(t.amount.toString())), 0);

    const netSavings = totalIncome - totalExpenses;
    const savingsRate = totalIncome > 0 ? (netSavings / totalIncome) * 100 : 0;

    // Group expenses by category
    const expensesByCategory = transactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        const category = t.category || 'Other';
        acc[category] = (acc[category] || 0) + Math.abs(parseFloat(t.amount.toString()));
        return acc;
      }, {} as Record<string, number>);

    // Group income by category
    const incomeByCategory = transactions
      .filter(t => t.type === 'income')
      .reduce((acc, t) => {
        const category = t.category || 'Other';
        acc[category] = (acc[category] || 0) + Math.abs(parseFloat(t.amount.toString()));
        return acc;
      }, {} as Record<string, number>);

    // Calculate additional metrics
    const topSpendingCategory = Object.entries(expensesByCategory)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || '';
    
    const topIncomeCategory = Object.entries(incomeByCategory)
      .sort(([,a], [,b]) => b - a)[0]?.[0] || '';

    const averageTransactionAmount = transactions.length > 0 
      ? transactions.reduce((sum, t) => sum + Math.abs(parseFloat(t.amount.toString())), 0) / transactions.length
      : 0;

    const uniqueDates = new Set(transactions.map(t => t.date.split('T')[0]));
    const daysWithTransactions = uniqueDates.size;

    const summaryData: SummaryData = {
      totalIncome,
      totalExpenses,
      netSavings,
      savingsRate,
      expensesByCategory,
      incomeByCategory,
      transactionCount: transactions.length,
      topSpendingCategory,
      topIncomeCategory,
      averageTransactionAmount,
      daysWithTransactions
    };

    // Create enhanced summary prompt for AI
    const monthName = new Date(targetYear, targetMonth - 1).toLocaleString('default', { month: 'long' });
    const summaryPrompt = `You are Spendly, a friendly and knowledgeable financial wellness coach. Create a conversational monthly summary for ${monthName} ${targetYear} based on this comprehensive financial data:

📊 FINANCIAL OVERVIEW:
- Total Income: $${totalIncome.toFixed(2)}
- Total Expenses: $${totalExpenses.toFixed(2)}
- Net Savings: $${netSavings.toFixed(2)}
- Savings Rate: ${savingsRate.toFixed(1)}%
- Transaction Count: ${transactions.length}
- Active Days: ${daysWithTransactions} days
- Average Transaction: $${averageTransactionAmount.toFixed(2)}

💸 TOP SPENDING CATEGORIES:
${Object.entries(expensesByCategory)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 3)
  .map(([cat, amt]) => `- ${cat}: $${amt.toFixed(2)}`)
  .join('\n')}

💰 INCOME SOURCES:
${Object.entries(incomeByCategory)
  .sort(([,a], [,b]) => b - a)
  .slice(0, 3)
  .map(([cat, amt]) => `- ${cat}: $${amt.toFixed(2)}`)
  .join('\n')}

🎯 COACHING GUIDELINES:
1. Start with a warm, encouraging greeting
2. Celebrate wins (positive savings rate, good habits, etc.)
3. Provide specific, actionable insights based on the data
4. If savings rate is negative, be supportive but offer concrete steps
5. Highlight interesting patterns (spending frequency, category trends)
6. Give 2-3 specific recommendations for improvement
7. End with motivation and next steps
8. Use emojis appropriately but don't overdo it
9. Keep it conversational and personal
10. Mention specific numbers to make it feel personalized

💡 COACHING FOCUS AREAS:
- If savings rate > 20%: Celebrate and suggest investment/goal strategies
- If savings rate 10-20%: Acknowledge good progress, suggest optimization
- If savings rate 0-10%: Encourage and provide specific saving tips
- If savings rate < 0%: Be supportive, focus on expense reduction strategies
- Always provide category-specific advice based on top spending areas

Keep the summary engaging, personal, and under 250 words. Make it feel like advice from a knowledgeable friend who cares about their financial success.`;

    console.log("📊 Monthly Summary: Calling OpenAI API...");

    // Call OpenAI API with timeout
    const openaiController = new AbortController();
    const openaiTimeout = setTimeout(() => openaiController.abort(), 15000);

    try {
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
              content: 'You are Spendly, a friendly financial wellness coach. Provide personalized, encouraging, and actionable financial advice.'
            },
            {
              role: 'user',
              content: summaryPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 400,
        }),
        signal: openaiController.signal,
      });

      clearTimeout(openaiTimeout);

      if (!openaiResponse.ok) {
        console.error("📊 Monthly Summary: OpenAI API error:", openaiResponse.status);
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      const aiSummary = openaiData.choices[0]?.message?.content;
      
      if (!aiSummary) {
        throw new Error("No response from OpenAI");
      }

      console.log("📊 Monthly Summary: AI summary generated successfully");

      return new Response(
        JSON.stringify({ 
          success: true, 
          summary: aiSummary,
          data: summaryData
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );

    } catch (openaiError) {
      clearTimeout(openaiTimeout);
      console.error("📊 Monthly Summary: OpenAI error:", openaiError);
      
      // Fallback to local summary if OpenAI fails
      const fallbackSummary = generateFallbackSummary(monthName, summaryData);
      
      return new Response(
        JSON.stringify({ 
          success: true, 
          summary: fallbackSummary,
          data: summaryData,
          note: "Generated using local analysis (AI temporarily unavailable)"
        }),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

  } catch (error) {
    console.error('📊 Monthly Summary: Error:', error);
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

function generateFallbackSummary(monthName: string, data: SummaryData): string {
  let summary = `🎉 Here's your ${monthName} financial summary!\n\n`;
  
  summary += `💰 Income: $${data.totalIncome.toLocaleString()}\n`;
  summary += `💸 Expenses: $${data.totalExpenses.toLocaleString()}\n`;
  summary += `📈 Net Savings: $${data.netSavings.toLocaleString()}\n`;
  summary += `📊 Savings Rate: ${data.savingsRate.toFixed(1)}%\n\n`;
  
  if (data.netSavings > 0) {
    summary += `🌟 Great job! You saved money this month. `;
    if (data.savingsRate >= 20) {
      summary += `Your ${data.savingsRate.toFixed(1)}% savings rate is excellent!`;
    } else if (data.savingsRate >= 10) {
      summary += `Your ${data.savingsRate.toFixed(1)}% savings rate is solid!`;
    } else {
      summary += `Try to increase your savings rate next month.`;
    }
  } else {
    summary += `💡 You spent more than you earned this month. Let's work on reducing expenses!`;
  }
  
  if (data.topSpendingCategory) {
    const topAmount = data.expensesByCategory[data.topSpendingCategory];
    summary += `\n\n🏆 Top spending: ${data.topSpendingCategory} ($${topAmount.toLocaleString()})`;
    
    if (data.topSpendingCategory === 'Dining') {
      summary += `\n💡 Tip: Try meal prepping to reduce dining expenses!`;
    } else if (data.topSpendingCategory === 'Shopping') {
      summary += `\n💡 Tip: Consider a 24-hour rule before non-essential purchases!`;
    } else if (data.topSpendingCategory === 'Entertainment') {
      summary += `\n💡 Tip: Look for free or low-cost entertainment options!`;
    }
  }

  return summary;
}