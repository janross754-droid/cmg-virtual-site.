const { json, getToken, env, getUser, isAdmin, supabase } = require("./_shared");

exports.handler = async (event) => {
  if (event.httpMethod !== "POST") return json(405, { error: "Method not allowed." });
  const { url, anon, service } = env();
  if (!url || !anon || !service) return json(503, { error: "Server environment is incomplete." });
  try {
    const token = getToken(event);
    if (!token) return json(401, { error: "Please log in first." });
    const user = await getUser(token, url, anon);
    if (!user) return json(401, { error: "Your session has expired." });
    if (!await isAdmin(user.id, service, url)) return json(403, { error: "Administrator access only." });

    const body = JSON.parse(event.body || "{}");
    const paymentId = body.paymentId;
    const action = body.action;
    if (!paymentId || !["approve", "reject"].includes(action)) return json(400, { error: "Invalid payment action." });

    if (action === "approve") {
      const result = await supabase("/rest/v1/rpc/approve_payment", {
        method: "POST",
        body: JSON.stringify({ p_payment_id: paymentId })
      }, service, url);
      return json(200, result);
    }

    const rows = await supabase("/rest/v1/payments?id=eq." + encodeURIComponent(paymentId) + "&select=id,status", {}, service, url);
    const payment = rows?.[0];
    if (!payment) return json(404, { error: "Payment not found." });
    if (payment.status !== "pending") return json(409, { error: "This payment has already been reviewed." });
    await supabase("/rest/v1/payments?id=eq." + encodeURIComponent(paymentId), {
      method: "PATCH",
      headers: { Prefer: "return=minimal" },
      body: JSON.stringify({ status: "rejected" })
    }, service, url);
    return json(200, { success: true });
  } catch (error) {
    return json(500, { error: error.message || "Payment review failed." });
  }
};
