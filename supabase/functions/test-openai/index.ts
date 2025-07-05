import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization"
};

serve(async (req) => {
  console.log(`🧪 OpenAI Test function called: ${req.method} ${req.url}`);
  
  if (req.method === "OPTIONS") {
    console.log("✅ CORS preflight request handled");
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    // Check if OpenAI API key is available
    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    console.log("🔑 OpenAI API key available:", openaiKey ? "Yes" : "No");
    console.log("🔑 OpenAI API key first 10 chars:", openaiKey ? openaiKey.substring(0, 10) + "..." : "None");
    
    if (!openaiKey) {
      return new Response(JSON.stringify({
        success: false,
        error: "OpenAI API key not configured",
        details: "OPENAI_API_KEY environment variable is missing"
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    console.log("🤖 Testing OpenAI API connection...");
    
    // Simple test message
    const testMessage = {
      model: 'gpt-3.5-turbo',
      messages: [
        {
          role: 'system',
          content: 'You are a helpful assistant. Respond with exactly: "OpenAI API is working correctly!"'
        },
        {
          role: 'user',
          content: 'Test message'
        }
      ],
      max_tokens: 50,
      temperature: 0
    };

    console.log("📡 Sending request to OpenAI...");
    const startTime = Date.now();
    
    const openaiResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(testMessage)
    });

    const endTime = Date.now();
    const responseTime = endTime - startTime;
    
    console.log("📡 OpenAI response status:", openaiResponse.status);
    console.log("⏱️ Response time:", responseTime, "ms");

    if (!openaiResponse.ok) {
      const errorText = await openaiResponse.text();
      console.error("❌ OpenAI API error:", openaiResponse.status, errorText);
      
      return new Response(JSON.stringify({
        success: false,
        error: `OpenAI API error: ${openaiResponse.status}`,
        details: errorText,
        responseTime: responseTime
      }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      });
    }

    const openaiData = await openaiResponse.json();
    console.log("🎯 OpenAI response received:", JSON.stringify(openaiData, null, 2));
    
    const aiResponse = openaiData.choices[0]?.message?.content;
    
    return new Response(JSON.stringify({
      success: true,
      response: aiResponse,
      responseTime: responseTime,
      usage: openaiData.usage,
      model: openaiData.model,
      fullResponse: openaiData
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error('💥 Error in OpenAI test:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message,
      stack: error.stack
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
}); 