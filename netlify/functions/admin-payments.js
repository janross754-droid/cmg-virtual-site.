const { json, getToken, env, getUser, isAdmin, supabase } = require("./_shared");

async function signedProofUrl(path, url, serviceKey) {
  if (!path) return null;
  const base = url.replace(/\/$/, "");
  const encodedPath = String(path).split("/").map(encodeURIComponent).join("/");
  const response = await fetch(`${base}/storage/v1/object/sign/payment-proofs/${encodedPath}`, {
    method: "POST",
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json"
    },
    body: JSON.stringify({ expiresIn: 3600 })
  });
  const text = await response.text();
  let data = {};
  try { data = text ? JSON.parse(text) : {}; } catch (_) {}
  if (!response.ok) return null;
  const signed = data.signedURL || data.signedUrl;
  if (!signed) return null;
  return signed.startsWith("http") ? signed : `${base}/storage/v1${signed.startsWith("/") ? signed : "/" + signed}`;
}

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
      "/rest/v1/payments?select=id,user_id,package_id,amount,network,transaction_reference,payer_name,payer_phone,screenshot_path,status,created_at&order=created_at.desc&limit=100",
      {}, service, url
    );
    const result = [];
    for (const payment of payments || []) {
      const [profiles, packageRows] = await Promise.all([
        supabase("/rest/v1/profiles?id=eq." + encodeURIComponent(payment.user_id) + "&select=full_name,phone_number", {}, service, url),
        supabase("/rest/v1/packages?id=eq." + encodeURIComponent(payment.package_id) + "&select=name,credits", {}, service, url)
      ]);
      const profile = profiles?.[0] || {};
      const pkg = packageRows?.[0] || {};
      const screenshot_url = await signedProofUrl(payment.screenshot_path, url, service);
      result.push({
        ...payment,
        user_email: payment.user_id,
        profile_name: profile.full_name || null,
        profile_phone: profile.phone_number || null,
        package_name: pkg.name || "Package",
        credits: pkg.credits || 0,
        screenshot_url
      });
    }
    return json(200, { payments: result });
  } catch (error) {
    return json(500, { error: error.message || "Could not load payments." });
  }
};
