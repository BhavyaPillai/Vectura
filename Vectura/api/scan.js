const PROMPT = `You are reading an engineering mechanics problem about coplanar forces from an image. Do NOT solve it. Extract only the given data and reply with ONLY JSON: {"mode":"concurrent"|"parallel"|"general","unit":"N"|"kN","direction":"v"|"h","summary":"one short sentence","notes":"anything unclear or assumed","forces":[{"f":number,"a":number,"x":number,"y":number}]}. Rules: a is the angle in degrees measured anticlockwise from the +X axis (convert textbook angles, e.g. 30 degrees above the horizontal pointing left = 150). Concurrent: forces share one point; give f and a, x=0, y=0. Parallel: direction v for vertical forces or h for horizontal; f is signed (up or right positive); put the distance from the origin in x (also for horizontal forces); a=0. General: give f, a and the point of application x, y in metres from the origin.`;

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  const key = process.env.GEMINI_API_KEY;
  if (!key) return res.status(500).json({ error: 'Server key is missing.' });
  const img = req.body && req.body.image;
  if (typeof img !== 'string' || img.length > 4000000) return res.status(400).json({ error: 'Image missing or too large.' });
  try {
    const model = process.env.GEMINI_MODEL || 'gemini-2.5-flash';
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-goog-api-key': key },
      body: JSON.stringify({
        contents: [{ parts: [{ text: PROMPT }, { inline_data: { mime_type: 'image/jpeg', data: img } }] }],
        generationConfig: { responseMimeType: 'application/json', temperature: 0 }
      })
    });
    const d = await r.json();
    if (!r.ok) return res.status(502).json({ error: 'The AI service returned an error. Try again in a minute.' });
    const t = (d.candidates && d.candidates[0] && d.candidates[0].content.parts[0].text) || '';
    return res.status(200).json(JSON.parse(t));
  } catch (e) {
    return res.status(500).json({ error: 'Could not read the image.' });
  }
};
