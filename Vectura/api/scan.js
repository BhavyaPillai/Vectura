
const PROMPT = `You are reading an engineering mechanics problem about coplanar forces from an image. Do NOT solve it. Extract only the given data and reply with ONLY JSON: {"mode":"concurrent"|"parallel"|"general","unit":"N"|"kN","direction":"v"|"h","summary":"one short sentence","notes":"anything unclear or assumed","forces":[{"f":number,"a":number,"x":number,"y":number}]}. Rules: a is the angle in degrees measured anticlockwise from the +X axis (convert textbook angles, e.g. 30 degrees above the horizontal pointing left = 150). Concurrent: forces share one point; give f and a, x=0, y=0. Parallel: direction v for vertical forces or h for horizontal; f is signed (up or right positive); put the distance from the origin in x (also for horizontal forces); a=0. General: give f, a and the point of application x, y in metres from the origin.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'POST only' });
  }

  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return res.status(500).json({
      error: 'GEMINI_API_KEY is missing in Vercel.'
    });
  }

  const img = req.body && req.body.image;

  if (typeof img !== 'string' || img.length > 4000000) {
    return res.status(400).json({
      error: 'Image missing or too large.'
    });
  }

  const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': key
        },
        body: JSON.stringify({
          contents: [{
            parts: [
              { text: PROMPT },
              {
                inline_data: {
                  mime_type: 'image/jpeg',
                  data: img
                }
              }
            ]
          }],
          generationConfig: {
            responseMimeType: 'application/json',
            temperature: 0
          }
        })
      }
    );

    const data = await response.json().catch(() => ({}));

    if (!response.ok) {
      const details =
        data?.error?.message || 'Unknown Gemini API error';

      console.error('Gemini API failure:', {
        status: response.status,
        details
      });

      return res.status(502).json({
        error: 'Gemini API request failed',
        geminiStatus: response.status,
        details
      });
    }

    const candidate = data?.candidates?.[0];
    const output = candidate?.content?.parts
      ?.map(part => part.text || '')
      .join('');

    if (!output) {
      console.error('Gemini returned no output:', data);

      return res.status(502).json({
        error: 'Gemini returned no readable output',
        finishReason: candidate?.finishReason || 'Unknown'
      });
    }

    try {
      return res.status(200).json(JSON.parse(output));
    } catch {
      console.error('Invalid JSON returned by Gemini:', output);

      return res.status(502).json({
        error: 'Gemini returned invalid JSON.',
        details: output.slice(0, 500)
      });
    }

  } catch (error) {
    console.error('Backend error:', error.message);

    return res.status(500).json({
      error: 'Could not connect to Gemini.',
      details: error.message
    });
  }
};
