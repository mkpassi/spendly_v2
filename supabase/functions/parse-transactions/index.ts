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

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { text } = await req.json();
    
    if (!text || typeof text !== 'string') {
      throw new Error("Valid text input is required");
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

    // Enhanced transaction parsing with OpenAI
    const openaiApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const systemPrompt = `You are a financial transaction parser for Spendly, an AI-powered financial wellness app. 

Your task is to parse natural language text into structured transaction data.

PARSING RULES:
1. Extract ONE transaction per input (if multiple mentioned, pick the most recent/specific)
2. Use today's date (2025-01-04) if no date is mentioned
3. Infer transaction type: "income" for earnings/salary/payments received, "expense" for purchases/bills/spending
4. Choose the most appropriate category from this list:
   - Groceries, Dining, Transportation, Utilities, Rent, Shopping, Entertainment, Health, Education, Salary, Other
5. Clean up the description to be concise but descriptive
6. Extract amount as a positive number (remove currency symbols)

EXAMPLES:
Input: "Bought coffee for $5.50 at Starbucks"
Output: {"date": "2025-01-04", "description": "Coffee at Starbucks", "amount": 5.50, "category": "Dining", "type": "expense"}

Input: "Got my salary today $3200"
Output: {"date": "2025-01-04", "description": "Monthly Salary", "amount": 3200, "category": "Salary", "type": "income"}

Input: "Paid rent yesterday $1200"
Output: {"date": "2025-01-03", "description": "Rent Payment", "amount": 1200, "category": "Rent", "type": "expense"}

Return ONLY a valid JSON object with the exact fields: date, description, amount, category, type.
If the text doesn't contain a clear transaction, return: {"error": "No clear transaction found"}`;

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
          },
          {
            role: 'user',
            content: text.trim()
          }
        ],
        temperature: 0.1,
        max_tokens: 200,
      }),
    });

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error('OpenAI API error:', openaiResponse.status, errorText);
      throw new Error(`OpenAI API error: ${openaiResponse.status}`);
    }

    const openaiData = await openaiResponse.json();
    const parsedContent = openaiData.choices[0]?.message?.content;
    
    if (!parsedContent) {
      throw new Error("No response from AI parser");
    }

    let transactionData: TransactionData;
    try {
      const parsed = JSON.parse(parsedContent.trim());
      
      // Check if parsing failed
      if (parsed.error) {
        throw new Error(parsed.error);
      }
      
      // Validate required fields
      if (!parsed.date || !parsed.description || !parsed.amount || !parsed.category || !parsed.type) {
        throw new Error("Incomplete transaction data parsed");
      }
      
      // Validate transaction type
      if (!['income', 'expense'].includes(parsed.type)) {
        throw new Error("Invalid transaction type");
      }
      
      // Validate amount is positive number
      if (isNaN(parsed.amount) || parsed.amount <= 0) {
        throw new Error("Invalid transaction amount");
      }
      
      transactionData = parsed;
    } catch (e) {
      console.error('JSON parsing error:', e);
      throw new Error("Failed to parse transaction from text");
    }

    // Store transaction in database
    const { data, error } = await supabase
      .from('transactions')
      .insert({
        user_id: userId,
        date: transactionData.date,
        description: transactionData.description,
        amount: transactionData.amount,
        category: transactionData.category,
        type: transactionData.type,
        source: 'chat'
      })
      .select()
      .single();

    if (error) {
      console.error('Database error:', error);
      throw new Error(`Failed to save transaction: ${error.message}`);
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        transactions: [data],
        count: 1,
        message: `Successfully parsed and saved ${transactionData.type} of $${transactionData.amount} for ${transactionData.description}`
      }),
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error in parse-transactions function:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        transactions: [],
        count: 0
      }),
      { 
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});