/* ============================================================
   api/jobs.js — 사람인 채용공고 검색
   ------------------------------------------------------------
   예전에는 앱이 프롬프트를 만들어 주면 사용자가 claude.ai 에 붙여넣고
   답변을 다시 가져왔습니다. 그 과정을 없앤 자리입니다.

   사람인은 공개 REST API 를 제공합니다. Claude 를 거칠 이유가 없습니다 —
   더 빠르고, 더 정확하고(모델이 지어낼 여지가 없음), 무료입니다.
   Claude 는 '판단'이 필요한 곳에만 남겨 둡니다.

   필요한 환경변수: SARAMIN_KEY
   ============================================================ */

const { blocked, needKey } = require("./_guard");

const API = "https://oapi.saramin.co.kr/job-search";

module.exports = async (req, res) => {
  if (blocked(req, res)) return;

  const key = process.env.SARAMIN_KEY;
  if (!key) return needKey(res, "사람인 API 키(SARAMIN_KEY)", "Vercel → Settings → Environment Variables 에 SARAMIN_KEY 를 추가하세요. 키는 oapi.saramin.co.kr 에서 무료로 발급합니다.");

  const q = req.query || {};
  const params = new URLSearchParams({ "access-key": key, count: String(Math.min(Number(q.count) || 20, 50)) });
  /* 화면에서 넘어올 수 있는 값만 골라서 넘깁니다 — 통째로 넘기면 키를 덮어쓸 수 있습니다 */
  ["keywords", "loc_cd", "job_cd", "edu_lv", "job_type", "sr", "start", "sort"].forEach((k) => {
    if (q[k] !== undefined && q[k] !== "") params.set(k, String(q[k]));
  });

  try {
    const r = await fetch(`${API}?${params}`, { headers: { Accept: "application/json" } });
    if (!r.ok) return res.status(502).json({ error: `사람인 응답 오류 (${r.status})` });
    const raw = await r.json();
    const list = raw?.jobs?.job || [];

    /* 사람인 응답은 중첩이 깊고 필드명이 제각각입니다. 화면이 쓰기 좋은
       납작한 형태로 바꿔서 내보냅니다 — 이 변환을 한 곳에 모아 두면
       사람인이 형식을 바꿔도 여기만 고치면 됩니다. */
    const jobs = (Array.isArray(list) ? list : [list]).filter(Boolean).map((j) => ({
      id: String(j.id || ""),
      title: j.position?.title || "",
      company: j.company?.detail?.name || "",
      companyUrl: j.company?.detail?.href || "",
      location: j.position?.location?.name || "",
      jobType: j.position?.["job-type"]?.name || "",
      career: j.position?.["experience-level"]?.name || "",
      education: j.position?.["required-education-level"]?.name || "",
      salary: j.salary?.name || "",
      url: j.url || "",
      postedAt: j["posting-timestamp"] ? new Date(Number(j["posting-timestamp"]) * 1000).toISOString().slice(0, 10) : "",
      deadline: j["expiration-timestamp"] ? new Date(Number(j["expiration-timestamp"]) * 1000).toISOString().slice(0, 10) : "",
      applyCount: Number(j["apply-cnt"]) || 0,
    }));

    res.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=600");
    res.status(200).json({ total: Number(raw?.jobs?.total) || jobs.length, jobs });
  } catch (e) {
    res.status(500).json({ error: `사람인 검색 실패: ${e.message}` });
  }
};
