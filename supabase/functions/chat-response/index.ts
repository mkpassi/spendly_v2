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
    const { message } = await req.json();
    
    if (!message) {
      throw new Error("No message provided");
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
      return new Response(JSON.stringify({ error: 'Unauthorized' }), { status: 401, headers: corsHeaders });
    }
    const userId = user.id;

    // Get recent transactions for context
    const { data: transactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', userId)
      .order('date', { ascending: false })
      .limit(10);

    // Get recent goals for context
    const { data: goals } = await supabase
      .from('goals')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(5);

    // Create context for AI
    const contextPrompt = `You are Spendly, a friendly and encouraging AI financial wellness coach. 
    Your personality is warm, supportive, and motivational. You help users track expenses, set savings goals, and improve their financial health.
    
    Current user context:
    - Recent transactions: ${transactions ? JSON.stringify(transactions.slice(0, 5)) : 'None'}
    - Active goals: ${goals ? JSON.stringify(goals) : 'None'}
    
    Guidelines:
    - Be conversational and encouraging
    - Provide specific insights when possible
    - Keep responses under 100 words
    - Use emojis sparingly but effectively
    - If user mentions a transaction, acknowledge it positively
    - If user sets a goal, be enthusiastic and supportive
    - Provide actionable financial advice when appropriate
    
    User message: "${message}"`;

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
            content: contextPrompt
          }
        ],
        temperature: 0.7,
        max_tokens: 200,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const aiResponse = openaiData.choices[0]?.message?.content;
    
    if (!aiResponse) {
      throw new Error("No response from OpenAI");
    }

    // Store both user message and AI response
    const { error: userMsgError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        message: message,
        sender: 'user'
      });

    const { error: aiMsgError } = await supabase
      .from('chat_messages')
      .insert({
        user_id: userId,
        message: aiResponse,
        sender: 'ai'
      });

    if (userMsgError || aiMsgError) {
      console.error('Error storing messages:', userMsgError || aiMsgError);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        response: aiResponse 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error generating chat response:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        response: "I'm having trouble responding right now. Please try again!" 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});