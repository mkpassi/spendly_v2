// Follow this setup guide to integrate the Deno language server with your editor:
// https://deno.land/manual/getting_started/setup_your_environment
// This enables autocomplete, go to definition, etc.

// Setup type definitions for built-in Supabase Runtime APIs
import "jsr:@supabase/functions-js/edge-runtime.d.ts"

console.log("Hello from Functions!")

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, apikey",
  "Access-Control-Max-Age": "86400",
};

interface ParsedGoal {
  title: string;
  target_amount: number;
  target_date: string | null;
  confidence: number;
}

serve(async (req: Request) => {
  console.log("🎯 Parse Goal: Function invoked");
  
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    // Parse request body
    const { text } = await req.json();
    console.log("🎯 Parse Goal: Processing text:", text);

    if (!text || typeof text !== 'string') {
      console.log("🎯 Parse Goal: Invalid input - no text provided");
      return new Response(
        JSON.stringify({ 
          success: true, 
          isGoal: false, 
          error: "No text provided" 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Get user authentication
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
      console.log("🎯 Parse Goal: No valid auth header");
      return new Response(
        JSON.stringify({ success: false, error: "Authentication required" }),
        { status: 401, headers: corsHeaders }
      );
    }

    const token = authHeader.replace('Bearer ', '');
    
    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from JWT token
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.log("🎯 Parse Goal: User authentication failed:", userError);
      return new Response(
        JSON.stringify({ success: false, error: "Invalid authentication" }),
        { status: 401, headers: corsHeaders }
      );
    }

    console.log("🎯 Parse Goal: User authenticated:", user.id);

    // Use AI to parse the goal - NO PRE-FILTERING, let AI handle everything
    console.log("🎯 Parse Goal: Calling OpenAI for comprehensive goal analysis...");
    
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const prompt = `You are a comprehensive goal detection AI that helps people of all ages (5-70) identify savings goals from natural language.

MISSION: Detect if the user wants to save money for something specific. Be INCLUSIVE and COMPREHENSIVE.

USER MESSAGE: "${text}"

COMPREHENSIVE ANALYSIS RULES:
1. 🎯 DETECT ANY SAVINGS INTENT - Look for ANY indication someone wants to save money for something
2. 💰 FLEXIBLE AMOUNT DETECTION - Accept ANY amount format: $500, 500 dollars, five hundred, Rs 1000, 1k, etc.
3. 🌍 UNIVERSAL PURPOSES - Accept ANY saving purpose from toys to medical bills to dream vacations
4. 📅 FLEXIBLE DATES - Parse ANY time expression: "next month", "by Christmas", "in 2 years", "when I turn 18"
5. 🗣️ NATURAL LANGUAGE - Handle casual speech, typos, different languages mixed with English
6. 👶 ALL AGES - From kids saving for toys to seniors saving for medical expenses

VALID GOAL EXAMPLES (be this inclusive):
- "I want to save $500 for a vacation" ✅
- "Need 1000 dollars for emergency fund" ✅
- "Planning to save money for birthday party" ✅ (even without specific amount)
- "Want to buy a toy that costs 50 dollars" ✅
- "Saving for my daughter's wedding" ✅
- "Need money for medical bills" ✅
- "Want to save for a new phone" ✅
- "Collecting money for charity" ✅
- "Saving pocket money for games" ✅
- "Need to save for house down payment" ✅
- "Want to save some money for vacation" ✅ (even vague amounts)
- "Planning to save 500 rupees for books" ✅
- "I want to save for retirement" ✅
- "Saving for my kid's education" ✅
- "Want to save money for a surprise gift" ✅
- "Need to save for car repairs" ✅
- "Saving for a new laptop" ✅
- "Want to save for dental treatment" ✅
- "Planning to save for a trip to grandma's house" ✅
- "Need money for school supplies" ✅
- "Saving for a pet" ✅
- "Want to save for new clothes" ✅
- "Need to save for moving expenses" ✅
- "Saving for a hobby" ✅
- "Want to save for fitness equipment" ✅

AMOUNT PARSING - Be flexible but conservative:
- $500, 500 dollars, five hundred dollars, 500 bucks, 500 USD
- Rs 1000, 1000 rupees, thousand rupees
- 1k, 5K, 10k (interpret as 1000, 5000, 10000)
- "a few hundred" → null (ask user for specific amount)
- "some money" → null (ask user for specific amount)
- "a lot of money" → null (ask user for specific amount)
- "enough money" → null (ask user for specific amount)
- If no clear amount is specified → set target_amount to null

DATE PARSING - Be creative:
- "next month" → add 1 month to current date
- "by Christmas" → December 25th of current year
- "in 3 months" → add 3 months
- "next year" → same month next year
- "when I turn 18" → null (unknown specific date)
- "by summer" → June 21st of current year
- "before my birthday" → null (unknown birthday)

TITLE GENERATION - Make it descriptive and age-appropriate:
- "vacation" → "Vacation Fund"
- "toy" → "New Toy"
- "medical bills" → "Medical Expenses"
- "wedding" → "Wedding Fund"
- "education" → "Education Fund"
- "emergency" → "Emergency Fund"

RESPONSE FORMAT (JSON):
{
  "isGoal": true/false,
  "title": "descriptive title" or null,
  "target_amount": number or null,
  "target_date": "YYYY-MM-DD" or null,
  "confidence": 0-100 (how confident you are this is a goal),
  "reasoning": "brief explanation of your decision"
}

IMPORTANT: 
- Be GENEROUS in detecting goals - err on the side of inclusion
- If unsure, set isGoal: true and let the user confirm
- Don't be restrictive - people save for everything imaginable
- Consider cultural contexts (different currencies, customs)
- Handle typos and casual language gracefully

Analyze the message and respond with JSON only:`;

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
            content: prompt
          }
        ],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("🎯 Parse Goal: OpenAI API error:", errorText);
      throw new Error(`OpenAI API error: ${errorText}`);
    }

    const openaiData = await openaiResponse.json();
    console.log("🎯 Parse Goal: OpenAI response:", openaiData);

    const aiResponse = openaiData.choices[0]?.message?.content;
    if (!aiResponse) {
      throw new Error('No response from OpenAI');
    }

    // Parse the AI response
    let parsedGoal: ParsedGoal;
    try {
      // Clean up the response in case it has extra text
      const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
      const jsonStr = jsonMatch ? jsonMatch[0] : aiResponse;
      const parsed = JSON.parse(jsonStr);
      
      parsedGoal = {
        title: parsed.title,
        target_amount: parsed.target_amount,
        target_date: parsed.target_date,
        confidence: parsed.confidence || 0
      };
      
      console.log("🎯 Parse Goal: AI parsed result:", parsedGoal);
      console.log("🎯 Parse Goal: AI reasoning:", parsed.reasoning);
    } catch (parseError) {
      console.error("🎯 Parse Goal: Failed to parse AI response:", parseError);
      console.log("🎯 Parse Goal: Raw AI response:", aiResponse);
      
      // Return as not a goal if we can't parse the AI response
      return new Response(
        JSON.stringify({ 
          success: true, 
          isGoal: false, 
          error: "Failed to parse AI response" 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Check if AI detected a goal
    if (!parsedGoal || parsedGoal.confidence < 30) {
      console.log("🎯 Parse Goal: AI determined this is not a goal (low confidence)");
      return new Response(
        JSON.stringify({ 
          success: true, 
          isGoal: false, 
          confidence: parsedGoal?.confidence || 0 
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // AI detected a goal! Check if we have enough information to create it
    console.log("🎯 Parse Goal: AI detected a goal, checking completeness...");
    
    const goalTitle = parsedGoal.title || 'Savings Goal';
    
    // If no target amount is specified, ask for it (don't check duplicates yet)
    if (!parsedGoal.target_amount || parsedGoal.target_amount <= 0) {
      console.log("🎯 Parse Goal: Goal detected but no target amount, asking user...");
      
      const askAmountMessage = `🎯 **Great! I can help you save for ${goalTitle.toLowerCase()}!**

How much would you like to save for this goal? 

💡 **Examples:**
• "$500"
• "1000 dollars"
• "2500"

Just tell me the target amount and I'll set up your savings goal! 💪`;

      // Store the user message and AI response in chat history
      const chatMessages = [
        {
          user_id: user.id,
          message: text,
          sender: 'user',
          created_at: new Date().toISOString(),
        },
        {
          user_id: user.id,
          message: askAmountMessage,
          sender: 'ai',
          created_at: new Date().toISOString(),
        }
      ];

      const { error: chatError } = await supabase
        .from('chat_messages')
        .insert(chatMessages);

      if (chatError) {
        console.error("🎯 Parse Goal: Chat message insert error:", chatError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          isGoal: true,
          needsAmount: true,
          goalTitle: goalTitle,
          message: askAmountMessage
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Now we have a complete goal with amount - check for duplicates
    console.log("🎯 Parse Goal: Goal has amount, checking for duplicates...");
    
    const { data: isDuplicate, error: duplicateError } = await supabase
      .rpc('check_duplicate_goals', {
        user_id_param: user.id,
        title_param: goalTitle
      });

    if (duplicateError) {
      console.error("🎯 Parse Goal: Error checking duplicates:", duplicateError);
      throw duplicateError;
    }

    if (isDuplicate) {
      console.log("🎯 Parse Goal: Duplicate goal detected, asking for confirmation");
      
      const duplicateMessage = `🎯 **Duplicate Goal Detected!**

You already have an active goal called "${goalTitle}". 

**Options:**
1. **Modify existing goal**: Update the target amount or date
2. **Create new goal**: Give it a different name (e.g., "${goalTitle} 2025")
3. **Cancel**: Skip creating this goal

Please clarify what you'd like to do, or try again with a different goal name.`;

      // Store the user message and duplicate warning in chat history
      const chatMessages = [
        {
          user_id: user.id,
          message: text,
          sender: 'user',
          created_at: new Date().toISOString(),
        },
        {
          user_id: user.id,
          message: duplicateMessage,
          sender: 'ai',
          created_at: new Date().toISOString(),
        }
      ];

      const { error: chatError } = await supabase
        .from('chat_messages')
        .insert(chatMessages);

      if (chatError) {
        console.error("🎯 Parse Goal: Chat message insert error:", chatError);
      }

      return new Response(
        JSON.stringify({
          success: true,
          isGoal: false,
          isDuplicate: true,
          existingGoalTitle: goalTitle,
          message: duplicateMessage
        }),
        { status: 200, headers: corsHeaders }
      );
    }

    // Get user's budget settings to determine goal allocation
    console.log("🎯 Parse Goal: Getting user budget settings...");
    const { data: budgetSettings, error: budgetError } = await supabase
      .rpc('get_user_budget_settings', {
        user_id_param: user.id
      });

    if (budgetError) {
      console.error("🎯 Parse Goal: Error getting budget settings:", budgetError);
      throw budgetError;
    }

    const settings = budgetSettings?.[0] || { goals_percentage: 20.00 };
    
    // Get count of active goals to calculate default allocation
    const { data: activeGoals, error: activeGoalsError } = await supabase
      .from('goals')
      .select('id, title')
      .eq('user_id', user.id)
      .eq('is_active', true);

    if (activeGoalsError) {
      console.error("🎯 Parse Goal: Error getting active goals:", activeGoalsError);
      throw activeGoalsError;
    }

    const activeGoalCount = activeGoals?.length || 0;
    const defaultPercentageAllocation = activeGoalCount > 0 
      ? settings.goals_percentage / (activeGoalCount + 1) 
      : settings.goals_percentage;

    // Create the new goal
    console.log("🎯 Parse Goal: Creating new goal...");
    
    const goalData = {
      user_id: user.id,
      title: goalTitle,
      target_amount: parsedGoal.target_amount || 500,
      target_date: parsedGoal.target_date,
      allocated_amount: 0,
      percentage_allocation: defaultPercentageAllocation,
      is_active: true,
      status: 'active',
      created_at: new Date().toISOString(),
    };

    // Insert the goal into the database
    const { data: insertedGoal, error: insertError } = await supabase
      .from('goals')
      .insert([goalData])
      .select()
      .single();

    if (insertError) {
      console.error("🎯 Parse Goal: Database insert error:", insertError);
      throw insertError;
    }

    console.log("🎯 Parse Goal: Goal saved successfully:", insertedGoal);

    // Create confirmation message with allocation info
    const otherGoalsText = activeGoalCount > 0 
      ? `\n\n📊 **Budget Allocation Update:**\nYou have ${settings.goals_percentage}% allocated to goals. With ${activeGoalCount + 1} active goals, each gets ${defaultPercentageAllocation.toFixed(1)}% of your income.\n\n**Other Active Goals:**\n${activeGoals.map(g => `• ${g.title}`).join('\n')}`
      : `\n\n📊 **Budget Allocation:**\nYou have ${settings.goals_percentage}% allocated to goals. This goal will receive ${defaultPercentageAllocation.toFixed(1)}% of your income automatically.`;

    const confirmationMessage = `🎯 **Goal created successfully!**

**${insertedGoal.title}**: $${insertedGoal.target_amount.toLocaleString()}${insertedGoal.target_date ? `\n📅 Target Date: ${new Date(insertedGoal.target_date).toLocaleDateString()}` : ''}${otherGoalsText}

💡 **Next Steps:**
• Income will auto-allocate to your goals based on your budget settings
• You can adjust allocation percentages in Settings
• Specify custom amounts like "save $200 for vacation" for manual allocation

Your goal has been added to your tracker! Start saving and watch your progress grow. 💪✨`;

    // Store both user message and AI confirmation in chat history
    const chatMessages = [
      {
        user_id: user.id,
        message: text,
        sender: 'user',
        created_at: new Date().toISOString(),
      },
      {
        user_id: user.id,
        message: confirmationMessage,
        sender: 'ai',
        created_at: new Date().toISOString(),
      }
    ];

    const { error: chatError } = await supabase
      .from('chat_messages')
      .insert(chatMessages);

    if (chatError) {
      console.error("🎯 Parse Goal: Chat message insert error:", chatError);
      // Don't throw here - goal was saved successfully
    }

    console.log("🎯 Parse Goal: Chat messages saved successfully");

    // Return success response
  return new Response(
      JSON.stringify({
        success: true,
        isGoal: true,
        goal: insertedGoal,
        confidence: parsedGoal.confidence,
        message: confirmationMessage
      }),
      { status: 200, headers: corsHeaders }
    );

  } catch (error) {
    console.error("🎯 Parse Goal: Function error:", error);
    
    // Return a graceful error response
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "An unexpected error occurred",
        isGoal: false
      }),
      { status: 500, headers: corsHeaders }
    );
  }
});

/* To invoke locally:

  1. Run `supabase start` (see: https://supabase.com/docs/reference/cli/supabase-start)
  2. Make an HTTP request:

  curl -i --location --request POST 'http://127.0.0.1:54321/functions/v1/parse-goal' \
    --header 'Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0' \
    --header 'Content-Type: application/json' \
    --data '{"name":"Functions"}'

*/
