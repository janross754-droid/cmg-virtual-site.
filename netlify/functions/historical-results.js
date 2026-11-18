const { json, getToken, env, getUser, supabase } = require("./_shared");

exports.handler = async (event) => {
  const { url, anon, service } = env();
  if (!url || !anon || !service) return json(503, { error: "Historical results service is not configured." });
  try {
    const token = getToken(event);
    if (!token) return json(401, { error: "Please log in first." });
    const user = await getUser(token, url, anon);
    if (!user) return json(401, { error: "Your session has expired. Please log in again." });
    const base = "/rest/v1/cmg_historical_results?user_id=eq." + encodeURIComponent(user.id);
    if (event.httpMethod === "GET") {
      const rows = await supabase(base + "&select=ticket_id,match_date,league,fixture,market,selection,odds,home_score,away_score,outcome,selection_correct&order=match_date.desc&limit=1000", {}, service, url);
      const standard = rows.filter(r => !/1UP/i.test(r.market));
      const wins = standard.filter(r => r.selection_correct).length;
      const losses = standard.length - wins;
      const drawRows = standard.filter(r => r.outcome === "Draw");
      return json(200, {
        total: standard.length, wins, losses,
        hitRate: standard.length ? Math.round(wins / standard.length * 1000) / 10 : null,
        draws: drawRows.length,
        drawMisses: drawRows.filter(r => r.selection !== "Draw").length,
        oneUpCount: rows.length - standard.length,
        rows: rows.slice(0, 80)
      });
    }
    if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
    const body = JSON.parse(event.body || "{}");
    const entries = Array.isArray(body.entries) ? body.entries : [];
    if (!entries.length || entries.length > 200) return json(400, { error: "Submit between 1 and 200 fixture rows." });
    const records = entries.map((e, i) => {
      const ticket = String(e.ticket_id || "").trim().slice(0, 60);
      const league = String(e.league || "").trim().slice(0, 80);
      const fixture = String(e.fixture || "").trim().toUpperCase().slice(0, 80);
      const market = String(e.market || "1X2").trim().toUpperCase().slice(0, 30);
      const selection = String(e.selection || "").trim();
      const odds = Number(e.odds);
      const hs = Number(e.home_score), as = Number(e.away_score);
      const date = e.match_date ? String(e.match_date) : null;
      if (!ticket || !league || !fixture || !["Home","Draw","Away"].includes(selection) ||
          !Number.isFinite(odds) || odds <= 1 || !Number.isInteger(hs) || hs < 0 ||
          !Number.isInteger(as) || as < 0 || (date && !/^\d{4}-\d{2}-\d{2}$/.test(date))) {
        throw new Error("Row " + (i + 1) + " has missing or invalid fields. Check ticket, league, fixture, pick, odds and full-time score.");
      }
      const outcome = hs > as ? "Home" : hs < as ? "Away" : "Draw";
      return { user_id:user.id, ticket_id:ticket, match_date:date, league, fixture, market, selection, odds, home_score:hs, away_score:as, outcome, selection_correct:selection===outcome };
    });
    const inserted = await supabase("/rest/v1/cmg_historical_results?on_conflict=user_id,ticket_id,fixture,market", {
      method:"POST", headers:{Prefer:"resolution=ignore-duplicates,return=representation"}, body:JSON.stringify(records)
    }, service, url);
    return json(200, { saved: inserted.length, submitted: records.length, duplicates: records.length-inserted.length });
  } catch (error) {
    console.error("[historical-results]", error.message);
    return json(400, { error: error.message || "Historical results request failed." });
  }
};
