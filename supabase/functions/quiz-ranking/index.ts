const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const encoder = new TextEncoder();
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), {
  status,
  headers: { ...corsHeaders, "Content-Type": "application/json" },
});

function toBase64Url(bytes: Uint8Array) {
  let binary = "";
  bytes.forEach((byte) => binary += String.fromCharCode(byte));
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/, "");
}

async function sign(value: string, secret: string) {
  const key = await crypto.subtle.importKey(
    "raw", encoder.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  return toBase64Url(new Uint8Array(await crypto.subtle.sign("HMAC", key, encoder.encode(value))));
}

async function makeToken(username: string, secret: string) {
  const payload = toBase64Url(encoder.encode(JSON.stringify({
    username,
    expires: Math.floor(Date.now() / 1000) + 60 * 60 * 24 * 30,
  })));
  return `${payload}.${await sign(payload, secret)}`;
}

async function readUsername(request: Request, secret: string): Promise<string | null> {
  const token = request.headers.get("Authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const [payload, signature, extra] = token.split(".");
  if (!payload || !signature || extra) return null;
  if (await sign(payload, secret) !== signature) return null;
  try {
    const decoded = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
    const data = JSON.parse(decoded);
    if (data.expires <= Math.floor(Date.now() / 1000)) return null;
    return data.username;
  } catch { return null; }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const projectUrl = Deno.env.get("SUPABASE_URL");
  const secretKeys = JSON.parse(Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}");
  const serviceKey = secretKeys.default ?? Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const tokenSecret = Deno.env.get("QUIZ_TOKEN_SECRET");
  if (!projectUrl || !serviceKey || !tokenSecret) return json({ error: "Backend secrets are not configured." }, 500);

  let body: Record<string, unknown>;
  try { body = await request.json(); }
  catch { return json({ error: "Invalid JSON body." }, 400); }

  if (body.action === "login") {
    let accounts: Record<string, string>;
    try { accounts = JSON.parse(Deno.env.get("QUIZ_ACCOUNTS_JSON") ?? "{}"); }
    catch { return json({ error: "Account secret is not valid JSON." }, 500); }
    const username = String(body.username ?? "");
    const password = String(body.password ?? "");
    if (!Object.hasOwn(accounts, username) || accounts[username] !== password) {
      return json({ error: "Tên đăng nhập hoặc mật khẩu không chính xác." }, 401);
    }
    const token = await makeToken(username, tokenSecret);
    return json({ username, token });
  }

  const username = await readUsername(request, tokenSecret);
  if (!username) return json({ error: "Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại." }, 401);

  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
    "Content-Type": "application/json",
  };
  if (body.action === "leaderboard") {
    const response = await fetch(
      `${projectUrl}/rest/v1/quiz_players?select=username,total_points&order=total_points.desc,username.asc`,
      { headers },
    );
    if (!response.ok) return json({ error: "Không tải được bảng xếp hạng." }, 502);
    return json({ players: await response.json() });
  }

  if (body.action === "history") {
    const targetUsername = String(body.username ?? "");
    if (!/^[A-Za-z0-9_]{1,32}$/.test(targetUsername)) {
      return json({ error: "Tên tài khoản không hợp lệ." }, 400);
    }
    const params = new URLSearchParams({
      select: "submission_id,correct_answers,submitted_at",
      username: `eq.${targetUsername}`,
      order: "submitted_at.desc",
      limit: "100",
    });
    const response = await fetch(`${projectUrl}/rest/v1/quiz_submissions?${params}`, { headers });
    if (!response.ok) return json({ error: "Không tải được lịch sử làm bài." }, 502);
    return json({ username: targetUsername, history: await response.json() });
  }

  if (body.action === "submit-score") {
    const submissionId = String(body.submissionId ?? "");
    const points = Number(body.points);
    if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(submissionId)
      || !Number.isInteger(points) || points < 0 || points > 70) {
      return json({ error: "Điểm bài thi không hợp lệ." }, 400);
    }
    const response = await fetch(`${projectUrl}/rest/v1/rpc/add_quiz_score`, {
      method: "POST",
      headers,
      body: JSON.stringify({ p_username: username, p_submission_id: submissionId, p_points: points }),
    });
    if (!response.ok) return json({ error: "Không lưu được điểm. Hãy thử lại." }, 502);
    return json({ saved: await response.json() });
  }
  return json({ error: "Unknown action." }, 400);
});
