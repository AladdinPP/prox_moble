import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

interface IdentifyItemsRequest {
  image: string; // base64 encoded image
}

interface IdentifiedItem {
  name: string;
  category: string;
}

interface IdentifyItemsResponse {
  items: IdentifiedItem[];
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
      const mockItems: IdentifiedItem[] = [
        { name: 'Organic Bananas', category: 'Produce' },
        { name: 'Whole Milk', category: 'Dairy' },
      ];

      return new Response(JSON.stringify({ items: mockItems }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const { image }: IdentifyItemsRequest = await req.json();

    if (!image) {
      console.log('No image provided in request');
      return new Response(JSON.stringify({ error: 'Image is required', items: [] }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    console.log('Identifying grocery items with OpenAI');

    const systemPrompt = `You are an expert at identifying grocery items from photos.

Your task is to:
1. Identify all visible grocery items in the photo
2. Extract the item name and categorize it appropriately
3. Categorize items into: Produce, Dairy, Meat, Pantry, Frozen, Beverages, Snacks, Personal Care, Household, Other
4. Return only valid JSON with the specified format
5. If an item name is unclear, make your best guess for the full product name
6. Focus only on actual grocery items, ignore background elements or non-food items
7. If multiple items of the same type are visible, you can list them as separate items

Return only a JSON object in this exact format:
{
  "items": [
    {
      "name": "Item Name",
      "category": "Category"
    }
  ]
}`;

    const userPrompt = `Please analyze this photo and identify all visible grocery items. Focus on actual food and grocery products that are clearly visible in the image.`;

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

    let parsedResponse: IdentifyItemsResponse;
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

    console.log('Identified items:', parsedResponse.items);

    return new Response(JSON.stringify(parsedResponse), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Error in identify-items function:', error);
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


