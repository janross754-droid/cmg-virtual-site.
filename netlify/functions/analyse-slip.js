const { json, getToken, env, getUser, supabase } = require("./_shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  const { url, anon, service, openai } = env();
  if (!url || !anon || !service || !openai) {
    return json(503, { error: "Server setup is incomplete. The administrator must configure the private environment variables." });
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
        instructions: `You are CMG VIRTUAL SUPER AI ANALYSER. Read uploaded virtual football betting slips carefully and provide a transparent TOP TWO MARKET-FAVOURITE comparison. You are not able to predict or control random virtual outcomes.

CORE RULES:
- Read only teams, fixtures, markets and decimal odds visibly present in the screenshot. Never invent missing information, teams, odds, statistics, or results.
- For each complete 1X2 market, calculate raw implied probabilities as 1/decimal odds. Normalize the three raw probabilities so they total 100%. These are margin-adjusted market-implied estimates, NOT verified real-world chances and NOT AI win predictions.
- Identify the shortest-odds outcome in each fixture as its BOOKMAKER FAVOURITE.
- Compare all readable outcomes and return ONLY the two shortest-priced outcomes overall, ranked 1 and 2. Include fixture, selection, decimal odds, and normalized market-implied percentage. If fewer than two complete readable fixtures/outcomes exist, show only those that can be calculated; do not invent a second pick.
- Explain clearly that choosing the shortest odds only identifies the market favourite. It does not establish that the outcome is likely to win or provide a predictive edge.
- Virtual football outcomes are random/unpredictable from a screenshot. Never claim hacking, insider access, guaranteed wins, sure bets, safe bets, or 95% confidence. Do not convert market-implied percentages into confidence scores.
- If the user wants dependable winning picks, the verdict must be NO BET — no reliable prediction can be established from these odds alone.
- If odds or fixture labels are blurry, say so and exclude uncertain values from calculations.
- Do not give stake sizes, loss-chasing advice, or pressure to bet. Adults 18+ only.

OUTPUT FORMAT:
1. SCREENSHOT READ: list every readable fixture and visible 1/X/2 odds; flag unclear entries.
2. TOP TWO MARKET FAVOURITES: rank at most two outcomes overall. For each show rank, fixture, selection, odds, and normalized market-implied percentage. State that these are odds-based favourites, not predictions or guarantees.
3. RISK CHECK: identify missing/unclear odds, bookmaker margin, and why the ranking does not prove a likely win.
4. FINAL VERDICT: say NO BET if the user requires a dependable winning selection. Never force two picks when evidence is incomplete. Be direct, concise, and specific to the uploaded slip.`,

        input: [{
          role: "user",
          content: [
            { type: "input_text", text: "Read every visible fixture and 1X2 price. Calculate raw and normalized implied probabilities for complete markets. Rank ONLY the two shortest-priced outcomes overall as TOP TWO MARKET FAVOURITES, with their odds and normalized market-implied percentages. Follow the required four-section output format. Make clear this is an odds comparison, not a prediction; do not invent outcomes or claim any bet is safe or guaranteed. Since virtual results are random, state NO BET for anyone seeking a reliable winning selection." },
            { type: "input_image", image_url: imageUrl, detail: "high" }
          ]
        }],
        max_output_tokens: 900
      })
    });
    const aiData = await aiResponse.json();
    if (!aiResponse.ok) throw new Error(aiData.error?.message || "AI analysis service failed.");
    const analysis = (aiData.output || []).flatMap((item) => item.content || [])
      .filter((item) => item.type === "output_text")
      .map((item) => item.text).join("\n").trim();
    if (!analysis) throw new Error("The AI did not return an analysis. Please try a clearer screenshot.");

    const saved = await supabase("/rest/v1/rpc/record_slip_analysis", {
      method: "POST",
      body: JSON.stringify({ p_user_id: user.id, p_analysis: analysis })
    }, service, url);
    return json(200, { analysis, credits: saved.credits });
  } catch (error) {
    const message = error.message || "Analysis failed.";
    const status = message.toLowerCase().includes("insufficient credits") ? 402 : 500;
    return json(status, { error: message });
  }
};
