/* ============================================================
   api/_guard.js — 모든 서버 함수가 공유하는 방어막
   ------------------------------------------------------------
   이 사이트는 공개 상태로 두기로 했습니다. 그래서 키를 서버에 두되
   '요금이 나가는 키는 두지 않는다'는 원칙을 지킵니다. 사람인·카카오는
   무료 할당량제라, 악용당해도 잃는 것은 돈이 아니라 그날치 할당량입니다.

   그 할당량마저 지키려고 두 겹을 둡니다.
     ① 출처 검사 — 내 사이트에서 온 요청만 받습니다. 브라우저가 Origin 을
        붙여 주므로, 남의 페이지에서 내 API 를 부르는 건 막힙니다.
        (curl 로는 얼마든지 위조할 수 있습니다. 이건 자물쇠가 아니라
         빗장입니다 — 지나가는 사람을 막을 뿐입니다.)
     ② 호출 제한 — 같은 IP 가 짧은 시간에 몰아치는 것을 끊습니다.

   진짜 자물쇠가 필요해지면(= 유료 키를 넣게 되면) Vercel Authentication 을
   켜야 합니다. 그때는 이 파일로 부족합니다.
   ============================================================ */

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;

/* 함수 인스턴스가 살아 있는 동안만 유지됩니다. 서버리스라 완벽하지 않지만,
   한 사람이 쉬지 않고 두드리는 경우는 대개 같은 인스턴스로 갑니다. */
const hits = new Map();

function tooMany(ip) {
  const now = Date.now();
  const rec = hits.get(ip);
  if (!rec || now - rec.start > WINDOW_MS) { hits.set(ip, { start: now, n: 1 }); return false; }
  rec.n += 1;
  if (hits.size > 5000) hits.clear();          /* 메모리 폭주 방지 */
  return rec.n > MAX_PER_WINDOW;
}

function allowedOrigin(req) {
  const origin = req.headers.origin || req.headers.referer || "";
  if (!origin) return true;                     /* 같은 출처 요청은 Origin 이 없을 수 있습니다 */
  const host = req.headers.host || "";
  try { return new URL(origin).host === host; } catch (e) { return false; }
}

/* 통과하면 null, 막히면 이미 응답을 보낸 뒤 true 를 돌려줍니다. */
function blocked(req, res) {
  if (req.method !== "GET") { res.status(405).json({ error: "GET 만 받습니다." }); return true; }
  if (!allowedOrigin(req)) { res.status(403).json({ error: "허용되지 않은 출처입니다." }); return true; }
  const ip = (req.headers["x-forwarded-for"] || "").split(",")[0].trim() || "unknown";
  if (tooMany(ip)) { res.status(429).json({ error: "요청이 너무 잦습니다. 잠시 후 다시 시도하세요." }); return true; }
  return false;
}

/* 키가 없을 때 화면에 무엇을 해야 하는지 알려 줍니다 —
   "500 Internal Server Error" 만 뜨면 원인을 찾을 수 없습니다. */
function needKey(res, name, where) {
  res.status(503).json({ error: `서버에 ${name} 가 설정되지 않았습니다.`, howto: where });
  return true;
}

module.exports = { blocked, needKey };
