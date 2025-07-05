import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey, x-requested-with, accept, origin, referer, user-agent"
};

// Helper function to process transaction from AI response
async function processTransactionFromAI(aiResponse: string, userId: string, settings: any, activeGoals: any[], supabaseAdmin: any) {
  try {
    // Parse: "TRANSACTION: Job Payment|$5000|income|income|2025-07-05"
    const lines = aiResponse.split('\n');
    const transactionLine = lines[0].replace('TRANSACTION: ', '').trim();
    
    console.log("🔍 Raw transaction line:", transactionLine);
    
    const parts = transactionLine.split('|');
    console.log("🔍 Split parts:", parts);
    
    if (parts.length < 4) {
      console.error("❌ Invalid transaction format, not enough parts:", parts);
      return { success: false, response: "Invalid transaction format" };
    }
    
    // Handle different possible formats
    let description, amount, category, type, date;
    
    if (parts.length === 4) {
      // Format: description|amount|category|type
      [description, amount, category, type] = parts;
      date = new Date().toISOString().split('T')[0]; // Use today's date
    } else if (parts.length === 5) {
      // Format: description|amount|category|type|date
      [description, amount, category, type, date] = parts;
    } else {
      console.error("❌ Unexpected transaction format:", parts);
      return { success: false, response: "Unexpected transaction format" };
    }
    
    // Clean up the data
    description = description.trim();
    amount = amount.replace(/[$,]/g, '').trim(); // Remove $ and commas
    category = category.trim();
    type = type.trim();
    date = date?.trim() || new Date().toISOString().split('T')[0];
    
    console.log("💰 Cleaned transaction data:", { description, amount, category, type, date });
    
    // Validate amount
    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      console.error("❌ Invalid amount:", amount);
      return { success: false, response: "Invalid transaction amount" };
    }
    
    // Create the transaction with correct budget category
    const transaction = {
      user_id: userId,
      date: date,
      description: description,
      amount: Math.abs(numericAmount),
      category: category,
      type: type,
      source: 'ai_parsed',
      budget_category: 'expenses', // Income gets allocated to expenses, savings, goals; expenses default to expenses
      is_allocated: false
    };

    console.log("💰 Creating transaction:", transaction);

    const { data: insertedTransaction, error } = await supabaseAdmin
      .from('transactions')
      .insert([transaction])
      .select()
      .single();

    if (error) {
      console.error("❌ Error creating transaction:", error);
      console.error("❌ Transaction data that failed:", transaction);
      return { success: false, response: `Failed to create transaction: ${error.message}` };
    }

    console.log("✅ Transaction created successfully:", insertedTransaction);

    // Handle income auto-allocation
    if (type === 'income') {
      const incomeAmount = Math.abs(numericAmount);
      const savingsAmount = (incomeAmount * settings.savings_percentage) / 100;
      const goalsAmount = (incomeAmount * settings.goals_percentage) / 100;

      console.log("💰 Auto-allocation amounts:", { incomeAmount, savingsAmount, goalsAmount });

      // Create allocation transactions
      const allocationTransactions = [];

      if (savingsAmount > 0) {
        allocationTransactions.push({
          user_id: userId,
          date: date,
          description: `Auto-allocated to savings from ${description}`,
          amount: savingsAmount,
          category: 'Savings',
          type: 'expense',
          source: 'auto_allocated',
          budget_category: 'savings',
          is_allocated: true
        });
      }

      if (goalsAmount > 0 && activeGoals && activeGoals.length > 0) {
        const perGoalAmount = goalsAmount / activeGoals.length;
        for (const goal of activeGoals) {
          allocationTransactions.push({
            user_id: userId,
            date: date,
            description: `Auto-allocated to ${goal.title} from ${description}`,
            amount: perGoalAmount,
            category: 'Goals',
            type: 'expense',
            source: 'auto_allocated',
            budget_category: 'goals',
            is_allocated: true
          });
        }
      }

      if (allocationTransactions.length > 0) {
        console.log("💰 Creating allocation transactions:", allocationTransactions.length);
        const { data: allocatedTransactions, error: allocError } = await supabaseAdmin
          .from('transactions')
          .insert(allocationTransactions)
          .select();

        if (allocError) {
          console.error("❌ Error creating allocation transactions:", allocError);
        } else {
          console.log("✅ Allocation transactions created:", allocatedTransactions?.length);
          
          if (allocatedTransactions && activeGoals && activeGoals.length > 0) {
            // Create goal allocations
            const goalAllocations = [];
            const goalTransactions = allocatedTransactions.filter(tx => tx.budget_category === 'goals');
            
            for (const goalTransaction of goalTransactions) {
              const goalTitle = goalTransaction.description.match(/Auto-allocated to (.+) from/)?.[1];
              const matchingGoal = activeGoals.find(g => g.title === goalTitle);
              
              if (matchingGoal) {
                goalAllocations.push({
                  user_id: userId,
                  goal_id: matchingGoal.id,
                  transaction_id: goalTransaction.id,
                  amount: goalTransaction.amount,
                  allocation_type: 'auto',
                  allocation_date: goalTransaction.date,
                  notes: `Auto-allocated from income: ${description}`
                });
              }
            }

            if (goalAllocations.length > 0) {
              console.log("🎯 Creating goal allocations:", goalAllocations.length);
              const { error: goalAllocError } = await supabaseAdmin
                .from('goal_allocations')
                .insert(goalAllocations);
              
              if (goalAllocError) {
                console.error("❌ Error creating goal allocations:", goalAllocError);
              } else {
                console.log("✅ Goal allocations created successfully");
              }
            }
          }
        }
      }

      // Mark original transaction as allocated
      const { error: updateError } = await supabaseAdmin
        .from('transactions')
        .update({ is_allocated: true })
        .eq('id', insertedTransaction.id);
      
      if (updateError) {
        console.error("❌ Error updating transaction allocation status:", updateError);
      } else {
        console.log("✅ Transaction marked as allocated");
      }
    }

    return { success: true, response: "Transaction processed successfully" };
    
  } catch (error) {
    console.error("❌ Error in processTransactionFromAI:", error);
    return { success: false, response: `Error processing transaction: ${error.message}` };
  }
}

