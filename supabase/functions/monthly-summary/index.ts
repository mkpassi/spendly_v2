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
  console.log("📊 Expense Summary: Function invoked");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Parse request body
    const requestBody = await req.text();
    console.log("📊 Expense Summary: Request body:", requestBody);
    
    const { startDate, endDate, userId, month, year } = requestBody ? JSON.parse(requestBody) : {};
    
    // Support both new date range format and legacy month/year format
    let finalStartDate: string;
    let finalEndDate: string;
    
    if (startDate && endDate) {
      // New date range format
      finalStartDate = startDate;
      finalEndDate = endDate;
    } else if (month && year) {
      // Legacy month/year format - convert to date range
      const targetYear = parseInt(year);
      const targetMonth = parseInt(month);
      finalStartDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      finalEndDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    } else {
      // Default to current month if no dates specified
      const currentDate = new Date();
      const targetYear = currentDate.getFullYear();
      const targetMonth = currentDate.getMonth() + 1;
      finalStartDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-01`;
      const lastDay = new Date(targetYear, targetMonth, 0).getDate();
      finalEndDate = `${targetYear}-${targetMonth.toString().padStart(2, '0')}-${lastDay.toString().padStart(2, '0')}`;
    }
    
    console.log("📊 Expense Summary: Date range:", { startDate: finalStartDate, endDate: finalEndDate });

    // Validate date range
    const startDateObj = new Date(finalStartDate);
    const endDateObj = new Date(finalEndDate);
    
    if (startDateObj > endDateObj) {
      throw new Error("Start date must be before or equal to end date");
    }
    
    // Note: Removed future date validation as it was causing issues with current dates
    // Users can select any date range they want for analysis

    // Initialize Supabase client with service role key for admin access
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user from JWT token for security
    const authHeader = req.headers.get('Authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.error("📊 Expense Summary: No valid authorization header");
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - No valid token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !user) {
      console.error("📊 Expense Summary: Auth error:", authError);
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized - Invalid token' }),
        { status: 401, headers: corsHeaders }
      );
    }

    const authenticatedUserId = user.id;
    console.log("📊 Expense Summary: Authenticated user:", authenticatedUserId);

    // Use the authenticated user ID (ignore any userId from request body for security)
    const finalUserId = authenticatedUserId;

    // Get transactions for the specified date range
    console.log("📊 Expense Summary: Fetching transactions from", finalStartDate, "to", finalEndDate);

    const { data: transactions, error } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', finalUserId)
      .gte('date', finalStartDate)
      .lte('date', finalEndDate)
      .order('date', { ascending: false });

    if (error) {
      console.error("📊 Expense Summary: Database error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log("📊 Expense Summary: Found", transactions?.length || 0, "transactions");

    if (!transactions || transactions.length === 0) {
      const periodLabel = getPeriodLabel(finalStartDate, finalEndDate);
      return new Response(
        JSON.stringify({ 
          success: true, 
          summary: `No transactions found for ${periodLabel}. Start tracking your expenses to get personalized insights! 💰\n\nTip: Try adding a transaction like "Bought coffee for ₹150" in the chat to get started.`,
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
      .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || '';
    
    const topIncomeCategory = Object.entries(incomeByCategory)
      .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] || '';

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

    // Get user currency settings
    const { data: userSettings } = await supabase.rpc('get_user_budget_settings', { user_id_param: finalUserId });
    const currency = userSettings?.[0]?.currency || 'INR';
    const currencySymbol = userSettings?.[0]?.currency_symbol || '₹';

    // Create enhanced summary prompt for AI
    const periodLabel = getPeriodLabel(finalStartDate, finalEndDate);
    const summaryPrompt = `You are Spendly, a comprehensive financial wellness coach and certified financial advisor. Create an in-depth financial analysis and coaching report for ${periodLabel} based on this data:

📊 COMPREHENSIVE FINANCIAL ANALYSIS:
- Total Income: ${currencySymbol}${totalIncome.toFixed(2)}
- Total Expenses: ${currencySymbol}${totalExpenses.toFixed(2)}
- Net Savings: ${currencySymbol}${netSavings.toFixed(2)}
- Savings Rate: ${savingsRate.toFixed(1)}%
- Transaction Count: ${transactions.length}
- Active Days: ${daysWithTransactions} days
- Average Transaction: ${currencySymbol}${averageTransactionAmount.toFixed(2)}

💸 DETAILED SPENDING BREAKDOWN:
${Object.entries(expensesByCategory)
  .sort(([,a], [,b]) => (b as number) - (a as number))
  .slice(0, 5)
  .map(([cat, amt]) => `- ${cat}: ${currencySymbol}${(amt as number).toFixed(2)} (${((amt as number) / totalExpenses * 100).toFixed(1)}%)`)
  .join('\n')}

💰 INCOME ANALYSIS:
${Object.entries(incomeByCategory)
  .sort(([,a], [,b]) => (b as number) - (a as number))
  .slice(0, 3)
  .map(([cat, amt]) => `- ${cat}: ${currencySymbol}${(amt as number).toFixed(2)}`)
  .join('\n')}

🎯 COMPREHENSIVE FINANCIAL COACHING FRAMEWORK:

1. **FINANCIAL HEALTH ASSESSMENT**: 
   - Analyze savings rate against benchmarks (Excellent >20%, Good 10-20%, Needs Improvement <10%)
   - Evaluate spending patterns and identify trends
   - Assess financial stability and risk factors

2. **PERSONALIZED RECOMMENDATIONS** (provide 3-4 specific, actionable strategies):
   - Budget optimization based on spending patterns
   - Savings enhancement strategies
   - Investment suggestions based on savings rate and goals
   - Risk management advice

3. **INVESTMENT GUIDANCE** (based on financial profile):
   - Emergency fund recommendations (3-6 months expenses)
   - Investment allocation suggestions (equity/debt mix)
   - Specific investment vehicles (SIPs, index funds, etc.)
   - Timeline-based investment strategies

4. **FINANCIAL EDUCATION** (teach key concepts):
   - Explain the importance of identified financial behaviors
   - Share relevant financial principles
   - Provide context for recommendations

5. **BEHAVIORAL INSIGHTS**:
   - Identify positive financial habits to reinforce
   - Point out areas for behavioral improvement
   - Suggest habit formation strategies

6. **NEXT STEPS & GOALS**:
   - Specific actions to take in the next 30 days
   - Long-term financial planning suggestions
   - Goal-setting recommendations

RESPONSE GUIDELINES:
- Start with encouraging recognition of positive behaviors
- Use specific numbers and percentages from the data
- Provide actionable, implementable advice
- Include educational explanations for WHY certain actions are beneficial
- Suggest specific investment amounts and strategies
- Address potential financial risks
- End with motivation and clear next steps
- Keep tone professional yet encouraging
- Use ${currencySymbol} for all currency amounts
- Aim for 300-400 words for comprehensive coverage

INVESTMENT RECOMMENDATIONS FRAMEWORK:
- If savings rate >20%: Aggressive investment strategy, equity-heavy portfolio
- If savings rate 10-20%: Balanced approach, moderate risk investments
- If savings rate 5-10%: Conservative growth, focus on savings first
- If savings rate <5%: Emergency fund priority, expense optimization focus
- If negative savings: Debt management, expense reduction, income enhancement

SPECIFIC COACHING AREAS TO ADDRESS:
- Expense optimization opportunities in top spending categories
- Income enhancement strategies if applicable
- Emergency fund adequacy
- Investment diversification
- Tax-saving opportunities
- Insurance and risk coverage
- Long-term wealth building strategies

Create a comprehensive financial coaching report that provides real value and actionable insights:`;

    console.log("📊 Expense Summary: Calling OpenAI API...");

    // Call OpenAI API with timeout
    const openaiController = new AbortController();
    const openaiTimeout = setTimeout(() => openaiController.abort(), 20000); // Increased timeout for comprehensive response

    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${Deno.env.get('OPENAI_API_KEY')}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-4', // Using GPT-4 for more sophisticated financial coaching
          messages: [
            {
              role: 'system',
              content: 'You are Spendly, a comprehensive financial wellness coach and certified financial advisor. Provide detailed, professional, and actionable financial advice with educational insights. Your responses should be thorough, personalized, and focused on long-term financial wellness.'
            },
            {
              role: 'user',
              content: summaryPrompt
            }
          ],
          temperature: 0.7,
          max_tokens: 600, // Increased for comprehensive responses
        }),
        signal: openaiController.signal,
      });

      clearTimeout(openaiTimeout);

      if (!openaiResponse.ok) {
        console.error("📊 Expense Summary: OpenAI API error:", openaiResponse.status);
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      const aiSummary = openaiData.choices[0]?.message?.content;
      
      if (!aiSummary) {
        throw new Error("No response from OpenAI");
      }

      console.log("📊 Expense Summary: AI summary generated successfully");

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
      console.error("📊 Expense Summary: OpenAI error:", openaiError);
      
      // Fallback to local summary if OpenAI fails
      const fallbackSummary = generateFallbackSummary(periodLabel, summaryData, currencySymbol);
      
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
    console.error('📊 Expense Summary: Error:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        summary: "Unable to generate your expense summary right now. Please try again later."
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});

function getPeriodLabel(startDate: string, endDate: string): string {
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  // Check if it's the same month and year
  if (start.getMonth() === end.getMonth() && start.getFullYear() === end.getFullYear()) {
    return start.toLocaleString('default', { month: 'long', year: 'numeric' });
  }
  
  // Check if it's the same year
  if (start.getFullYear() === end.getFullYear()) {
    return `${start.toLocaleString('default', { month: 'short' })} - ${end.toLocaleString('default', { month: 'short' })} ${start.getFullYear()}`;
  }
  
  // Different years
  return `${start.toLocaleDateString()} - ${end.toLocaleDateString()}`;
}

function generateFallbackSummary(periodLabel: string, data: SummaryData, currencySymbol: string): string {
  let summary = `🎉 Here's your ${periodLabel} financial summary!\n\n`;
  
  summary += `💰 Income: ${currencySymbol}${data.totalIncome.toLocaleString()}\n`;
  summary += `💸 Expenses: ${currencySymbol}${data.totalExpenses.toLocaleString()}\n`;
  summary += `📈 Net Savings: ${currencySymbol}${data.netSavings.toLocaleString()}\n`;
  summary += `📊 Savings Rate: ${data.savingsRate.toFixed(1)}%\n\n`;
  
  if (data.netSavings > 0) {
    summary += `🌟 Great job! You saved money this period. `;
    if (data.savingsRate >= 20) {
      summary += `Your ${data.savingsRate.toFixed(1)}% savings rate is excellent!`;
    } else if (data.savingsRate >= 10) {
      summary += `Your ${data.savingsRate.toFixed(1)}% savings rate is solid!`;
    } else {
      summary += `Try to increase your savings rate next time.`;
    }
  } else {
    summary += `💡 You spent more than you earned this period. Let's work on reducing expenses!`;
  }
  
  if (data.topSpendingCategory) {
    const topAmount = data.expensesByCategory[data.topSpendingCategory];
    summary += `\n\n🏆 Top spending: ${data.topSpendingCategory} (${currencySymbol}${topAmount.toLocaleString()})`;
    
    if (data.topSpendingCategory === 'Dining' || data.topSpendingCategory === 'Food') {
      summary += `\n💡 Tip: Try meal prepping to reduce food expenses!`;
    } else if (data.topSpendingCategory === 'Shopping') {
      summary += `\n💡 Tip: Consider a 24-hour rule before non-essential purchases!`;
    } else if (data.topSpendingCategory === 'Entertainment') {
      summary += `\n💡 Tip: Look for free or low-cost entertainment options!`;
    }
  }

  return summary;
}