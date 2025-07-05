import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, x-client-info, apikey, x-requested-with, accept, origin, referer, user-agent",
};

interface TransactionData {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
}

interface ParseResponse {
  success: boolean;
  isTransaction: boolean;
  transactions?: TransactionData[];
  count?: number;
  error?: string;
  confidence?: number;
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

// Enhanced transaction detection patterns
const TRANSACTION_PATTERNS = [
  /\$\d+/,                          // Dollar amounts
  /\d+\s*dollars?/i,                // "5 dollars"
  /\d+\s*bucks?/i,                  // "10 bucks"
  /(spent|paid|bought|earned|received|cost|charge)/i,
  /(income|salary|wage|bonus|refund)/i,
  /(expense|bill|fee|rent|groceries|gas|food)/i,
  /(transaction|payment|purchase|sale)/i,
  /\d+\.\d{2}/,                     // Decimal amounts
];

// Enhanced categories with more options
const VALID_CATEGORIES = [
  'Groceries', 'Dining', 'Transportation', 'Utilities', 'Rent', 'Shopping', 
  'Entertainment', 'Health', 'Education', 'Salary', 'Investment', 'Insurance',
  'Travel', 'Gifts', 'Subscriptions', 'Fees', 'Other'
];

function detectTransactionLikelihood(text: string): number {
  const lowerText = text.toLowerCase();
  let score = 0;
  
  // Check for transaction patterns
  for (const pattern of TRANSACTION_PATTERNS) {
    if (pattern.test(lowerText)) {
      score += 1;
    }
  }
  
  // Bonus for multiple indicators
  if (score >= 2) score += 1;
  
  // Convert to confidence percentage (0-100)
  return Math.min(score * 25, 100);
}

serve(async (req: Request) => {
  console.log(`🧮 Parse-transactions function called: ${req.method} ${req.url}`);
  console.log("📋 Request headers:", Object.fromEntries(req.headers.entries()));
  
  if (req.method === "OPTIONS") {
    console.log("✅ CORS preflight request handled");
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    console.log("📝 Parsing request body...");
    
    let requestBody;
    try {
      requestBody = await req.text();
      console.log("📄 Raw request body:", requestBody);
      console.log("📄 Request body length:", requestBody.length);
    } catch (textError) {
      console.error("❌ Error reading request body as text:", textError);
      throw new Error(`Failed to read request body: ${textError.message}`);
    }
    
    if (!requestBody || requestBody.trim() === '') {
      console.error("❌ Empty request body received");
      throw new Error("Empty request body");
    }
    
    let parsedBody;
    try {
      parsedBody = JSON.parse(requestBody);
      console.log("✅ Successfully parsed JSON:", parsedBody);
    } catch (parseError) {
      console.error("❌ JSON parse error:", parseError);
      console.error("❌ Problematic body:", requestBody);
      throw new Error(`Invalid JSON in request body: ${parseError.message}`);
    }
    
    const { text } = parsedBody;
    console.log("💬 Received text:", text);
    
    if (!text) {
      throw new Error("No text provided in parsed body");
    }

    // Step 1: Detect if this looks like a transaction
    const confidence = detectTransactionLikelihood(text);
    console.log(`🔍 Transaction detection confidence: ${confidence}%`);
    
    // If confidence is too low, return early
    if (confidence < 25) {
      console.log("❌ Low transaction confidence, skipping AI parsing");
      return new Response(
        JSON.stringify({ 
          success: true,
          isTransaction: false,
          confidence: confidence,
          message: "This doesn't appear to be a transaction. Use general chat instead."
        } as ParseResponse),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Initialize Supabase client
    console.log("🔗 Creating Supabase client...");
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    );
    
    // Get the user from the session
    console.log("👤 Getting user from session...");
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError) {
      console.error("❌ Error getting user:", userError);
      throw new Error(`Auth error: ${userError.message}`);
    }
    
    if (!user) {
      console.error("❌ No user found in session");
      return new Response(JSON.stringify({ 
        success: false,
        error: 'Unauthorized' 
      }), { 
        status: 401, 
        headers: corsHeaders 
      });
    }
    
    const userId = user.id;
    console.log("✅ User authenticated:", userId);

    // Check if OpenAI API key is available
    console.log("🔑 OpenAI API key available:", OPENAI_API_KEY ? "Yes" : "No");
    if (!OPENAI_API_KEY) {
      console.error("❌ OpenAI API key not configured");
      throw new Error("AI parsing service temporarily unavailable");
    }

    // Enhanced system prompt for better transaction parsing
    const systemPrompt = `You are a financial transaction parser. Your job is to analyze text and determine if it contains financial transactions.

IMPORTANT RULES:
1. If the text does NOT contain any financial transactions, respond with exactly: {"isTransaction": false}
2. If the text DOES contain transactions, extract them as a JSON array with these exact fields:
   - date (YYYY-MM-DD format, use today's date ${new Date().toISOString().split('T')[0]} if not specified)
   - description (clean, concise description of the transaction)
   - amount (positive number only, no currency symbols)
   - category (exactly one of: ${VALID_CATEGORIES.join(', ')})
   - type (strictly "income" or "expense")

EXAMPLES:
- "I bought coffee for $5" → [{"date": "${new Date().toISOString().split('T')[0]}", "description": "Coffee", "amount": 5, "category": "Dining", "type": "expense"}]
- "Got paid $2000 salary" → [{"date": "${new Date().toISOString().split('T')[0]}", "description": "Salary", "amount": 2000, "category": "Salary", "type": "income"}]
- "How are you today?" → {"isTransaction": false}

Return ONLY valid JSON, no other text or explanations.`;

    console.log("🤖 Calling OpenAI API for transaction parsing...");
    
    // Add timeout to prevent hanging
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    let aiResponse;
    try {
      const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'gpt-3.5-turbo',
          messages: [
            {
              role: 'system',
              content: systemPrompt
            },
            {
              role: 'user',
              content: text
            }
          ],
          temperature: 0.1,
          max_tokens: 500,
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);
      console.log("📡 OpenAI response status:", openaiResponse.status);

      if (!openaiResponse.ok) {
        const errorText = await openaiResponse.text();
        console.error("❌ OpenAI API error:", openaiResponse.status, errorText);
        throw new Error(`OpenAI API error: ${openaiResponse.status}`);
      }

      const openaiData = await openaiResponse.json();
      aiResponse = openaiData.choices[0]?.message?.content;
      console.log("🎯 OpenAI raw response:", aiResponse);
      
      if (!aiResponse) {
        throw new Error("No response from OpenAI");
      }

    } catch (fetchError) {
      clearTimeout(timeoutId);
      
      if (fetchError.name === 'AbortError') {
        console.error('🕐 OpenAI API request timed out');
        throw new Error('AI parsing timed out. Please try again.');
      }
      
      console.error('💥 OpenAI fetch error:', fetchError);
      throw new Error(`AI parsing failed: ${fetchError.message}`);
    }

    // Parse the AI response
    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
      console.log("✅ Parsed AI response:", parsedResponse);
    } catch (parseError) {
      console.error("❌ Failed to parse AI response as JSON:", parseError);
      console.error("❌ Problematic response:", aiResponse);
      throw new Error("Invalid response format from AI");
    }

    // Check if AI determined this is not a transaction
    if (parsedResponse.isTransaction === false) {
      console.log("🚫 AI determined this is not a transaction");
      return new Response(
        JSON.stringify({ 
          success: true,
          isTransaction: false,
          confidence: confidence,
          message: "This doesn't appear to be a transaction. Use general chat instead."
        } as ParseResponse),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Process transactions
    let transactions: TransactionData[] = [];
    if (Array.isArray(parsedResponse)) {
      transactions = parsedResponse;
    } else if (parsedResponse.isTransaction !== false) {
      // If it's not explicitly marked as non-transaction, treat as single transaction
      transactions = [parsedResponse];
    }

    if (transactions.length === 0) {
      console.log("🚫 No transactions found in AI response");
      return new Response(
        JSON.stringify({ 
          success: true,
          isTransaction: false,
          confidence: confidence,
          message: "No valid transactions found in the message."
        } as ParseResponse),
        { 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    console.log(`💾 Storing ${transactions.length} transactions in database...`);
    
    // Get user's budget settings for allocation
    const { data: budgetSettings, error: budgetError } = await supabase
      .rpc('get_user_budget_settings', {
        user_id_param: userId
      });

    if (budgetError) {
      console.error("❌ Error getting budget settings:", budgetError);
      throw budgetError;
    }

    const settings = budgetSettings?.[0] || { 
      expenses_percentage: 50.00, 
      savings_percentage: 30.00, 
      goals_percentage: 20.00 
    };

    // Validate and clean transactions before storing
    const validTransactions = transactions.filter(tx => {
      return tx.date && tx.description && tx.amount && tx.category && tx.type;
    }).map(tx => ({
      user_id: userId,
      date: tx.date,
      description: tx.description.trim(),
      amount: parseFloat(tx.amount.toString()),
      category: tx.category,
      type: tx.type,
      source: 'ai_parsed',
      budget_category: tx.type === 'income' ? 'expenses' : 'expenses', // Default to expenses, will be allocated below
      is_allocated: false
    }));

    if (validTransactions.length === 0) {
      console.log("❌ No valid transactions after validation");
      throw new Error("No valid transactions found after validation");
    }

    // Insert transactions first
    const { data: insertedTransactions, error } = await supabase
      .from('transactions')
      .insert(validTransactions)
      .select();

    if (error) {
      console.error("❌ Database error:", error);
      throw new Error(`Database error: ${error.message}`);
    }

    console.log("✅ Transactions stored successfully:", insertedTransactions?.length || 0);

    // Process income transactions for auto-allocation
    const incomeTransactions = insertedTransactions?.filter(tx => tx.type === 'income') || [];
    
    if (incomeTransactions.length > 0) {
      console.log(`💰 Processing ${incomeTransactions.length} income transactions for auto-allocation...`);
      
      // Get active goals for allocation
      const { data: activeGoals, error: goalsError } = await supabase
        .from('goals')
        .select('id, title, target_amount, allocated_amount, percentage_allocation')
        .eq('user_id', userId)
        .eq('is_active', true);

      if (goalsError) {
        console.error("❌ Error getting active goals:", goalsError);
        throw goalsError;
      }

      const totalActiveGoals = activeGoals?.length || 0;
      
      // Process each income transaction
      for (const incomeTransaction of incomeTransactions) {
        const incomeAmount = Math.abs(incomeTransaction.amount);
        
        // Calculate allocations based on percentages
        const savingsAmount = (incomeAmount * settings.savings_percentage) / 100;
        const goalsAmount = (incomeAmount * settings.goals_percentage) / 100;
        const expensesAmount = (incomeAmount * settings.expenses_percentage) / 100;
        
        console.log(`💰 Allocating income of $${incomeAmount}: Savings: $${savingsAmount.toFixed(2)}, Goals: $${goalsAmount.toFixed(2)}, Expenses: $${expensesAmount.toFixed(2)}`);
        
        // Create allocation transactions
        const allocationTransactions = [];
        
        // Add savings allocation
        if (savingsAmount > 0) {
          allocationTransactions.push({
            user_id: userId,
            date: incomeTransaction.date,
            description: `Auto-allocated to savings from ${incomeTransaction.description}`,
            amount: savingsAmount,
            category: 'Savings',
            type: 'expense',
            source: 'auto_allocated',
            budget_category: 'savings',
            is_allocated: true
          });
        }
        
        // Add goal allocations
        if (goalsAmount > 0 && totalActiveGoals > 0) {
          const perGoalAmount = goalsAmount / totalActiveGoals;
          
          for (const goal of activeGoals) {
            allocationTransactions.push({
              user_id: userId,
              date: incomeTransaction.date,
              description: `Auto-allocated to ${goal.title} from ${incomeTransaction.description}`,
              amount: perGoalAmount,
              category: 'Goals',
              type: 'expense',
              source: 'auto_allocated',
              budget_category: 'goals',
              is_allocated: true
            });
          }
        }
        
        // Insert allocation transactions
        if (allocationTransactions.length > 0) {
          const { data: allocatedTransactions, error: allocationError } = await supabase
            .from('transactions')
            .insert(allocationTransactions)
            .select();

          if (allocationError) {
            console.error("❌ Error creating allocation transactions:", allocationError);
            // Continue processing other transactions
          } else {
            console.log(`✅ Created ${allocatedTransactions?.length || 0} allocation transactions`);
            
            // Create goal allocations for goal-specific transactions
            const goalAllocations = [];
            const goalTransactions = allocatedTransactions?.filter(tx => tx.budget_category === 'goals') || [];
            
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
                  notes: `Auto-allocated from income: ${incomeTransaction.description}`
                });
              }
            }
            
            if (goalAllocations.length > 0) {
              const { error: goalAllocationError } = await supabase
                .from('goal_allocations')
                .insert(goalAllocations);

              if (goalAllocationError) {
                console.error("❌ Error creating goal allocations:", goalAllocationError);
              } else {
                console.log(`✅ Created ${goalAllocations.length} goal allocations`);
              }
            }
          }
        }
        
        // Mark the income transaction as allocated
        await supabase
          .from('transactions')
          .update({ is_allocated: true })
          .eq('id', incomeTransaction.id);
      }
    }

    // Store success message in chat
    const totalTransactions = (insertedTransactions?.length || 0) + (incomeTransactions.length > 0 ? incomeTransactions.length * 2 : 0); // Include allocation transactions
    const successMessage = `✅ Successfully parsed and saved ${validTransactions.length} transaction${validTransactions.length > 1 ? 's' : ''}:\n\n${validTransactions.map(tx => `• ${tx.description}: $${tx.amount} (${tx.category})`).join('\n')}\n\n${incomeTransactions.length > 0 ? `💰 Auto-allocated income to your budget categories based on your settings (${settings.expenses_percentage}% expenses, ${settings.savings_percentage}% savings, ${settings.goals_percentage}% goals).\n\n` : ''}Your transactions have been added to your financial tracking!`;
    
    const { error: chatError } = await supabase
      .from('chat_messages')
      .insert([
        {
          user_id: userId,
          message: text,
          sender: 'user'
        },
        {
          user_id: userId,
          message: successMessage,
          sender: 'ai'
        }
      ]);

    if (chatError) {
      console.error('❌ Error storing chat messages:', chatError);
      // Don't throw here, just log the error
    } else {
      console.log("✅ Chat messages stored successfully");
    }

    return new Response(
      JSON.stringify({ 
        success: true,
        isTransaction: true,
        transactions: insertedTransactions,
        count: validTransactions.length,
        confidence: confidence,
        message: successMessage
      } as ParseResponse),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('💥 Error in parse-transactions function:', error);
    
    // Handle specific error types
    if (error.name === 'AbortError') {
      return new Response(
        JSON.stringify({ 
          success: false,
          isTransaction: false,
          error: 'AI parsing timed out. Please try again.'
        } as ParseResponse),
        { 
          status: 408,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        isTransaction: false,
        error: error.message
      } as ParseResponse),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});