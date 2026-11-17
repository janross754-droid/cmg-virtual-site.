exports.json = (statusCode, body) => ({
  statusCode,
  headers: {
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
    "Access-Control-Allow-Origin": "*"
  },
  body: JSON.stringify(body)
});

exports.getToken = (event) => {
  const headers = event.headers || {};
  const value = headers.authorization || headers.Authorization || "";
  return value.startsWith("Bearer ") ? value.slice(7) : null;
};

exports.env = () => ({
  url: process.env.SUPABASE_URL,
  anon: process.env.SUPABASE_ANON_KEY,
  service: process.env.SUPABASE_SERVICE_ROLE_KEY,
  openai: process.env.OPENAI_API_KEY
});

exports.getUser = async (token, url, anonKey) => {
  const response = await fetch(url.replace(/\/$/, "") + "/auth/v1/user", {
    headers: { apikey: anonKey, Authorization: "Bearer " + token }
  });
  if (!response.ok) return null;
  return response.json();
};

exports.supabase = async (path, options, serviceKey, url) => {
  const response = await fetch(url.replace(/\/$/, "") + path, {
    ...(options || {}),
    headers: {
      apikey: serviceKey,
      Authorization: "Bearer " + serviceKey,
      "Content-Type": "application/json",
      ...((options && options.headers) || {})
    }
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (_) { data = text; }
  if (!response.ok) {
    throw new Error(data && (data.message || data.msg || data.error_description) || "Supabase request failed.");
  }
  return data;
};

exports.isAdmin = async (userId, serviceKey, url) => {
  const rows = await exports.supabase(
    "/rest/v1/profiles?id=eq." + encodeURIComponent(userId) + "&select=role",
    {}, serviceKey, url
  );
  return rows && rows[0] && rows[0].role === "admin";
};
