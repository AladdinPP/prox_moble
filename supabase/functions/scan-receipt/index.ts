import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface ScanReceiptRequest {
  image: string; // base64 encoded image
}

interface ReceiptItem {
  name: string;
  category: string;
  price?: string;
  quantity?: string;
}

interface ScanReceiptResponse {
  items: ReceiptItem[];
}

serve(async (req) => {
  console.log('Function called with method:', req.method, 'URL:', req.url);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    console.log('Handling OPTIONS request');
    return new Response(null, {
      status: 200,
      headers: corsHeaders
    });
  }

  // Only allow POST requests
  if (req.method !== 'POST') {
    console.log('Rejecting non-POST request:', req.method);
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    console.log('Processing POST request');

    // Check for OpenAI API key
    const openAIApiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openAIApiKey) {
      console.log('OpenAI API key not configured, returning mock data');
      // Return mock data for testing when API key is not set
      const mockItems: ReceiptItem[] = [
        { name: 'Organic Bananas', category: 'Produce', price: '2.99', quantity: '1 lb' },
        { name: 'Whole Milk', category: 'Dairy', price: '3.49', quantity: '1 gal' },
        { name: 'Ground Turkey', category: 'Meat', price: '5.99', quantity: '1 lb' },
        { name: 'Sourdough Bread', category: 'Pantry', price: '4.99', quantity: '1 loaf' },
      ];

      return new Response(JSON.stringify({ items: mockItems }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { image }: ScanReceiptRequest = await req.json();

    if (!image) {
      console.log('No image provided in request');
      return new Response(JSON.stringify({ error: 'Image is required', items: [] }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Scanning receipt image with OpenAI');

    const systemPrompt = `You are an expert at reading grocery receipts and extracting item information.

Your task is to:
1. Identify all grocery items on the receipt
2. Extract the item name, categorize it, and include price/quantity if clearly visible
3. Categorize items into: Produce, Dairy, Meat, Pantry, Frozen, Beverages, Snacks, Personal Care, Household, Other
4. Return only valid JSON with the specified format
5. If an item name is unclear or abbreviated, make your best guess for the full product name
6. Ignore non-grocery items like taxes, fees, store promotions, etc.

Return only a JSON object in this exact format:
{
  "items": [
    {
      "name": "Item Name",
      "category": "Category",
      "price": "Price (optional)",
      "quantity": "Quantity (optional)"
    }
  ]
}`;

    const userPrompt = `Please analyze this grocery receipt image and extract all grocery items with their details. Focus on actual grocery products and ignore taxes, fees, or store-specific promotions.`;

    const openAIResponse = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openAIApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userPrompt },
              {
                type: 'image_url',
                image_url: {
                  url: image,
                  detail: 'high'
                }
              }
            ]
          }
        ],
        temperature: 0.1,
        max_tokens: 1000,
      }),
    });

    if (!openAIResponse.ok) {
      const errorText = await openAIResponse.text();
      console.error('OpenAI API error:', errorText);
      throw new Error(`OpenAI API error: ${openAIResponse.status} ${openAIResponse.statusText}`);
    }

    const data = await openAIResponse.json();
    const content = data.choices?.[0]?.message?.content;

    if (!content) {
      throw new Error('No content received from OpenAI');
    }

    console.log('OpenAI response:', content);

    let parsedResponse: ScanReceiptResponse;
    try {
      parsedResponse = JSON.parse(content);
    } catch (parseError) {
      console.error('Failed to parse OpenAI response:', parseError);
      // Try to extract JSON from the response if it's wrapped in markdown or other text
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsedResponse = JSON.parse(jsonMatch[0]);
      } else {
        throw new Error('Invalid JSON response from OpenAI');
      }
    }

    // Validate the response structure
    if (!parsedResponse.items || !Array.isArray(parsedResponse.items)) {
      throw new Error('Invalid response structure from OpenAI');
    }

    console.log('Extracted items:', parsedResponse.items);

    return new Response(JSON.stringify(parsedResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in scan-receipt function:', error);
    return new Response(
      JSON.stringify({
        error: error.message || 'Internal server error',
        items: []
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }
})