// Helper function to process goal from AI response
async function processGoalFromAI(aiResponse: string, userId: string, supabaseAdmin: any) {
  // Parse: "GOAL: vacation|2000|20"
  const lines = aiResponse.split('\n');
  const goalLine = lines[0].replace('GOAL: ', '');
  const [title, target_amount, percentage] = goalLine.split('|');
  
  console.log("🎯 Parsed goal:", { title, target_amount, percentage });
  
  // Check for duplicates
  const { data: existingGoals } = await supabaseAdmin
    .from('goals')
    .select('id, title, is_active')
    .eq('user_id', userId)
    .ilike('title', title.trim());

  if (existingGoals && existingGoals.length > 0) {
    const activeGoal = existingGoals.find(g => g.is_active);
    if (activeGoal) {
      // Return LLM-generated duplicate warning message
      const duplicateResponse = lines.slice(1).join('\n').trim();
      return {
        success: false,
        response: duplicateResponse || `🎯 You already have an active goal called "${activeGoal.title}". Would you like to modify it or create a new goal with a different name?`
      };
    }
  }

  // Create the goal
  const goal = {
    user_id: userId,
    title: title.trim(),
    target_amount: parseFloat(target_amount),
    allocated_amount: 0,
    percentage_allocation: parseFloat(percentage) || 20,
    is_active: true,
    created_at: new Date().toISOString()
  };

  const { data: insertedGoal, error } = await supabaseAdmin
    .from('goals')
    .insert([goal])
    .select()
    .single();

  if (error) {
    console.error("❌ Error creating goal:", error);
    throw new Error(`Failed to create goal: ${error.message}`);
  }

  // Return the AI's response (everything after the first line)
  const response = lines.slice(1).join('\n').trim();
  return { success: true, response: response };
}

