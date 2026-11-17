const { json, getToken, env, getUser, isAdmin, supabase } = require("./_shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "GET") return json(405, { error: "Method not allowed." });
  const { url, anon, service } = env();
  if (!url || !anon || !service) return json(503, { error: "Server environment is incomplete." });
  try {
    const token = getToken(event);
    if (!token) return json(401, { error: "Please log in first." });
    const user = await getUser(token, url, anon);
    if (!user) return json(401, { error: "Your session has expired." });
    if (!await isAdmin(user.id, service, url)) return json(403, { error: "Administrator access only." });

    const payments = await supabase(
      "/rest/v1/payments?select=id,user_id,package_id,amount,network,transaction_reference,status,created_at&order=created_at.desc&limit=100",
      {}, service, url
    );
    const result = [];
    for (const payment of payments || []) {
      const profile = await supabase("/rest/v1/profiles?id=eq." + encodeURIComponent(payment.user_id) + "&select=email", {}, service, url);
      const pkg = await supabase("/rest/v1/packages?id=eq." + encodeURIComponent(payment.package_id) + "&select=credits", {}, service, url);
      result.push({ ...payment, user_email: profile?.[0]?.email || payment.user_id, credits: pkg?.[0]?.credits || 0 });
    }
    return json(200, { payments: result });
  } catch (error) {
    return json(500, { error: error.message || "Could not load payments." });
  }
};
