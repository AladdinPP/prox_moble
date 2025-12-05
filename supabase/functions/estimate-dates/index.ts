import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const openAIApiKey = Deno.env.get('OPENAI_API_KEY');

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface EstimateRequest {
  name: string;
  category: string;
  purchasedAt: string;
}

interface EstimateResponse {
  shelfLifeDays: number;
  restockDays: number;
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { name, category, purchasedAt }: EstimateRequest = await req.json();
    
    console.log('Estimating dates for:', { name, category, purchasedAt });

    if (!openAIApiKey) {
      throw new Error('OpenAI API key not configured');
    }

    const currentDate = new Date().toISOString().split('T')[0];
    
    const systemPrompt = `You are a food safety and household inventory expert. Your task is to predict realistic shelf life and household replenishment timing for grocery items.

Rules:
- Base expiration estimates on USDA food safety guidelines and typical storage conditions
- Consider that items are stored properly (refrigerated if needed, sealed containers, etc.)
- Restocking should be based on typical household consumption patterns
- Be conservative with perishable items for safety
- Cap all estimates within 365 days maximum
- Return only valid JSON with numeric values

Current date: ${currentDate}
Purchase date: ${purchasedAt}`;

    const userPrompt = `Estimate shelf life and restock timing for:
Item: "${name}"
Category: "${category}"

Return JSON format:
{
  "shelfLifeDays": <number of days from purchase date until expiration>,
  "restockDays": <number of days from purchase date until typical household needs restocking>
}`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.2,
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('OpenAI API error:', response.status, errorText);
      throw new Error(`OpenAI API error: ${response.status}`);
    }

    const data = await response.json();
    console.log('OpenAI response:', data);

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new Error('Invalid OpenAI response format');
    }

    const content = data.choices[0].message.content;
    let estimates: EstimateResponse;

    try {
      estimates = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', content);
      throw new Error('Invalid JSON response from OpenAI');
    }

    // Validation and sanitization
    const shelfLifeDays = Math.min(Math.max(1, Math.floor(estimates.shelfLifeDays)), 365);
    const restockDays = Math.min(Math.max(1, Math.floor(estimates.restockDays)), 365);

    const result = {
      shelfLifeDays,
      restockDays,
    };

    console.log('Final estimates:', result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in estimate-dates function:', error);
    
    return new Response(
      JSON.stringify({ 
        error: 'Failed to estimate dates',
        details: error.message 
      }), 
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
});