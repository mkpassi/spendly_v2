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

    // Get recent chat history for context
    console.log("💬 Fetching chat history...");
    const { data: recentMessages } = await supabaseAdmin
      .from('chat_messages')
      .select('message, sender')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(6);

    console.log("💬 Chat history:", recentMessages?.length || 0, "messages");

    // Enhanced LLM system prompt with detailed goal detection criteria
    const systemPrompt = `You are a JSON-only API endpoint. You MUST return ONLY valid JSON. NO other text.

CONTEXT:
- Budget: ${settings.expenses_percentage}% expenses, ${settings.savings_percentage}% savings, ${settings.goals_percentage}% goals
- Active goals: ${activeGoalsList}
- User currency: ${settings.currency} (${settings.currency_symbol})
- Today's date: ${new Date().toISOString().split('T')[0]}

GOAL DETECTION CRITERIA:
A message should be classified as a GOAL if it contains:
1. FUTURE-ORIENTED SAVING INTENT: "want to save", "planning to save", "saving for", "goal to save"
2. SPECIFIC TARGET AMOUNT: "${settings.currency_symbol}5000", "five thousand ${settings.currency}", "10k", "₹50000", "$5000", etc.
3. SPECIFIC PURPOSE: "vacation", "car", "house", "emergency fund", "wedding", "laptop", etc.
4. GOAL KEYWORDS: "goal", "target", "save up", "put aside", "build up to"
5. TIMEFRAME INDICATORS: "by next year", "in 6 months", "for next summer"

GOAL EXAMPLES:
- "I want to save ${settings.currency_symbol}5000 for vacation" → GOAL
- "Planning to save ${settings.currency_symbol}10000 for a new car" → GOAL  
- "Create a goal to save ${settings.currency_symbol}3000 for laptop" → GOAL
- "I need to save up ${settings.currency_symbol}15000 for house down payment" → GOAL
- "Goal of ${settings.currency_symbol}8000 for emergency fund" → GOAL
- "Want to put aside ${settings.currency_symbol}2000 for wedding" → GOAL

TRANSACTION DETECTION CRITERIA:
A message should be classified as a TRANSACTION if it contains:
1. PAST/PRESENT ACTIONS: "bought", "paid", "spent", "got paid", "received", "earned"
2. SPECIFIC AMOUNT: "${settings.currency_symbol}50", "fifty ${settings.currency}", "₹500", "$50", etc.
3. SPECIFIC ITEM/SERVICE: "groceries", "gas", "salary", "dinner", "rent"
4. TRANSACTION KEYWORDS: "purchase", "payment", "expense", "income", "cost"

TRANSACTION EXAMPLES:
- "Bought groceries for ${settings.currency_symbol}85.50" → TRANSACTION
- "Paid ${settings.currency_symbol}45 for gas" → TRANSACTION
- "Got paid ${settings.currency_symbol}5000 salary" → TRANSACTION
- "Spent ${settings.currency_symbol}120 on dinner" → TRANSACTION
- "Received ${settings.currency_symbol}2000 bonus" → TRANSACTION

AMBIGUOUS CASES - DECISION LOGIC:
- "Save ${settings.currency_symbol}100 for groceries" → GOAL (future intent with specific purpose)
- "Put ${settings.currency_symbol}100 aside for groceries" → GOAL (saving behavior)
- "Spent ${settings.currency_symbol}100 on groceries" → TRANSACTION (past action)
- "Need ${settings.currency_symbol}100 for groceries" → CONVERSATION (no clear action)

MANDATORY JSON STRUCTURE:
{
  "actions": [
    {
      "type": "transaction|goal",
      "description": "Clean description",
      "amount": 0.00,
      "category": "Groceries|Dining|Transportation|Utilities|Rent|Shopping|Entertainment|Health|Education|Salary|Investment|Insurance|Travel|Gifts|Subscriptions|Fees|Other",
      "transaction_type": "income|expense",
      "date": "YYYY-MM-DD",
      "title": "Goal title (only for goals)",
      "target_amount": 0.00,
      "percentage_allocation": 20
    }
  ],
  "response": "Friendly response with emojis"
}

EXAMPLES WITH DETAILED ANALYSIS:

Input: "I want to save ${settings.currency_symbol}5000 for vacation next summer"
Analysis: Future intent (want to save) + Target amount (${settings.currency_symbol}5000) + Specific purpose (vacation) + Timeframe (next summer) = GOAL
Output: {"actions":[{"type":"goal","title":"Vacation","target_amount":5000,"percentage_allocation":20}],"response":"Excellent! 🎯 I've created your vacation goal of ${settings.currency_symbol}5,000. This goal will automatically receive 20% of your income. Start planning that amazing trip! ✈️"}

Input: "Bought groceries for ${settings.currency_symbol}85.50 at Whole Foods"
Analysis: Past action (bought) + Specific amount (${settings.currency_symbol}85.50) + Specific item (groceries) = TRANSACTION
Output: {"actions":[{"type":"transaction","description":"Groceries at Whole Foods","amount":85.50,"category":"Groceries","transaction_type":"expense","date":"${new Date().toISOString().split('T')[0]}"}],"response":"Got it! 🛒 I've recorded your ${settings.currency_symbol}85.50 grocery expense. Every ${settings.currency} tracked brings you closer to your financial goals! 💪"}

Input: "Got paid ${settings.currency_symbol}5000 salary"
Analysis: Past action (got paid) + Specific amount (${settings.currency_symbol}5000) + Income type (salary) = TRANSACTION
Output: {"actions":[{"type":"transaction","description":"Salary Payment","amount":5000,"category":"Salary","transaction_type":"income","date":"${new Date().toISOString().split('T')[0]}"}],"response":"Congratulations on your ${settings.currency_symbol}5,000 salary! 🎉 I've recorded it and it will be auto-allocated based on your budget settings. Your financial discipline is paying off! 💰"}

Input: "Create a goal to save ${settings.currency_symbol}10000 for emergency fund"
Analysis: Goal creation intent (create a goal) + Future saving (to save) + Target amount (${settings.currency_symbol}10000) + Specific purpose (emergency fund) = GOAL
Output: {"actions":[{"type":"goal","title":"Emergency Fund","target_amount":10000,"percentage_allocation":20}],"response":"Smart financial planning! 🛡️ I've created your Emergency Fund goal of ${settings.currency_symbol}10,000. This safety net will give you peace of mind and financial security! 💪"}

Input: "How much have I spent this month?"
Analysis: Question about spending (no transaction or goal creation) = CONVERSATION
Output: {"actions":[],"response":"I'd be happy to help you track your monthly spending! 📊 You can check your transactions in the 'Transactions' tab or ask me to add any recent expenses you'd like to record. What would you like to do?"}

CRITICAL RULES:
- Start response with { character
- End response with } character
- Use double quotes for all strings
- No trailing commas
- Valid JSON syntax only
- No text before or after JSON
- If no transaction/goal detected, use empty actions array []
- For goals, include title, target_amount, and percentage_allocation
- For transactions, include description, amount, category, transaction_type, and date
- Analyze the INTENT behind the message using the criteria above`;

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

    console.log("🤖 Conversation history length:", conversationHistory.length);
    
    // Retry logic with timeout
    let aiResponse;
    let retryCount = 0;
    const maxRetries = 3;
    
    while (retryCount < maxRetries) {
      try {
        console.log(`🔄 OpenAI API attempt ${retryCount + 1}/${maxRetries}`);
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout
        
        const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${openaiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'gpt-3.5-turbo',
            messages: conversationHistory,
            temperature: 0.3,
            max_tokens: 1000
          }),
          signal: controller.signal
        });

        clearTimeout(timeoutId);

        if (!openaiResponse.ok) {
          const errorText = await openaiResponse.text();
          console.error(`❌ OpenAI API error (attempt ${retryCount + 1}):`, openaiResponse.status, errorText);
          
          if (retryCount === maxRetries - 1) {
            throw new Error(`OpenAI API error after ${maxRetries} attempts: ${openaiResponse.status}`);
          }
          
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount)); // Exponential backoff
          continue;
        }

        const openaiData = await openaiResponse.json();
        aiResponse = openaiData.choices[0]?.message?.content;
        
        if (!aiResponse) {
          console.error(`❌ No response from OpenAI (attempt ${retryCount + 1})`);
          if (retryCount === maxRetries - 1) {
            throw new Error("No response from OpenAI after multiple attempts");
          }
          retryCount++;
          await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
          continue;
        }
        
        console.log("✅ OpenAI API call successful");
        break;
        
      } catch (error) {
        console.error(`❌ OpenAI API call failed (attempt ${retryCount + 1}):`, error);
        
        if (error.name === 'AbortError') {
          console.error("🕐 OpenAI API request timed out");
        }
        
        if (retryCount === maxRetries - 1) {
          throw new Error(`OpenAI API failed after ${maxRetries} attempts: ${error.message}`);
        }
        
        retryCount++;
        await new Promise(resolve => setTimeout(resolve, 1000 * retryCount));
      }
    }

    console.log("🎯 OpenAI raw response:", aiResponse);

    // Parse the LLM's structured response
    let parsedResponse;
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

    // Fallback strategy: If LLM failed to extract actions, try manual parsing
    let fallbackActions = [];
    let fallbackResponse = finalResponse;
    let usedFallback = false;
    
    if (!actions || actions.length === 0) {
      console.log("🚨 LLM returned empty actions - attempting manual transaction parsing as fallback");
      usedFallback = true;
      
      // Manual transaction parsing patterns
      const transactionPatterns = [
        // "bought/spent/paid X for Y" or "X for Y"
        /(?:bought|spent|paid|got|received|earned)\s+(?:\$?)(\d+(?:\.\d{2})?)\s+(?:for|on|at)\s+(.+)/i,
        // "$X for Y" or "Y for $X"
        /\$(\d+(?:\.\d{2})?)\s+(?:for|on|at)\s+(.+)/i,
        /(.+)\s+(?:for|cost|costed)\s+\$(\d+(?:\.\d{2})?)/i,
        // "Y $X" or "Y - $X"
        /(.+?)\s+[-–]\s*\$(\d+(?:\.\d{2})?)/i,
        /(.+?)\s+\$(\d+(?:\.\d{2})?)/i,
        // Income patterns
        /(?:got|received|earned|paid)\s+\$(\d+(?:\.\d{2})?)\s+(.+)/i,
        /\$(\d+(?:\.\d{2})?)\s+(?:salary|bonus|income|payment|freelance|work)/i,
      ];
      
      // Category mapping
      const categoryMap = {
        'groceries': 'Groceries', 'grocery': 'Groceries', 'food': 'Groceries',
        'gas': 'Transportation', 'fuel': 'Transportation', 'uber': 'Transportation', 'taxi': 'Transportation',
        'restaurant': 'Dining', 'dinner': 'Dining', 'lunch': 'Dining', 'breakfast': 'Dining', 'coffee': 'Dining',
        'rent': 'Rent', 'utilities': 'Utilities', 'electric': 'Utilities', 'water': 'Utilities',
        'shopping': 'Shopping', 'clothes': 'Shopping', 'amazon': 'Shopping',
        'movie': 'Entertainment', 'netflix': 'Entertainment', 'spotify': 'Entertainment',
        'salary': 'Salary', 'bonus': 'Salary', 'freelance': 'Salary', 'work': 'Salary', 'payment': 'Salary',
        'health': 'Health', 'doctor': 'Health', 'medicine': 'Health',
        'gym': 'Health', 'fitness': 'Health'
      };
      
      // Income keywords
      const incomeKeywords = ['salary', 'bonus', 'freelance', 'work', 'payment', 'income', 'earned', 'received', 'got paid'];
      
      // Goal detection patterns
      const goalPatterns = [
        /(?:save|saving|goal|target)\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:for|towards?)\s+(.+)/i,
        /(?:want to|need to|plan to)\s+save\s+\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:for|towards?)\s+(.+)/i,
        /(?:create|set up|make)\s+(?:a\s+)?goal\s+(?:to\s+save\s+)?\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+(?:for|towards?)\s+(.+)/i,
        /(?:create|set up|make)\s+(?:a\s+)?goal\s+for\s+(.+?)\s*[-–]\s*(?:target\s+)?\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
        /(?:goal|target)\s+(?:of\s+)?\$?(\d+(?:,\d{3})*(?:\.\d{2})?)\s+for\s+(.+)/i,
        /(.+?)\s+goal\s+[-–]\s*(?:target\s+)?\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i,
        /save\s+for\s+(.+?)\s*[-–]\s*\$?(\d+(?:,\d{3})*(?:\.\d{2})?)/i
      ];
      
      // Check for goal patterns first
      for (const pattern of goalPatterns) {
        const match = message.match(pattern);
        if (match) {
          console.log("🎯 Manual goal parsing found match:", match);
          
          let amount, title;
          
          if (match[1] && match[2]) {
            // Check if first capture is amount or title
            if (/^\d+(?:,\d{3})*(?:\.\d{2})?$/.test(match[1])) {
              amount = parseFloat(match[1].replace(/,/g, ''));
              title = match[2].trim();
            } else {
              amount = parseFloat(match[2].replace(/,/g, ''));
              title = match[1].trim();
            }
          }
          
          if (amount && title) {
            // Clean up title
            title = title.replace(/^\$/, '').replace(/\s+/g, ' ').trim();
            title = title.charAt(0).toUpperCase() + title.slice(1); // Capitalize first letter
            
            fallbackActions.push({
              type: 'goal',
              title: title,
              target_amount: amount,
              percentage_allocation: 20
            });
            
            fallbackResponse = `Excellent! 🎯 I've created your goal to save ${settings.currency_symbol}${amount.toLocaleString()} for ${title}. This goal will receive 20% of your income automatically. You're taking great steps toward your financial future! 💪`;
            
            console.log("✅ Manual goal parsing successful:", fallbackActions[0]);
            break;
          }
        }
      }
      
      // If no goal found, try transaction patterns
      if (fallbackActions.length === 0) {
        for (const pattern of transactionPatterns) {
          const match = message.match(pattern);
          if (match) {
            console.log("🔍 Manual parsing found match:", match);
            
            let amount, description;
            
            if (match[1] && match[2]) {
              // Check if first capture is amount or description
              if (/^\d+(\.\d{2})?$/.test(match[1])) {
                amount = parseFloat(match[1]);
                description = match[2].trim();
              } else {
                amount = parseFloat(match[2]);
                description = match[1].trim();
              }
            }
            
            if (amount && description) {
              // Determine transaction type
              const isIncome = incomeKeywords.some(keyword => 
                message.toLowerCase().includes(keyword.toLowerCase())
              );
              
              // Determine category
              let category = 'Other';
              const lowerDesc = description.toLowerCase();
              const lowerMessage = message.toLowerCase();
              
              for (const [keyword, cat] of Object.entries(categoryMap)) {
                if (lowerDesc.includes(keyword) || lowerMessage.includes(keyword)) {
                  category = cat;
                  break;
                }
              }
              
              // Clean up description
              description = description.replace(/^\$/, '').replace(/\s+/g, ' ').trim();
              if (description.length > 50) {
                description = description.substring(0, 50) + '...';
              }
              
              fallbackActions.push({
                type: 'transaction',
                description: description,
                amount: amount,
                category: category,
                transaction_type: isIncome ? 'income' : 'expense',
                date: new Date().toISOString().split('T')[0]
              });
              
              fallbackResponse = isIncome 
                ? `Great! 💰 I've recorded your ${settings.currency_symbol}${amount} ${description}. This income will be auto-allocated based on your budget settings!`
                : `Got it! 📝 I've recorded your ${settings.currency_symbol}${amount} expense for ${description}. Keep tracking your spending!`;
              
              console.log("✅ Manual parsing successful:", fallbackActions[0]);
              break;
            }
          }
        }
      }
      
      if (fallbackActions.length === 0) {
        console.log("❌ Manual parsing failed - no transaction patterns found");
        fallbackResponse = `I had trouble understanding that transaction. Could you try rephrasing it? For example: 'Bought groceries for ${settings.currency_symbol}50' or 'Got paid ${settings.currency_symbol}2000 salary'`;
      }
    }
    
    // Use fallback actions if LLM failed
    const finalActions = actions.length > 0 ? actions : fallbackActions;
    const finalResponseText = actions.length > 0 ? finalResponse : fallbackResponse;
    
    if (usedFallback && fallbackActions.length > 0) {
      console.log("🤖 LLM FAILED - Using manual fallback parsing for transaction creation");
    }

    // Execute the actions (either from LLM or fallback)
    let transactionsCreated = 0;
    let goalsCreated = 0;
    
    for (let i = 0; i < finalActions.length; i++) {
      const action = finalActions[i];
      console.log(`🔄 Processing action ${i + 1}/${finalActions.length}:`, action);
      
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
            
            const allocations = [];
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

                // Update goal progress
                console.log("🎯 Creating goal allocation for:", goal.title);
                const { error: goalAllocError } = await supabaseAdmin
                  .from('goal_allocations')
                  .insert({
                    goal_id: goal.id,
                    user_id: userId,
                    amount: perGoalAmount,
                    date: action.date,
                    transaction_id: insertedTransaction.id
                  });
                
                if (goalAllocError) {
                  console.error("❌ Goal allocation error:", goalAllocError);
                } else {
                  console.log("✅ Goal allocation created for:", goal.title);
                }
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
        message: finalResponseText,
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
        response: finalResponseText,
        debug: {
          transactionsCreated,
          goalsCreated,
          actionsProcessed: finalActions.length,
          usedFallback: usedFallback
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