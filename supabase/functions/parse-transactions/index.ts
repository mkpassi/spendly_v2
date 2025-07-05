import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

interface TransactionData {
  date: string;
  description: string;
  amount: number;
  category: string;
  type: 'income' | 'expense';
}

const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    
    if (!text) {
      throw new Error("No text provided");
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

    // Create OpenAI API call
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
            content: `You are a financial transaction parser. Parse the following text and return a JSON array of transaction objects with these exact fields:
            - date (YYYY-MM-DD format, use 2025-07-04 if missing)
            - description (clean, concise description)
            - amount (positive number only)
            - category (one of: Groceries, Dining, Transportation, Utilities, Rent, Shopping, Entertainment, Health, Education, Salary, Other)
            - type (strictly "income" or "expense", default to "expense" if unclear)
            
            Return ONLY valid JSON array, no other text.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!openaiResponse.ok) {
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const parsedContent = openaiData.choices[0]?.message?.content;
    
    if (!parsedContent) {
      throw new Error("No response from OpenAI");
    }

    let transactions: TransactionData[];
    try {
      transactions = JSON.parse(parsedContent);
      if (!Array.isArray(transactions)) {
        transactions = [transactions];
      }
    } catch (e) {
      throw new Error("Invalid JSON response from AI");
    }

    // Store transactions in database
    const { data, error } = await supabase
      .from('transactions')
      .insert(
        transactions.map(tx => ({
          user_id: userId,
          date: tx.date,
          description: tx.description,
          amount: tx.amount,
          category: tx.category,
          type: tx.type,
          source: 'manual'
        }))
      )
      .select();

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transactions: data,
        count: transactions.length 
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error parsing transactions:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message 
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});