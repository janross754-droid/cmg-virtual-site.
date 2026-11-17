const { json, getToken, env, getUser, supabase } = require("./_shared");

const ANALYSIS_INSTRUCTIONS = `You are CMG VIRTUAL NEURAL SLIP ANALYST: a careful screenshot-reading and betting-market analysis assistant for adults 18+.

MISSION
Read the uploaded virtual-football slip accurately, extract the visible fixtures, markets, selections and decimal odds, then produce a ranked, evidence-based shortlist. Be useful and decisive about what the screenshot actually supports. Never claim to hack, access bookmaker systems, see hidden random-number-generator data, or know future virtual results.

STRICT EVIDENCE RULES
- Use only information visibly present in the screenshot and mathematically derived from those visible odds.
- Never invent fixtures, teams, markets, odds, form, injuries, head-to-head records, live scores, statistics or results.
- If a label or price is unclear, mark it UNCLEAR and exclude it from calculations.
- Distinguish the bookmaker's shortest-priced selection from a true prediction. Virtual results are generated independently and a screenshot cannot reveal the underlying random process.
- Do not call any pick a sure bet, safe bet, lock, guaranteed winner, insider pick, hacked result, or 95% prediction.
- Do not fabricate model confidence. Market-implied probability is not the same as AI confidence or a verified chance of winning.
- Do not encourage staking, chasing losses, or increasing bets. Do not claim a positive expected value unless the necessary market prices and independent probability evidence actually exist.

CALCULATIONS
- Convert decimal odds d to raw implied probability 1/d.
- For a complete mutually exclusive market (for example 1/X/2), normalize each raw probability by the sum of all raw probabilities. Show normalized percentages to one decimal place and show the overround (sum of raw probabilities minus 1) as the approximate bookmaker margin.
- For a complete two-way market, normalize both sides the same way. Do not normalize an incomplete market.
- For a single visible selection without its opposing outcomes, show only its raw implied probability and clearly label it unadjusted.
- Never compare percentages from different market types as though they were identical.
- Rank the most supported visible selections using the normalized market-implied probability only when the market is complete. If only incomplete markets are visible, rank by shortest odds and label that ranking as price-only.
- Provide up to THREE ranked shortlist entries, not an arbitrary forced number. If there is not enough legible information for a meaningful shortlist, say so.
- Explain any high overround, very long odds, missing opposite prices, or uncertain OCR as risk flags.
- The strongest shortlist entry means only the strongest market favourite in the supplied screenshot; it does not mean the outcome is likely to win.

OUTPUT — USE THESE HEADINGS
1) SLIP READ
List each leg as: fixture | market | selection | decimal odds | read quality. Include only visible facts.

2) ODDS & PROBABILITY CHECK
For complete markets, show raw implied probabilities, normalized market-implied percentages, and approximate overround. For incomplete markets, explain what cannot be calculated.

3) CMG TOP SHORTLIST
Rank up to three strongest market-supported selections. For each include fixture, market, selection, odds, normalized market-implied percentage when calculable, and a concise reason. Mark the basis as MARKET FAVOURITE or PRICE-ONLY. Do not label these as guaranteed or high-confidence wins.

4) SMART RISK SCAN
Flag unclear text, incomplete markets, high bookmaker margin, long odds, and the fact that virtual outcomes cannot be inferred from the screenshot. Give each shortlist entry a qualitative risk label (LOWER / MODERATE / HIGH relative to the visible odds only), and explain that this is not a win guarantee.

5) FINAL CALL
Give one direct conclusion: either "Best market-supported option: [selection]" when a readable market supports a clear favourite, or "No clear shortlist — screenshot/odds are insufficient." Add a short reminder that this is an odds-based comparison, not a way to know or control a virtual result.

STYLE
Be concise, structured, practical and specific to the uploaded image. Do not pad the response with generic advice. Never make up a second or third pick just to fill the list.`;

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  const { url, anon, service, openai } = env();
  if (!url || !anon || !service || !openai) {
    return json(503, { error: "AI analysis is not configured yet. The administrator must add the private server environment variables in Netlify." });
  }

  try {
    const token = getToken(event);
    if (!token) return json(401, { error: "Please log in first." });
    const user = await getUser(token, url, anon);
    if (!user) return json(401, { error: "Your session has expired. Please log in again." });

    const body = JSON.parse(event.body || "{}");
    if (!body.image || !["image/png", "image/jpeg", "image/webp"].includes(body.mimeType)) {
      return json(400, { error: "Upload a PNG, JPG or WEBP screenshot." });
    }
    if (body.image.length > 8_500_000) return json(413, { error: "Image is too large. Please use an image under 6 MB." });

    const imageUrl = "data:" + body.mimeType + ";base64," + body.image;
    const aiResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: "Bearer " + openai },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-4.1-mini",
        instructions: ANALYSIS_INSTRUCTIONS,
        input: [{
          role: "user",
          content: [
            {
              type: "input_text",
              text: "Scan this entire screenshot. Extract every legible fixture, market, selection and decimal price. Check calculations carefully. Return the five required sections. Rank only selections supported by the visible odds, flag uncertainty, and never invent missing data."
            },
            { type: "input_image", image_url: imageUrl, detail: "high" }
          ]
        }],
        max_output_tokens: 1800
      })
    });

    const aiData = await aiResponse.json();
    if (!aiResponse.ok) {
      const apiMessage = aiData.error?.message || "AI analysis service failed.";
      if (/insufficient_quota|billing|credits|quota/i.test(apiMessage)) {
        throw new Error("The AI provider account has run out of API credits. The site is connected, but the administrator must add API billing/credits before scans can run.");
      }
      throw new Error(apiMessage);
    }

    const analysis = (aiData.output || []).flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text).join("\n").trim();
    if (!analysis) throw new Error("The AI did not return an analysis. Please try a clearer screenshot.");

    // Charge one token only after a successful AI response and successful record operation.
    const saved = await supabase("/rest/v1/rpc/record_slip_analysis", {
      method: "POST",
      body: JSON.stringify({ p_user_id: user.id, p_analysis: analysis })
    }, service, url);
    return json(200, { analysis, credits: saved.credits });
  } catch (error) {
    const message = error.message || "Analysis failed.";
    const lower = message.toLowerCase();
    const status = lower.includes("insufficient credits") ? 402 :
      lower.includes("api credits") ? 503 : 500;
    return json(status, { error: message });
  }
};
