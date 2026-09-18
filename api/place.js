/* ============================================================
   api/place.js — 주소·장소 → 좌표, 그리고 집에서의 직선거리
   ------------------------------------------------------------
   공고와 통근이 따로 놀던 것을 잇는 자리입니다. 공고에는 "서울 강남구"
   같은 근무지 문자열만 들어 있어서, 그것만으로는 집에서 얼마나 걸리는지
   알 수 없었습니다. 여기서 좌표로 바꿔 줍니다.

   ▶ 왜 직선거리인가
   대중교통 소요시간을 공고마다 실제로 계산하려면 길찾기 API 를 공고 수만큼
   불러야 합니다. 느리고, 할당량을 태우고, 대부분은 어차피 거르게 될 공고입니다.
   그래서 좌표로 직선거리를 먼저 재서 굵게 거르고, 실제 경로는 사용자가
   관심을 보인 공고에만 카카오맵 링크로 엽니다.

   직선거리는 소요시간이 아닙니다. 다만 '가까운 것부터 보기'에는 충분하고,
   틀려도 방향이 틀리지는 않습니다.

   필요한 환경변수: KAKAO_REST_KEY
   ============================================================ */

const { blocked, needKey } = require("./_guard");

const ADDR = "https://dapi.kakao.com/v2/local/search/address.json";
const KEYWORD = "https://dapi.kakao.com/v2/local/search/keyword.json";

/* 하버사인 — 지구를 구로 보고 두 좌표 사이 거리를 km 로 냅니다 */
function distanceKm(aLat, aLng, bLat, bLng) {
  const R = 6371;
  const rad = (d) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

async function lookup(url, params, key) {
  const r = await fetch(`${url}?${new URLSearchParams(params)}`, {
    headers: { Authorization: `KakaoAK ${key}` },
  });
  if (!r.ok) return null;
  const j = await r.json();
  return (j.documents || [])[0] || null;
}

module.exports = async (req, res) => {
  if (blocked(req, res)) return;

  const key = process.env.KAKAO_REST_KEY;
  if (!key) return needKey(res, "카카오 REST 키(KAKAO_REST_KEY)", "Vercel → Settings → Environment Variables 에 KAKAO_REST_KEY 를 추가하세요. 키는 developers.kakao.com 에서 무료로 발급합니다.");

  const q = String((req.query || {}).q || "").trim();
  if (!q) return res.status(400).json({ error: "찾을 주소나 장소 이름(q)이 없습니다." });

  try {
    /* 주소 검색이 정확하지만 "카카오 판교 아지트" 같은 상호는 못 찾습니다.
       주소로 먼저 시도하고, 없으면 키워드로 넘어갑니다. */
    let doc = await lookup(ADDR, { query: q }, key);
    let kind = "address";
    if (!doc) { doc = await lookup(KEYWORD, { query: q, size: 1 }, key); kind = "keyword"; }
    if (!doc) return res.status(404).json({ error: "찾지 못했습니다.", q });

    const lat = Number(doc.y);
    const lng = Number(doc.x);
    const out = {
      q,
      kind,
      name: doc.place_name || doc.address_name || q,
      address: doc.road_address_name || doc.address_name || doc.road_address?.address_name || "",
      lat, lng,
    };

    /* 집 좌표를 같이 보내 주면 거리까지 계산해서 돌려줍니다 */
    const hLat = Number((req.query || {}).homeLat);
    const hLng = Number((req.query || {}).homeLng);
    if (Number.isFinite(hLat) && Number.isFinite(hLng)) {
      out.distanceKm = Math.round(distanceKm(hLat, hLng, lat, lng) * 10) / 10;
    }

    res.setHeader("Cache-Control", "s-maxage=86400, stale-while-revalidate=604800");
    res.status(200).json(out);
  } catch (e) {
    res.status(500).json({ error: `위치 조회 실패: ${e.message}` });
  }
};