serve(async (req) => {
  console.log(`🚀 Chat-response function called: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    console.log("✅ CORS preflight request handled");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Parse request
    const { message } = await req.json();
    console.log("💬 Received message:", message);
    
    if (!message) {
      throw new Error("No message provided");
    }

    // Initialize Supabase client
    console.log("🔗 Initializing Supabase client...");
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Get user authentication
    console.log("🔐 Getting user authentication...");
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      throw new Error("Authentication required");
    }

    const token = authHeader.replace('Bearer ', '');
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    
    if (authError || !user) {
      console.error("❌ Auth error:", authError);
      throw new Error("Invalid authentication");
    }

    const userId = user.id;
    console.log("✅ User authenticated:", userId);

    // Get user settings and active goals
    console.log("📊 Fetching user settings and goals...");
    const [settingsResult, goalsResult] = await Promise.all([
      supabaseAdmin.rpc('get_user_budget_settings', { user_id_param: userId }),
      supabaseAdmin.from('goals').select('*').eq('user_id', userId).eq('is_active', true)
    ]);

    console.log("📊 Settings result:", settingsResult);
    console.log("🎯 Goals result:", goalsResult);

    const settingsData = settingsResult.data?.[0] || { 
      expenses_percentage: 50, 
      savings_percentage: 30, 
      goals_percentage: 20,
      currency: 'INR',
      currency_symbol: '₹'
    };
    
    const settings = {
      expenses_percentage: settingsData.expenses_percentage,
      savings_percentage: settingsData.savings_percentage,
      goals_percentage: settingsData.goals_percentage,
      currency: settingsData.currency,
      currency_symbol: settingsData.currency_symbol
    };
    
    const activeGoals = goalsResult.data || [];
    const activeGoalsList = activeGoals.length > 0 
      ? activeGoals.map(g => `${g.title} (${settings.currency_symbol}${g.allocated_amount}/${settings.currency_symbol}${g.target_amount})`).join(', ')
      : 'None';

    console.log("📊 Final settings:", settings);
    console.log("🎯 Active goals:", activeGoals.length, "goals");

    // Fetch user's actual financial data for personalized advice
    console.log("💰 Fetching user's financial data...");
    const currentDate = new Date();
    const threeMonthsAgo = new Date(currentDate.getFullYear(), currentDate.getMonth() - 3, 1);
    const currentMonthStart = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    
    const [transactionsResult, monthlyStatsResult] = await Promise.all([
      // Get recent transactions for pattern analysis
      supabaseAdmin
        .from('transactions')
        .select('*')
        .eq('user_id', userId)
        .gte('date', threeMonthsAgo.toISOString().split('T')[0])
        .order('date', { ascending: false }),
      
      // Get monthly financial summary
      supabaseAdmin
        .from('transactions')
        .select('type, amount, budget_category')
        .eq('user_id', userId)
        .gte('date', currentMonthStart.toISOString().split('T')[0])
    ]);

    const recentTransactions = transactionsResult.data || [];
    const currentMonthTransactions = monthlyStatsResult.data || [];
    
    // Calculate financial metrics
    const totalIncome = currentMonthTransactions
      .filter(t => t.type === 'income')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const totalExpenses = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((sum, t) => sum + t.amount, 0);
    
    const currentSavingsRate = totalIncome > 0 ? ((totalIncome - totalExpenses) / totalIncome) * 100 : 0;
    
    // Calculate category-wise spending
    const expensesByCategory = currentMonthTransactions
      .filter(t => t.type === 'expense')
      .reduce((acc, t) => {
        acc[t.category] = (acc[t.category] || 0) + t.amount;
        return acc;
      }, {});
    
    const topExpenseCategories = Object.entries(expensesByCategory)
      .sort(([,a], [,b]) => (b as number) - (a as number))
      .slice(0, 3)
      .map(([category, amount]) => `${category}: ${settings.currency_symbol}${amount}`)
      .join(', ');

    // Calculate emergency fund status
    const monthlyExpenses = totalExpenses;
    const emergencyFundTarget = monthlyExpenses * 6; // 6 months of expenses
    const currentSavings = currentMonthTransactions
      .filter(t => t.budget_category === 'savings')
      .reduce((sum, t) => sum + t.amount, 0);
    
    // Goal progress
    const goalProgress = activeGoals.map(g => {
      const progressPercentage = g.target_amount > 0 ? (g.allocated_amount / g.target_amount) * 100 : 0;
      return `${g.title}: ${progressPercentage.toFixed(1)}% (${settings.currency_symbol}${g.allocated_amount}/${settings.currency_symbol}${g.target_amount})`;
    }).join(', ');

    console.log("📊 Financial metrics calculated:", {
      totalIncome,
      totalExpenses,
      currentSavingsRate,
      topExpenseCategories,
      emergencyFundTarget,
      currentSavings,
      goalProgress
    });

    // Get recent chat history for context
    console.log("💬 Fetching chat history...");
    const { data: recentMessages } = await supabaseAdmin
      .from('chat_messages')
      .select('message, sender')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6);

    console.log("💬 Chat history:", recentMessages?.length || 0, "messages");

    // Enhanced LLM system prompt with comprehensive financial coaching
    const systemPrompt = `You are Spendly, an advanced AI Financial Wellness Coach and Personal Finance Assistant. You are a certified financial advisor with expertise in investment planning, budgeting, and wealth management.

CRITICAL: You MUST return ONLY valid JSON. NO other text before or after the JSON.

YOUR ROLE & EXPERTISE:
🎯 **PRIMARY FUNCTIONS:**
- Personal Financial Coach & Advisor
- Investment Strategy Consultant  
- Budget & Expense Optimization Expert
- Goal-Based Financial Planning Specialist
- Financial Education & Literacy Coach

🧠 **INTELLIGENT CLASSIFICATION:**
You have the intelligence to understand user intent and classify queries appropriately:

1. **INVESTMENT & FINANCIAL ADVICE QUERIES:**
   - Any question about investing, investments, financial planning, wealth building
   - Questions about specific assets (real estate, stocks, mutual funds, crypto, etc.)
   - "Should I invest in...", "Can I afford...", "Is it good to invest...", "Will I be able to invest..."
   - Portfolio advice, risk assessment, market analysis requests
   - Response: Provide comprehensive personalized investment advice using their actual financial data

2. **GOAL SETTING QUERIES:**
   - Saving intentions with specific purposes and amounts
   - "I want to save X for Y", "My goal is to...", "I need to save for..."
   - Future financial objectives with targets
   - Response: Create appropriate financial goal with smart allocation

3. **TRANSACTION LOGGING QUERIES:**
   - Past/present financial actions with specific amounts
   - "I bought X for Y", "Got paid Z", "Spent A on B"
   - Expense/income reporting with clear amounts and descriptions
   - Response: Log transaction and provide contextual financial insights

4. **GENERAL FINANCIAL COACHING:**
   - Budgeting help, expense optimization, financial health analysis
   - Educational questions about finance, money management tips
   - Response: Comprehensive financial coaching with actionable advice

USER'S COMPLETE FINANCIAL PROFILE:
📊 **CURRENT FINANCIAL STATUS:**
- Monthly Income: ${settings.currency_symbol}${totalIncome.toLocaleString()}
- Monthly Expenses: ${settings.currency_symbol}${totalExpenses.toLocaleString()}
- Net Monthly Savings: ${settings.currency_symbol}${(totalIncome - totalExpenses).toLocaleString()}
- Current Savings Rate: ${currentSavingsRate.toFixed(1)}%
- Emergency Fund Target: ${settings.currency_symbol}${emergencyFundTarget.toLocaleString()} (6 months expenses)
- Current Emergency Fund: ${settings.currency_symbol}${currentSavings.toLocaleString()}

📈 **SPENDING ANALYSIS:**
- Top Expense Categories: ${topExpenseCategories || 'No expenses recorded yet'}
- Budget Allocation: ${settings.expenses_percentage}% expenses, ${settings.savings_percentage}% savings, ${settings.goals_percentage}% goals
- Currency: ${settings.currency} (${settings.currency_symbol})

🎯 **GOALS & OBJECTIVES:**
- Active Goals: ${goalProgress || 'No active goals set'}
- Goal Allocation: ${settings.goals_percentage}% of income automatically allocated

💰 **PERSONALIZED INVESTMENT STRATEGY:**
Based on ${currentSavingsRate.toFixed(1)}% savings rate and ${settings.currency_symbol}${totalIncome.toLocaleString()} monthly income:

${currentSavingsRate > 20 ? 
  `🚀 **AGGRESSIVE WEALTH BUILDING PROFILE**
  - Exceptional savings discipline! You're in the top 5% of savers
  - Investment Capacity: ${settings.currency_symbol}${Math.round(totalIncome * 0.15).toLocaleString()}-${settings.currency_symbol}${Math.round(totalIncome * 0.25).toLocaleString()} monthly
  - Strategy: 70-80% equity allocation for maximum growth
  - Emergency Fund: ${settings.currency_symbol}${emergencyFundTarget.toLocaleString()} in high-yield accounts
  - Advanced Options: International diversification, sector funds, tax optimization
  - Real Estate: Can consider direct property investment with ${settings.currency_symbol}${Math.round(totalIncome * 12).toLocaleString()}+ annual income` :
currentSavingsRate > 10 ? 
  `📈 **BALANCED GROWTH PROFILE**
  - Solid financial foundation with good savings habits
  - Investment Capacity: ${settings.currency_symbol}${Math.round(totalIncome * 0.08).toLocaleString()}-${settings.currency_symbol}${Math.round(totalIncome * 0.15).toLocaleString()} monthly
  - Strategy: 60% equity, 40% debt for balanced risk-return
  - Emergency Fund: Priority to reach ${settings.currency_symbol}${emergencyFundTarget.toLocaleString()}
  - Focus: Goal-based investing, systematic wealth building
  - Real Estate: REITs and real estate mutual funds recommended` :
currentSavingsRate > 5 ? 
  `🛡️ **CONSERVATIVE STABILITY PROFILE**
  - Building financial stability, room for optimization
  - Investment Capacity: ${settings.currency_symbol}${Math.round(totalIncome * 0.03).toLocaleString()}-${settings.currency_symbol}${Math.round(totalIncome * 0.08).toLocaleString()} monthly
  - Strategy: 40% equity, 60% debt for lower risk
  - Priority: Emergency fund building, expense optimization
  - Recommendations: Start small, focus on financial discipline
  - Real Estate: Avoid direct property, consider REITs after emergency fund` :
currentSavingsRate >= 0 ?
  `💡 **FOUNDATION BUILDING PROFILE**
  - Early stage of financial journey, focus on basics
  - Investment Capacity: ${settings.currency_symbol}${Math.round(totalIncome * 0.02).toLocaleString()}-${settings.currency_symbol}${Math.round(totalIncome * 0.05).toLocaleString()} monthly
  - Strategy: Conservative debt funds, FDs, small equity exposure
  - Priority: Emergency fund (${settings.currency_symbol}${Math.round(emergencyFundTarget * 0.5).toLocaleString()}), expense control
  - Focus: Financial literacy, habit building, income enhancement
  - Real Estate: Not recommended until financial stability achieved` :
  `🚨 **FINANCIAL RECOVERY PROFILE**
  - Immediate attention needed for financial health
  - Investment Capacity: Focus on positive cash flow first
  - Strategy: Debt management, expense reduction, income enhancement
  - Priority: Stop financial bleeding, create budget discipline
  - Action Plan: Reduce top expenses (${topExpenseCategories})
  - Real Estate: Avoid all investments until positive savings rate achieved`
}

RESPONSE GUIDELINES:
🎯 **FOR INVESTMENT QUERIES:**
- Always reference their specific financial data
- Provide investment amounts based on their actual capacity
- Address emergency fund status and goal alignment
- Consider risk tolerance based on savings rate
- Explain WHY recommendations fit their profile
- Include specific next steps with amounts
- Address risks and mitigation strategies

🎯 **FOR GOAL QUERIES:**
- Create realistic goals based on their income/savings capacity
- Suggest appropriate allocation percentages
- Provide timeline estimates based on their savings rate
- Include motivational and educational elements

🎯 **FOR TRANSACTION QUERIES:**
- Log accurately with appropriate categorization
- Provide immediate financial insights
- Suggest optimizations based on spending patterns
- Reference their budget allocation and goals

🎯 **FOR GENERAL COACHING:**
- Use their actual financial data for personalized advice
- Provide specific, actionable recommendations
- Include educational insights and explanations
- Suggest concrete next steps for improvement

MANDATORY JSON RESPONSE FORMAT:
{
  "actions": [
    {
      "type": "transaction|goal",
      "description": "Clear description",
      "amount": 0.00,
      "category": "Appropriate category",
      "transaction_type": "income|expense",
      "date": "YYYY-MM-DD",
      "title": "Goal title (only for goals)",
      "target_amount": 0.00,
      "percentage_allocation": 20
    }
  ],
  "response": "Comprehensive, personalized financial coaching response with specific data-driven advice"
}

EXAMPLES OF INTELLIGENT RESPONSES:

**Investment Query Example:**
User: "Will I am able to invest in Dubai real estate?"
Response: {"actions":[],"response":"Based on your financial profile - ${settings.currency_symbol}${totalIncome.toLocaleString()} monthly income with ${currentSavingsRate.toFixed(1)}% savings rate - here's my analysis for Dubai real estate: 🏠 **AFFORDABILITY ASSESSMENT**: International property investment requires substantial capital and carries currency/regulatory risks. **YOUR CAPACITY**: With ${settings.currency_symbol}${Math.round(totalIncome * 12).toLocaleString()} annual income, direct property investment abroad is challenging. **SMART ALTERNATIVES**: 1) Build emergency fund to ${settings.currency_symbol}${emergencyFundTarget.toLocaleString()} first 2) Start with REITs for real estate exposure (${settings.currency_symbol}${Math.round(totalIncome * 0.10).toLocaleString()}/month) 3) Consider domestic real estate mutual funds 4) Focus on diversified portfolio building. **TIMELINE**: Once you have ${settings.currency_symbol}${Math.round(totalIncome * 24).toLocaleString()} in liquid investments, international real estate becomes viable. Would you like specific REIT recommendations for your portfolio? 📈"}

**Goal Setting Example:**
User: "I want to save 50000 for vacation"
Response: {"actions":[{"type":"goal","title":"Dream Vacation","target_amount":50000,"percentage_allocation":15}],"response":"Excellent goal! 🌴 I've created your Dream Vacation goal of ${settings.currency_symbol}50,000. **TIMELINE ANALYSIS**: With your current ${currentSavingsRate.toFixed(1)}% savings rate, you're saving ${settings.currency_symbol}${Math.round((totalIncome - totalExpenses) * 0.15).toLocaleString()}/month toward goals. **PROJECTED TIMELINE**: You'll reach this goal in approximately ${Math.round(50000 / ((totalIncome - totalExpenses) * 0.15)).toFixed(0)} months. **OPTIMIZATION TIPS**: 1) Consider increasing goal allocation to 20% to reach it faster 2) Look for additional income sources 3) Optimize your top expenses: ${topExpenseCategories}. Your vacation fund is now auto-allocating from your income! 🎯"}

**Transaction Example:**
User: "bought groceries for 850"
Response: {"actions":[{"type":"transaction","description":"Groceries","amount":850,"category":"Groceries","transaction_type":"expense","date":"${new Date().toISOString().split('T')[0]}"}],"response":"Tracked your ${settings.currency_symbol}850 grocery expense! 🛒 **SPENDING ANALYSIS**: This represents ${((850/totalExpenses)*100).toFixed(1)}% of your monthly expenses. **OPTIMIZATION INSIGHT**: With ${settings.currency_symbol}${Math.round(850 * 4).toLocaleString()} monthly grocery spending, you could save ${settings.currency_symbol}200-300/month with: 1) Meal planning and bulk buying 2) Seasonal produce shopping 3) Generic brand alternatives. **IMPACT**: Reducing grocery costs by 15% would free up ${settings.currency_symbol}${Math.round(850 * 4 * 0.15).toLocaleString()}/month for your goals! Your current savings rate is ${currentSavingsRate.toFixed(1)}% - every optimization counts! 💪"}

CORE PRINCIPLES:
- Use intelligent understanding to classify user intent
- Always provide data-driven, personalized advice
- Reference actual financial metrics in every response
- Include specific amounts and actionable recommendations
- Maintain encouraging but realistic tone
- Focus on financial education and empowerment
- Return only valid JSON with no extra text`;

    // Log the complete system prompt for debugging
    console.log("🤖 SYSTEM PROMPT GENERATED:");
    console.log("=====================================");
    console.log(systemPrompt);
    console.log("=====================================");
    
    // Log user message
    console.log("👤 USER MESSAGE:", message);

    // Call OpenAI
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) {
      throw new Error("OpenAI API key not configured");
    }

    console.log("🤖 Calling OpenAI API...");
    
    // Build conversation history - use minimal context to avoid AI reverting to natural language
    const conversationHistory = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: message }
    ];

    console.log("🤖 CONVERSATION HISTORY SENT TO OPENAI:");
    console.log("=====================================");
    console.log(JSON.stringify(conversationHistory, null, 2));
    console.log("=====================================");

    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4',
        messages: conversationHistory,
        max_tokens: 1000,
        temperature: 0.7,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("❌ OpenAI API error:", openaiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponse = openaiData.choices[0]?.message?.content || '';
    
    console.log("🤖 RAW OPENAI RESPONSE:");
    console.log("=====================================");
    console.log(aiResponse);
    console.log("=====================================");

    // Parse the AI response
    let parsedResponse: any;
    
    try {
      parsedResponse = JSON.parse(aiResponse);
      console.log("✅ Successfully parsed LLM response:", parsedResponse);
    } catch (parseError) {
      console.error("❌ Failed to parse LLM response as JSON:", parseError);
      console.error("❌ Raw response:", aiResponse);
      
      // Try to extract JSON from the response if it's wrapped in text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        try {
          parsedResponse = JSON.parse(jsonMatch[0]);
          console.log("✅ Successfully extracted JSON from response:", parsedResponse);
        } catch (extractError) {
          console.error("❌ Failed to extract JSON:", extractError);
          // Fallback to plain text response
          parsedResponse = {
            actions: [],
            response: aiResponse.replace(/[{}[\]"]/g, '').trim() || "I had trouble processing that request. Could you try rephrasing it?"
          };
        }
      } else {
        // Fallback to plain text response
        parsedResponse = {
          actions: [],
          response: aiResponse.replace(/[{}[\]"]/g, '').trim() || "I had trouble processing that request. Could you try rephrasing it?"
        };
      }
    }

    const { actions = [], response: finalResponse } = parsedResponse;
    console.log("🎯 Extracted actions:", actions);
    console.log("💬 Final response:", finalResponse);

    console.log("🔍 RESPONSE PROCESSING:");
    console.log("=====================================");
    console.log("Actions found:", actions.length);
    console.log("Response text:", finalResponse);
    console.log("=====================================");

    // Execute the actions (either from LLM or fallback)
    let transactionsCreated = 0;
    let goalsCreated = 0;
    
    for (let i = 0; i < actions.length; i++) {
      const action = actions[i];
      console.log(`🔄 Processing action ${i + 1}/${actions.length}:`, action);
      
      try {
        if (action.type === 'transaction') {
          console.log("💰 Processing transaction:", action);
          
          // Validate required fields
          if (!action.description || !action.amount || !action.category || !action.transaction_type || !action.date) {
            console.error("❌ Missing required transaction fields:", action);
            continue;
          }
          
          // Create the main transaction
          const transaction = {
            user_id: userId,
            date: action.date,
            description: action.description,
            amount: Math.abs(parseFloat(action.amount)),
            category: action.category,
            type: action.transaction_type,
            source: 'ai_chat',
            budget_category: 'expenses', // Income gets allocated to expenses, savings, goals; expenses default to expenses
            is_allocated: false
          };

          console.log("💰 Creating transaction with data:", transaction);

          const { data: insertedTransaction, error } = await supabaseAdmin
            .from('transactions')
            .insert([transaction])
            .select()
            .single();

          if (error) {
            console.error("❌ Transaction creation error:", error);
            console.error("❌ Transaction data that failed:", transaction);
            continue;
          }

          console.log("✅ Transaction created successfully:", insertedTransaction);
          transactionsCreated++;

          // If it's income, create auto-allocation transactions
          if (action.transaction_type === 'income') {
            console.log("💰 Creating auto-allocations for income...");
            
            const allocations: any[] = [];
            const amount = parseFloat(action.amount);
            
            console.log("💰 Income amount:", amount);
            console.log("💰 Settings:", settings);
            
            // Create savings allocation
            const savingsAmount = (amount * settings.savings_percentage) / 100;
            console.log("💰 Savings amount:", savingsAmount);
            
            if (savingsAmount > 0) {
              allocations.push({
                user_id: userId,
                date: action.date,
                description: `Auto-allocation: Savings (${settings.savings_percentage}%)`,
                amount: savingsAmount,
                category: 'Savings',
                type: 'expense',
                source: 'auto_allocation',
                budget_category: 'savings',
                is_allocated: true
              });
            }

            // Create goals allocation
            const goalsAmount = (amount * settings.goals_percentage) / 100;
            console.log("💰 Goals amount:", goalsAmount);
            console.log("💰 Active goals count:", activeGoals.length);
            
            if (goalsAmount > 0 && activeGoals.length > 0) {
              const perGoalAmount = goalsAmount / activeGoals.length;
              console.log("💰 Per goal amount:", perGoalAmount);
              
              for (const goal of activeGoals) {
                allocations.push({
                  user_id: userId,
                  date: action.date,
                  description: `Auto-allocation: ${goal.title} (${settings.goals_percentage}%)`,
                  amount: perGoalAmount,
                  category: 'Goal Contribution',
                  type: 'expense',
                  source: 'auto_allocation',
                  budget_category: 'goals',
                  is_allocated: true
                });
              }
            }

            console.log("💰 Total allocations to create:", allocations.length);
            console.log("💰 Allocation details:", allocations);

            // Insert all allocations
            if (allocations.length > 0) {
              const { data: insertedAllocations, error: allocError } = await supabaseAdmin
                .from('transactions')
                .insert(allocations)
                .select();
              
              if (allocError) {
                console.error("❌ Auto-allocation error:", allocError);
                console.error("❌ Allocation data that failed:", allocations);
              } else {
                console.log("✅ Auto-allocations created successfully:", insertedAllocations?.length || 0);
                transactionsCreated += insertedAllocations?.length || 0;
                
                // Now create goal allocations for the goal transactions
                const goalTransactions = insertedAllocations?.filter(tx => tx.budget_category === 'goals') || [];
                if (goalTransactions.length > 0 && activeGoals.length > 0) {
                  console.log("🎯 Creating goal allocations for", goalTransactions.length, "transactions");
                  
                  const goalAllocations: any[] = [];
                  for (const goalTransaction of goalTransactions) {
                    // Extract goal title from transaction description
                    const goalTitleMatch = goalTransaction.description.match(/Auto-allocation: (.+?) \(/);
                    if (goalTitleMatch) {
                      const goalTitle = goalTitleMatch[1];
                      const matchingGoal = activeGoals.find(g => g.title === goalTitle);
                      
                      if (matchingGoal) {
                        goalAllocations.push({
                          user_id: userId,
                          goal_id: matchingGoal.id,
                          transaction_id: goalTransaction.id,
                          amount: goalTransaction.amount,
                          allocation_type: 'auto',
                          allocation_date: goalTransaction.date,
                          notes: `Auto-allocated from income: ${action.description}`
                        });
                      }
                    }
                  }
                  
                  if (goalAllocations.length > 0) {
                    console.log("🎯 Inserting", goalAllocations.length, "goal allocations");
                    const { error: goalAllocError } = await supabaseAdmin
                      .from('goal_allocations')
                      .insert(goalAllocations);
                    
                    if (goalAllocError) {
                      console.error("❌ Goal allocation error:", goalAllocError);
                    } else {
                      console.log("✅ Goal allocations created successfully");
                    }
                  }
                }
              }
            }
          }

        } else if (action.type === 'goal') {
          console.log("🎯 Processing goal:", action);
          
          // Validate required fields
          if (!action.title) {
            console.error("❌ Missing goal title:", action);
            continue;
          }
          
          // Check for duplicates
          const { data: existingGoals } = await supabaseAdmin
            .from('goals')
            .select('*')
            .eq('user_id', userId)
            .eq('is_active', true)
            .ilike('title', action.title);

          if (existingGoals && existingGoals.length > 0) {
            console.log("⚠️ Duplicate goal found, skipping creation:", action.title);
            continue;
          }

          // Create goal
          const goal = {
            user_id: userId,
            title: action.title,
            target_amount: parseFloat(action.target_amount) || 0,
            allocated_amount: 0,
            percentage_allocation: parseFloat(action.percentage_allocation) || 20,
            is_active: true,
            created_at: new Date().toISOString()
          };

          console.log("🎯 Creating goal with data:", goal);

          const { data: insertedGoal, error } = await supabaseAdmin
            .from('goals')
            .insert([goal])
            .select()
            .single();

          if (error) {
            console.error("❌ Goal creation error:", error);
            console.error("❌ Goal data that failed:", goal);
            continue;
          }

          console.log("✅ Goal created successfully:", insertedGoal);
          goalsCreated++;
        }

      } catch (actionError) {
        console.error(`❌ Error executing action ${i + 1}:`, actionError);
        console.error(`❌ Action that failed:`, action);
        // Continue with other actions even if one fails
      }
    }

    console.log(`🎉 Actions completed: ${transactionsCreated} transactions, ${goalsCreated} goals created`);

    // Store the chat messages in database
    console.log("💾 Storing chat messages...");
    
    const chatMessages = [
      {
        user_id: userId,
        message: message,
        sender: 'user',
        created_at: new Date().toISOString()
      },
      {
        user_id: userId,
        message: finalResponse,
        sender: 'ai',
        created_at: new Date().toISOString()
      }
    ];

    const { data: insertedMessages, error: chatError } = await supabaseAdmin
      .from('chat_messages')
      .insert(chatMessages)
      .select();

    if (chatError) {
      console.error("❌ Chat storage error:", chatError);
      console.error("❌ Chat data that failed:", chatMessages);
    } else {
      console.log("✅ Chat messages stored successfully:", insertedMessages?.length || 0);
    }

    // Note: Chat sessions are now managed by frontend when clearing chat
    // This keeps the current conversation in chat_messages for real-time display
    console.log("💾 Chat messages stored in chat_messages table for current conversation");

    console.log("🎉 Chat response completed successfully");

    return new Response(
      JSON.stringify({
        success: true,
        response: finalResponse,
        debug: {
          transactionsCreated,
          goalsCreated,
          actionsProcessed: actions.length,
        }
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 Error in chat-response function:', error);
    console.error('💥 Error stack:', error.stack);
    
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message,
        response: "I'm having trouble processing your request right now. Please try again in a moment! 😊"
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});