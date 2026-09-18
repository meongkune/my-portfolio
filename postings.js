/* ============================================================
   postings.js — ② 채용공고
   ------------------------------------------------------------
   공고 넣는 방법: 🔗 링크 · 🖼 스크린샷 · ✍ 직접 입력 (+ 🔎 사람인에서 찾기)
   넣는 즉시 목록에 뜨고, 뒤에서 [공고 읽기 + 적합도 평가]를 한 번에 실행합니다.

   적합도는 고정된 채점표로 앱이 계산합니다. Claude 는 항목별 "판정 + 근거 id" 만 냅니다.
     필수 요건 40 · 우대 요건 20 · 직무 경험 관련성 25 · 지원 조건 15  (= 100)
     - 판정: 충족 1 · 부분 0.5 · 부족 0
     - 근거는 ① 내 이력서의 줄 번호(E1, E2 …)만 인정. 목록에 없는 id 는 버리고,
       근거 없이 "충족/부분"이라 한 판정은 한 단계 내립니다. (조정 내역을 화면에 표시)
   ============================================================ */

const PO_SCHEMA = "pf-posting-v2";
const PO_FIT_SCHEMA = "pf-fit-v2";
const PO_STAGES = ["검토 중", "지원 예정", "지원 완료", "서류 합격", "면접 진행", "최종 합격", "불합격", "보류"];
const PO_ACTIVE = ["지원 예정", "지원 완료", "서류 합격", "면접 진행"];
const PO_DONE = ["최종 합격", "불합격"];
const PO_EVENT_TYPES = ["마감", "지원 완료", "서류 발표", "인적성·코테", "면접", "최종 발표", "기타"];
/* 지원할 때 챙길 서류 — 공고마다 체크 */
const PO_DOCS = ["이력서", "자기소개서", "포트폴리오", "경력기술서", "성적증명서", "자격증 사본"];

const PO_RUBRIC = [
  { key: "must", label: "필수 요건", weight: 40, how: "공고의 자격요건 하나하나를 내 이력서 근거로 판정 → 충족 1 · 부분 0.5 · 부족 0 의 평균 × 40" },
  { key: "pref", label: "우대 요건", weight: 20, how: "우대사항을 같은 방식으로 판정 → 평균 × 20 (우대사항이 없으면 필수 요건에 합산)" },
  { key: "exp", label: "직무 경험이 얼마나 가까운가", weight: 25, how: "공고 주요 업무와 내 경험의 관련성 0~5단계 × 5 — 5 같은 직무 실무 · 4 유사 직무 실무/같은 직무 프로젝트 성과 · 3 관련 프로젝트 · 2 간접 관련 · 1 거의 무관 · 0 근거 없음" },
  { key: "cond", label: "지원 조건", weight: 15, how: "경력 6 · 학력 3 · 근무지 3 · 고용형태 3 을 공고와 내 희망 조건으로 비교 → 부합 1 · 확인 필요 0.5 · 불일치 0" },
];
const PO_COND = [
  { key: "career", label: "경력", w: 6 }, { key: "education", label: "학력", w: 3 },
  { key: "location", label: "근무지", w: 3 }, { key: "employment", label: "고용형태", w: 3 },
];
const PO_GRADE = (s) => (s >= 85 ? "매우 적합" : s >= 70 ? "적합" : s >= 55 ? "보통" : s >= 40 ? "도전" : "낮음");
const PO_TONE = (s) => (s >= 70 ? "ok" : s >= 55 ? "accent" : "warn");

/* ---------- 정규화 ---------- */
function poNormalize(list) {
  return (Array.isArray(list) ? list : []).filter((p) => p && typeof p === "object").map((p) => {
    const reqs = (Array.isArray(p.requirements) ? p.requirements : []).map((r, i) => ({
      rid: rsStr(r.rid) || `R${i + 1}`, level: r.level === "우대" ? "우대" : "필수",
      label: rsStr(r.label), detail: rsStr(r.detail), keywords: rsArr(r.keywords),
    })).filter((r) => r.label);
    return {
      id: p.id || uid("po"), createdAt: p.createdAt || p.addedAt || todayStr(),
      source: ["link", "image", "manual", "search"].includes(p.source) ? p.source : p.url ? "link" : "manual",
      status: ["analyzing", "ready", "error", "pending"].includes(p.status) ? (p.status === "analyzing" ? "pending" : p.status) : (p.title ? "ready" : "pending"),
      error: rsStr(p.error),
      url: poCleanUrl(p.url), recIdx: rsStr(p.recIdx),
      company: rsStr(p.company), title: rsStr(p.title),
      deadline: /^\d{4}-\d{2}-\d{2}$/.test(p.deadline || "") ? p.deadline : "", deadlineText: rsStr(p.deadlineText),
      location: rsStr(p.location), career: rsStr(p.career), education: rsStr(p.education),
      employmentType: rsStr(p.employmentType), salary: rsStr(p.salary),
      summary: rsStr(p.summary), duties: rsArr(p.duties), keywords: rsArr(p.keywords),
      process: rsArr(p.process), benefits: rsArr(p.benefits), requirements: reqs,
      companyInfo: p.companyInfo && typeof p.companyInfo === "object" ? p.companyInfo : {},
      sources: rsArr(p.sources), missing: rsArr(p.missing), rawText: String(p.rawText || ""),
      hint: rsStr(p.hint),
      fit: p.fit && p.fit.computed ? p.fit : null,
      star: !!p.star, stage: PO_STAGES.includes(p.stage) ? p.stage : "검토 중",
      events: (Array.isArray(p.events) ? p.events : []).filter((e) => e && /^\d{4}-\d{2}-\d{2}$/.test(e.date)).map((e) => ({
        id: e.id || uid("ev"), type: PO_EVENT_TYPES.includes(e.type) ? e.type : "기타", date: e.date, time: rsStr(e.time), memo: rsStr(e.memo), auto: !!e.auto,
      })),
      memo: String(p.memo || ""),
      apply: (() => {
        const a = p.apply && typeof p.apply === "object" ? p.apply : {};
        return {
          site: rsStr(a.site), account: rsStr(a.account), submitted: !!a.submitted, submittedAt: rsStr(a.submittedAt),
          docs: (Array.isArray(a.docs) ? a.docs : []).map(rsStr).filter(Boolean), note: String(a.note || ""),
        };
      })(),
      cover: cvNormalize(p.cover),
      interview: p.interview && typeof p.interview === "object" ? p.interview : null,
      exam: p.exam && typeof p.exam === "object" ? p.exam : null,
      debrief: (Array.isArray(p.debrief) ? p.debrief : []).filter((d) => d && typeof d === "object").map((d) => ({
        id: d.id || uid("db"), date: rsStr(d.date) || todayStr(), round: rsStr(d.round) || "기타",
        feel: rsStr(d.feel) || "보통", questions: rsArr(d.questions), lesson: rsStr(d.lesson),
      })),
    };
  });
}

const poGet = (id) => S.postings.find((p) => p.id === id);
/* 이 공고의 평가가 옛 이력서 기준인지 — 실제로 인용한 문장이나 희망 조건이 바뀌었을 때만 알립니다 */
function poStale(p) {
  if (!p.fit) return false;
  if (p.fit.prefsAt != null && p.fit.prefsAt !== rsPrefsText()) return true;
  const texts = new Set(rsEvidence().map((e) => e.text));
  const snap = Object.values(p.fit.evidenceSnap || {});
  if (snap.length) return snap.some((v) => !texts.has(v.text));
  return p.fit.fp !== rsFingerprint();
}
/* 링크 분석 때 접속을 허용할 곳 — 그 공고 사이트와 사람인만 */
function poDomains(url) {
  try { return [...new Set([new URL(url).hostname.replace(/^www\./, ""), "saramin.co.kr"])]; } catch (e) { return ["saramin.co.kr"]; }
}
const poRecIdx = (url) => (String(url || "").match(/rec_idx=(\d{5,12})/) || [])[1] || "";
const poCleanUrl = (raw) => { try { const u = new URL(String(raw).trim()); return /^https?:$/.test(u.protocol) ? u.toString() : ""; } catch (e) { return ""; } };
function poMarkStale() { /* 이력서가 바뀌면 카드에 "이력서 변경됨" 이 뜹니다 — 지문 비교라 따로 할 일 없음 */ }

/* 이력서 경력 기간을 더해 실제 경력 개월 수를 냅니다 (희망 조건에 적은 말보다 이게 사실에 가깝습니다) */
function poCareerMonths() {
  const now = new Date();
  let months = 0;
  (S.resume.career || []).forEach((c) => {
    const m = String(c.period || "").match(/(\d{4})[.\-/\s]*(\d{1,2})?\s*[–~\-]\s*(현재|재직|(\d{4})[.\-/\s]*(\d{1,2})?)/);
    if (!m) return;
    const s = new Date(Number(m[1]), (Number(m[2]) || 1) - 1);
    const e = /현재|재직/.test(m[3]) ? now : new Date(Number(m[4]), (Number(m[5]) || 12) - 1);
    const diff = (e.getFullYear() - s.getFullYear()) * 12 + (e.getMonth() - s.getMonth());
    if (diff > 0 && diff < 600) months += diff;
  });
  return months;
}
const poCareerText = () => {
  const m = poCareerMonths();
  return m ? `이력서의 경력 기간 합계 약 ${Math.floor(m / 12)}년 ${m % 12}개월` : "이력서에 경력 기간 없음 (신입)";
};

/* ---------- 프롬프트 ---------- */
function poApplicantBlock(ev) {
  return `[지원자 조건]
${poCareerText()}   ← 경력 조건 판정은 희망 조건에 적은 말이 아니라 이 값을 기준으로 봅니다
학력: ${(S.resume.education || []).map((e) => [e.school, e.major, e.status].filter(Boolean).join(" ")).join(" / ") || "-"}

[지원자 희망 조건]
${rsPrefsText()}
희망 직무: ${S.me.desiredJob || "-"}

[지원자 근거 목록 — 적합도 근거는 이 id 만 인용]
${rsEvidenceText(ev) || "(이력서가 비어 있음)"}`;
}

const PO_FIT_RULES = `[적합도 판정 규칙]
- requirements: 공고의 모든 요구사항(rid)마다 status 를 "충족"(근거 목록에 직접 증거) / "부분"(유사·간접 증거) / "부족"(증거 없음) 중 하나로. evidence 에 근거 목록 id(E번호)를 적고, reason 은 판정 이유 한 문장, gap 은 부족하면 무엇을 보완할지.
- 근거 목록에 없는 경험·능력은 절대 가정하지 않습니다. 증거 id 를 못 대면 "부족"입니다.
- experience: 공고 주요 업무와 지원자 경험의 관련성 level 0~5 (5 같은 직무 실무 경력 · 4 유사 직무 실무 또는 같은 직무 프로젝트 성과 · 3 관련 프로젝트 · 2 간접 관련 · 1 거의 무관 · 0 근거 없음), evidence 와 reason.
- conditions: career·education·location·employment 네 가지를 공고 조건(posting)과 지원자 조건(mine)으로 적고 status 를 "부합" / "확인 필요"(정보 부족·애매) / "불일치" 중 하나로.
  경력은 <모자랄 때만> "불일치"입니다 (예: 공고 경력 3년 이상, 지원자 1년). 신입 공고에 경력자가 지원하는 것처럼 넘치는 경우는 "확인 필요"로 두고 reason 에 "신입 채용이라 경력 인정 여부 확인"처럼 적습니다.
  학력도 요구보다 <낮을 때만> "불일치"입니다.
- strengths 는 evidence id 와 함께, actions 는 지원 전 할 수 있는 구체적 행동 3~5개(무엇을·왜), resumeTips 는 이 공고에 맞춰 이력서 문장을 어떻게 고칠지 2~4개.`;

const PO_FIT_JSON = {
  summary: "한 줄 총평",
  requirements: [{ rid: "R1", status: "충족|부분|부족", evidence: ["E1"], reason: "", gap: "" }],
  experience: { level: 0, evidence: ["E1"], reason: "" },
  conditions: [{ key: "career|education|location|employment", posting: "", mine: "", status: "부합|확인 필요|불일치", reason: "" }],
  strengths: [{ text: "", evidence: ["E1"] }], gaps: [""], actions: [{ what: "", why: "" }], resumeTips: [""],
};

function poFullPrompt(p, input, ev) {
  const rec = poRecIdx(input.url);
  const how = {
    link: () => `[공고 입력: 링크]
- 링크: ${input.url}
${rec ? `- 사람인 공고 번호: ${rec}\n` : ""}1) ${clSaraminRule()} 사람인 공고면 공고 번호·제목·회사명으로 search_saramin_jobs 에서 이 공고 카드를 찾고, search_company_info 로 회사 정보를 확인합니다.
2) 자격요건·우대사항·주요 업무 본문은 링크 페이지를 가져와 읽습니다.${rec ? ` 본문이 비어 있으면 https://www.saramin.co.kr/zf_user/jobs/relay/view-detail?rec_idx=${rec} 도 시도합니다.` : ""}`,
    image: () => `[공고 입력: 스크린샷 ${(input.files || []).length}장]
- 첨부한 이미지는 한 공고를 나눠 찍은 것입니다. 순서대로 모두 읽어 글자를 옮기고 하나의 공고로 합칩니다.
${input.hint ? `- 사용자 메모: ${input.hint}\n` : ""}- 회사명을 알 수 있으면 ${clSaraminRule()} search_company_info 로 회사 정보를 보완합니다 (없어도 됨).`,
    manual: () => `[공고 입력: 직접 붙여넣은 본문]
- 회사: ${input.company || "-"} / 제목: ${input.title || "-"}${input.url ? ` / 링크: ${input.url}` : ""}
--- 본문 시작 ---
${input.text}
--- 본문 끝 ---`,
  }[input.kind]();

  return `채용공고를 읽고, 같은 응답에서 지원자 적합도까지 판정해 주세요.

${how}
${input.pasted ? `\n[사용자가 붙여넣은 공고 본문 — 가장 우선하는 근거]\n${input.pasted}\n` : ""}
[공고 정리 규칙]
- 확인한 내용만 씁니다. 못 읽은 값은 "" 로 두고 missing 에 적습니다.
- requirements 에는 자격요건(필수)과 우대사항(우대)을 한 항목씩, rid 는 R1부터 차례로. label 은 짧게, detail 은 공고 원문 문장 그대로.
- deadline 은 YYYY-MM-DD (상시·채용시 마감이면 "" 그리고 deadlineText 에 표시 그대로).
- schedule 에는 공고에 적힌 날짜를 모두 넣습니다 (접수 시작·서류 발표·인적성/코딩테스트·면접·최종 발표·입사 예정 등). 날짜가 "10월 중"처럼 흐리면 넣지 말고 memo 로만 적습니다. 연도가 없으면 오늘(${todayStr()}) 기준으로 가장 가까운 미래로 봅니다.
- rawText 에는 읽은 공고 본문을 정리 없이 최대 3000자까지 옮깁니다 (나중에 원문 근거로 씁니다).
- sources 에는 실제로 쓴 도구 이름·주소를 적습니다.

${poApplicantBlock(ev)}

${PO_FIT_RULES}

[출력] 설명 없이 아래 JSON 만 출력하세요.
${JSON.stringify({
    schema: PO_SCHEMA,
    posting: {
      company: "", title: "", url: "", deadline: "", deadlineText: "", location: "", career: "", education: "",
      employmentType: "", salary: "", summary: "핵심 3줄", duties: [""],
      requirements: [{ rid: "R1", level: "필수|우대", label: "", detail: "공고 원문", keywords: [""] }],
      keywords: [""], process: [""], benefits: [""],
      companyInfo: { industry: "", size: "", employees: "", founded: "", homepage: "", summary: "" },
      schedule: [{ type: "접수 시작|서류 발표|인적성·코테|면접|최종 발표|기타", date: "YYYY-MM-DD", time: "HH:MM 또는 빈칸", memo: "" }],
      rawText: "", sources: [""], missing: [""],
    },
    fit: PO_FIT_JSON,
  }, null, 1)}`;
}

function poFitPrompt(p, ev) {
  return `아래 채용공고에 대한 지원자 적합도를 판정해 주세요.

[공고] ${p.company} · ${p.title}
경력: ${p.career || "-"} / 학력: ${p.education || "-"} / 근무지: ${p.location || "-"} / 고용형태: ${p.employmentType || "-"}
주요 업무:
${p.duties.map((d) => `- ${d}`).join("\n") || "-"}
요구사항:
${p.requirements.map((r) => `${r.rid} (${r.level}) ${r.label}${r.detail ? ` — 원문: ${r.detail}` : ""}`).join("\n") || "-"}

${poApplicantBlock(ev)}

${PO_FIT_RULES}

[출력] 설명 없이 아래 JSON 만 출력하세요.
${JSON.stringify({ schema: PO_FIT_SCHEMA, fit: PO_FIT_JSON }, null, 1)}`;
}

/* ---------- 채점 (앱이 계산) ---------- */
const poList = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);

function poComputeFit(p, raw, ev, fp = rsFingerprint()) {
  raw = raw && typeof raw === "object" ? raw : {};
  const byId = new Map(ev.map((e) => [e.id, e]));
  const warnings = [];
  const valid = (ids, where) => {
    const arr = rsArr(ids);
    const ok = arr.filter((x) => byId.has(x));
    if (arr.length > ok.length) warnings.push(`${where}: 이력서에 없는 근거 ${arr.length - ok.length}건을 제외했습니다`);
    return ok;
  };
  const pt = { 충족: 1, 부분: 0.5, 부족: 0 };

  const reqs = p.requirements.map((r) => {
    const j = poList(raw.requirements).find((x) => rsStr(x.rid) === r.rid) || {};
    let status = pt[j.status] != null ? j.status : "부족";
    const evidence = valid(j.evidence, r.rid);
    let adjusted = "";
    if (status !== "부족" && !evidence.length) {
      const to = status === "충족" ? "부분" : "부족";
      adjusted = `근거 인용이 없어 ${status} → ${to}`;
      warnings.push(`${r.rid} ${r.label}: ${adjusted}`);
      status = to;
    }
    return { ...r, status, evidence, reason: rsStr(j.reason), gap: rsStr(j.gap), adjusted };
  });

  const must = reqs.filter((r) => r.level === "필수");
  const pref = reqs.filter((r) => r.level === "우대");
  const avg = (arr) => (arr.length ? arr.reduce((n, r) => n + pt[r.status], 0) / arr.length : 0);
  let wMust = 40, wPref = 20, wExp = 25;
  if (!pref.length && must.length) { wMust = 60; wPref = 0; warnings.push("우대사항이 없어 우대 20점을 필수 요건에 합쳐 60점으로 계산했습니다"); }
  else if (!must.length && pref.length) { wPref = 60; wMust = 0; warnings.push("자격요건이 없어 필수 40점을 우대 요건에 합쳐 60점으로 계산했습니다"); }
  else if (!must.length && !pref.length) { wMust = 0; wPref = 0; wExp = 85; warnings.push("공고에서 요구사항을 읽지 못해 경험 관련성·조건만으로 계산했습니다"); }

  const e = raw.experience && typeof raw.experience === "object" ? raw.experience : {};
  let level = Math.max(0, Math.min(5, Math.round(Number(e.level) || 0)));
  const expEvidence = valid(e.evidence, "경험 관련성");
  if (level >= 3 && !expEvidence.length) { warnings.push(`경험 관련성: 근거 인용이 없어 ${level} → 2단계로 조정`); level = 2; }

  const condPt = { 부합: 1, "확인 필요": 0.5, 불일치: 0 };
  const prefs = S.resume.prefs || {};
  const known = { career: true, education: (S.resume.education || []).length > 0, location: !!rsStr(prefs.regions), employment: !!rsStr(prefs.employment) };
  const conds = PO_COND.map((c) => {
    const j = poList(raw.conditions).find((x) => x.key === c.key);
    if (!j) warnings.push(`${c.label}: 판정이 빠져 있어 「확인 필요」(절반 점수)로 계산했습니다`);
    const status = j && condPt[j.status] != null ? j.status : "확인 필요";
    return { ...c, status, known: known[c.key], posting: rsStr(j?.posting), mine: rsStr(j?.mine), reason: rsStr(j?.reason) };
  });
  /* 내가 알려주지 않은 조건(희망 근무지·고용형태 미입력 등)은 점수에서 빼고 나머지로 15점을 채웁니다 */
  const scored = conds.filter((c) => c.known);
  const condW = scored.reduce((n, c) => n + c.w, 0);
  const condScale = condW ? 15 / condW : 0;
  if (scored.length < conds.length) warnings.push(`희망 조건에 적지 않은 항목(${conds.filter((c) => !c.known).map((c) => c.label).join("·")})은 점수에서 빼고 나머지로 계산했습니다 — ① 내 이력서의 희망 조건을 채우면 더 정확해집니다`);

  const parts = [
    { key: "must", label: "필수 요건", weight: wMust, got: wMust * avg(must), detail: `${must.length}개 중 충족 ${must.filter((r) => r.status === "충족").length} · 부분 ${must.filter((r) => r.status === "부분").length}` },
    { key: "pref", label: "우대 요건", weight: wPref, got: wPref * avg(pref), detail: pref.length ? `${pref.length}개 중 충족 ${pref.filter((r) => r.status === "충족").length} · 부분 ${pref.filter((r) => r.status === "부분").length}` : "우대사항 없음 → 필수에 합산" },
    { key: "exp", label: "직무 경험이 얼마나 가까운가", weight: wExp, got: (wExp * level) / 5, detail: `${level} / 5단계` },
    { key: "cond", label: "지원 조건", weight: 15, got: scored.reduce((n, c) => n + c.w * condScale * condPt[c.status], 0),
      detail: conds.map((c) => `${c.label} ${c.known ? c.status : "정보 없음(제외)"}`).join(" · ") },
  ].map((x) => ({ ...x, got: Math.round(x.got * 10) / 10 }));
  const blockers = conds.filter((c) => c.status === "불일치" && (c.key === "career" || c.key === "education"));
  let total = Math.round(parts.reduce((n, x) => n + x.got, 0));
  /* 경력·학력 조건이 맞지 않으면 다른 점수가 높아도 지원 자체가 어려우므로 39점을 넘지 않게 */
  const capped = blockers.length && total > 39;
  if (capped) { warnings.push(`${blockers.map((b) => b.label).join("·")} 조건 불일치로 ${total}점 → 39점 상한 적용`); total = 39; }

  const used = new Set([...reqs.flatMap((r) => r.evidence), ...expEvidence, ...poList(raw.strengths).flatMap((s) => rsArr(s.evidence))]);
  const evidenceSnap = {};
  used.forEach((id) => { if (byId.has(id)) evidenceSnap[id] = { where: byId.get(id).where, text: byId.get(id).text }; });

  return {
    at: todayStr(), fp, prefsAt: rsPrefsText(), evidenceSnap,
    computed: { total, capped: !!capped, grade: capped ? "조건 미달" : PO_GRADE(total), parts, reqs, exp: { level, evidence: expEvidence, reason: rsStr(e.reason) }, conds, warnings, blockers: blockers.map((b) => b.label) },
    summary: rsStr(raw.summary),
    strengths: (Array.isArray(raw.strengths) ? raw.strengths : []).map((s) => (typeof s === "string" ? { text: s, evidence: [] } : { text: rsStr(s?.text), evidence: rsArr(s?.evidence).filter((x) => byId.has(x)) })).filter((s) => s.text),
    gaps: rsArr(raw.gaps), resumeTips: rsArr(raw.resumeTips),
    actions: (Array.isArray(raw.actions) ? raw.actions : []).map((a) => (typeof a === "string" ? { what: a, why: "" } : { what: rsStr(a?.what), why: rsStr(a?.why) })).filter((a) => a.what),
  };
}

/* 공고에서 찾은 날짜를 일정으로 넣습니다. 공고에서 온 일정만 다시 읽을 때 갈아 끼우고, 내가 넣은 일정은 건드리지 않습니다. */
function poApplySchedule(p, schedule) {
  const rows = (Array.isArray(schedule) ? schedule : []).filter((x) => x && /^\d{4}-\d{2}-\d{2}$/.test(String(x.date)))
    .filter((x) => !/마감|접수\s*마감/.test(rsStr(x.type)) && x.date !== p.deadline)   /* 마감일은 따로 관리 — 달력에 두 번 나오지 않게 */
    .filter((x) => x.date >= todayStr());   /* 이미 지난 날짜(접수 시작 등)는 달력을 어지럽히므로 넣지 않습니다 */
  p.events = p.events.filter((e) => !e.auto);
  let n = 0;
  rows.forEach((x) => {
    const type = PO_EVENT_TYPES.includes(x.type) ? x.type : ["접수 시작", "입사 예정"].includes(rsStr(x.type)) ? "기타" : "기타";
    if (p.events.some((e) => e.date === x.date && e.type === type)) return;
    p.events.push({ id: uid("ev"), type, date: x.date, time: /^\d{2}:\d{2}$/.test(rsStr(x.time)) ? rsStr(x.time) : "",
      memo: [rsStr(x.type) !== type ? rsStr(x.type) : "", rsStr(x.memo)].filter(Boolean).join(" · "), auto: true });
    n++;
  });
  /* 마감일은 따로 관리하지만, 달력에서 함께 보이도록 D-3 점검 알림을 하나 둡니다 */
  if (p.deadline) {
    const d = new Date(`${p.deadline}T00:00:00`);
    d.setDate(d.getDate() - 3);
    const pre = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    if (pre > todayStr() && !p.events.some((e) => e.date === pre && e.memo.includes("마감 3일 전"))) {
      p.events.push({ id: uid("ev"), type: "기타", date: pre, time: "", memo: "마감 3일 전 — 자소서·서류 마무리", auto: true });
      n++;
    }
  }
  p.events.sort((a, b) => (a.date + (a.time || "")).localeCompare(b.date + (b.time || "")));
  return n;
}

/* 키워드 일치 — AI 없이 즉시 계산하는 참고 지표 (적합도와 별개) */
function poKeywordMatch(p) {
  const corpus = rsEvidence().map((e) => e.text).join(" ").toLowerCase();
  const words = [...new Set([...p.keywords, ...p.requirements.flatMap((r) => r.keywords)].map((w) => rsStr(w)).filter((w) => w.length >= 2))];
  const hit = words.filter((w) => corpus.includes(w.toLowerCase()));
  return { pct: words.length ? Math.round((hit.length / words.length) * 100) : 0, hit, miss: words.filter((w) => !hit.includes(w)), total: words.length };
}

/* ---------- 실행 파이프라인 ---------- */
const poInputs = new Map();   /* id → 입력 (스크린샷 File 등은 저장하지 않고 이번 세션 메모리에만) */

function poCreate(base, input) {
  const [p] = poNormalize([{ ...base, status: "pending" }]);
  p.status = "analyzing";
  S.postings.unshift(p);
  poInputs.set(p.id, input);
  save();
  return p;
}

async function poAnalyze(id, { fitOnly = false } = {}) {
  const p = poGet(id);
  if (!p) return;
  const input = poInputs.get(id);
  const ev = rsEvidence();
  const fp = rsFingerprint();
  if (!input && !fitOnly && (p.source === "image")) {
    const files = await poShotLoad(id);
    if (files.length) { poInputs.set(id, { kind: "image", files, hint: p.hint }); return poAnalyze(id); }
  }
  if (!ev.length && !confirm("내 이력서가 비어 있어 적합도가 0점으로 나옵니다. 그래도 공고를 읽을까요?\n(① 내 이력서를 먼저 채우는 것을 권합니다)")) {
    p.status = "pending"; save(); render(); return;
  }
  const doFull = !fitOnly && input;
  if (!doFull && !p.requirements.length) {
    p.status = "error";
    p.error = p.source === "image" ? "보관된 스크린샷이 없습니다. 이 공고를 삭제하고 스크린샷을 다시 넣어 주세요." : "공고 내용이 없어 평가할 수 없습니다. 링크나 본문으로 다시 넣어 주세요.";
    save(); renderSoft(); return;
  }
  p.status = "analyzing"; p.error = ""; save(); renderSoft();
  try {
    const data = await clRun(doFull ? {
      title: `공고 읽기·적합도 — ${p.company || p.title || "새 공고"}`,
      prompt: poFullPrompt(p, input, ev),
      files: (input.files || []).map((f) => ({ file: f, name: f.name, attachHint: true })),
      saramin: input.kind !== "manual", web: input.kind === "link",
      webDomains: input.kind === "link" ? poDomains(input.url) : [], expect: PO_SCHEMA,
    } : {
      title: `적합도 평가 — ${p.company}`, prompt: poFitPrompt(p, ev), expect: PO_FIT_SCHEMA,
    });
    const target = poGet(id);
    if (!target) return;
    if (!data) { target.status = "pending"; save(); renderSoft(); return; }
    if (doFull) {
      const [np] = poNormalize([{ ...data.posting, source: input.kind }]);
      if (!np.title && !np.company) throw new Error("공고 제목·회사명을 읽지 못했습니다. 본문을 붙여넣거나 스크린샷으로 다시 시도하세요.");
      const userSet = input.kind === "manual" ? ["company", "title", "deadline"].filter((k) => rsStr(target[k])) : [];   /* 직접 입력한 값은 지킵니다 */
      ["company", "title", "deadline", "deadlineText", "location", "career", "education", "employmentType", "salary", "summary",
        "duties", "keywords", "process", "benefits", "requirements", "companyInfo", "sources", "missing", "rawText"].forEach((k) => {
        const v = np[k];
        if (userSet.includes(k)) return;
        if (Array.isArray(v) ? v.length : v && (typeof v !== "object" || Object.values(v).some(Boolean))) target[k] = v;
      });
      if (input.url) { target.url = input.url; target.recIdx = poRecIdx(input.url); }
      if (input.kind === "manual" && !target.rawText) target.rawText = input.text;
      poApplySchedule(target, np.schedule || data.posting?.schedule);

      poInputs.delete(id);
      poShotDrop(id);
    }
    target.fit = poComputeFit(target, data.fit || {}, ev, fp);
    target.status = "ready";
    save(); renderSoft();
    const c = target.fit.computed;
    const autoN = target.events.filter((e) => e.auto).length;
    toast(`✅ ${target.company} — 적합도 ${c.total}점 (${c.grade})${autoN ? ` · 일정 ${autoN}개 자동 등록` : ""}`, "ok",
      { label: "결과 보기", run: () => { location.hash = `#/postings/${id}`; } });
  } catch (e) {
    const target = poGet(id);
    if (target) { target.status = "error"; target.error = e.message; save(); renderSoft(); }
    toast(`❌ ${e.message}`, "warn");
  }
}

/* 입력 → 생성 → 분석 */
function poAddLink(raw, pasted = "", extra = {}) {
  const url = poCleanUrl(raw);
  if (!url) { toast("공고 링크(https://…)를 넣어 주세요.", "warn"); return; }
  const rec = poRecIdx(url);
  const dup = S.postings.find((p) => p.url === url || (rec && p.recIdx === rec));
  if (dup) { toast(`이미 추가한 공고입니다 — ${dup.company || dup.title}`, "", { label: "열기", run: () => { location.hash = `#/postings/${dup.id}`; } }); return; }
  const p = poCreate({ source: extra.source || "link", url, recIdx: rec, title: extra.title || "", company: extra.company || "", hint: extra.hint || "" }, { kind: "link", url, pasted });
  poAddDone(p);
}

function poAddImages(files, hint) {
  if (!files.length) { toast("공고 스크린샷을 1장 이상 넣어 주세요.", "warn"); return; }
  const p = poCreate({ source: "image", hint }, { kind: "image", files, hint });
  poShotKeep(p.id, files);
  poAddDone(p);
}

/* ---------- 스크린샷 임시 보관 (IndexedDB) ----------
   분석이 끝나기 전에 새로고침·실패해도 다시 올리지 않도록 보관하고, 분석이 성공하거나 공고를 지우면 버립니다. */
function poDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open("job-portfolio", 1);
    req.onupgradeneeded = () => req.result.createObjectStore("shots");
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}
async function poShotKeep(id, files) {
  try {
    const db = await poDb();
    const items = await Promise.all(files.map(async (f) => ({ name: f.name, type: f.type, buf: await f.arrayBuffer() })));
    db.transaction("shots", "readwrite").objectStore("shots").put(items, id);
  } catch (e) { /* 보관 실패해도 이번 분석은 진행 */ }
}
async function poShotLoad(id) {
  try {
    const db = await poDb();
    const items = await new Promise((r) => { const q = db.transaction("shots").objectStore("shots").get(id); q.onsuccess = () => r(q.result || []); q.onerror = () => r([]); });
    return items.map((x) => new File([x.buf], x.name, { type: x.type }));
  } catch (e) { return []; }
}
async function poShotDrop(id) {
  try { (await poDb()).transaction("shots", "readwrite").objectStore("shots").delete(id); } catch (e) { /* 무시 */ }
}

function poAddManual({ company, title, url, deadline, text }) {
  if (!text.trim() || (!company.trim() && !title.trim())) { toast("회사명(또는 제목)과 공고 내용을 넣어 주세요.", "warn"); return; }
  const cu = poCleanUrl(url);
  const p = poCreate({ source: "manual", company, title, url: cu, deadline, rawText: text }, { kind: "manual", company, title, url: cu, text });
  poAddDone(p);
}

function poAddDone(p) {
  poShot = [];
  poForm = { url: "", pasted: "", hint: "", company: "", title: "", murl: "", deadline: "", text: "" };
  render();
  poAnalyze(p.id);
}

/* ---------- 사람인에서 찾기 ---------- */
let poSearch = { keyword: "", region: "", results: [], at: "" };

async function poRunSearch() {
  const q = { keyword: poSearch.keyword || S.me.desiredJob, region: poSearch.region || S.resume.prefs.regions, level: S.resume.prefs.level };
  if (!q.keyword) { toast("검색할 직무 키워드를 넣어 주세요.", "warn"); return; }
  try {
    const data = await clRun({
      title: `사람인에서 찾기 — ${q.keyword}`, saramin: true, expect: "pf-search-v1",
      prompt: `사람인 도구로 채용공고를 찾아 주세요. 웹 검색이나 기억으로 공고를 만들지 마세요.
- 직무 키워드: ${q.keyword}
- 지역: ${q.region || "무관"}
- 경력: ${q.level}
1) 지역이 있으면 search_location_codes 로 코드를 찾고 2) search_saramin_jobs 를 검색어 중심으로 호출합니다 (경력 조건은 검색어에 "신입"/"경력"으로 붙임).
3) 조건에 맞는 공고 최대 12건. 도구가 준 글자를 그대로 옮기고 없는 값은 "".
[출력] JSON 만: ${JSON.stringify({ schema: "pf-search-v1", mcpUsed: true, jobs: [{ recIdx: "", title: "", company: "", location: "", career: "", deadlineText: "", url: "" }] })}`,
    });
    if (!data) return;
    if (!data.mcpUsed) { toast("사람인 검색을 쓰지 못했습니다. 위쪽 [연결 설정]에서 사람인을 연결해 주세요.", "warn"); return; }
    poSearch.results = (Array.isArray(data.jobs) ? data.jobs : []).filter((j) => j && j.title).slice(0, 12).map((j) => ({
      ...j, url: /^\d{5,12}$/.test(rsStr(j.recIdx)) ? `https://www.saramin.co.kr/zf_user/jobs/relay/view?rec_idx=${rsStr(j.recIdx)}`
        : /saramin\.co\.kr/.test(poCleanUrl(j.url)) ? poCleanUrl(j.url) : "",
    })).filter((j) => j.url);   /* 사람인 공고 번호·주소가 없는 결과는 지어낸 것일 수 있어 버립니다 */
    if (!poSearch.results.length) { toast("사람인에서 확인된 공고가 없습니다. 검색어를 바꾸거나 링크로 넣어 보세요.", "warn"); return; }
    poSearch.at = todayStr();
    render();
  } catch (e) { toast("❌ " + e.message, "warn"); }
}

/* ---------- 버튼 ---------- */
let poTab = "link";
let poShot = [];     /* 스크린샷 File[] */
let poForm = { url: "", pasted: "", hint: "", company: "", title: "", murl: "", deadline: "", text: "" };
let poFilter = "all";
let poSort = "score";

function postingsAction(act, btn) {
  if (!String(act).startsWith("po-")) return false;
  const id = btn.dataset.id;
  const p = id ? poGet(id) : null;
  switch (act) {
    case "po-tab": poTab = btn.dataset.tab; render(); break;
    case "po-add-link": poAddLink(poForm.url, poForm.pasted); break;
    case "po-add-image": poAddImages(poShot, poForm.hint); break;
    case "po-add-manual": poAddManual({ company: poForm.company, title: poForm.title, url: poForm.murl, deadline: poForm.deadline, text: poForm.text }); break;
    case "po-shot-pick": {
      const input = document.createElement("input");
      input.type = "file"; input.multiple = true; input.accept = "image/*";
      input.onchange = () => { poShot = poShot.concat([...input.files]).slice(0, 10); render(); };
      input.click();
      break;
    }
    case "po-shot-del": poShot.splice(Number(btn.dataset.i), 1); render(); break;
    case "po-search": poRunSearch(); break;
    case "po-search-add": {
      const j = poSearch.results[Number(btn.dataset.i)];
      if (j) poAddLink(j.url, "", { source: "search", title: j.title, company: j.company });
      break;
    }
    case "po-filter": poFilter = btn.dataset.f; render(); break;
    case "po-star": if (p) { p.star = !p.star; save(); render(); } break;
    case "po-retry":
      if (!p) break;
      if (poInputs.has(p.id) || p.source === "image" && !p.requirements.length) poAnalyze(p.id);
      else if (p.requirements.length) poAnalyze(p.id, { fitOnly: true });
      else postingsAction("po-reread", btn);
      break;
    case "po-refit": if (p) poAnalyze(p.id, { fitOnly: true }); break;
    case "po-reread":
      if (p && p.url) { poInputs.set(p.id, { kind: "link", url: p.url }); poAnalyze(p.id); }
      else if (p && p.rawText) { poInputs.set(p.id, { kind: "manual", company: p.company, title: p.title, text: p.rawText }); poAnalyze(p.id); }
      else if (p) toast("공고 링크나 본문이 없어 다시 읽을 수 없습니다. 삭제 후 스크린샷·직접 입력으로 다시 넣으세요.", "warn");
      break;
    case "po-del":
      if (p) {
        const idx = S.postings.indexOf(p);
        S.postings.splice(idx, 1); save();
        setTimeout(() => { if (!poGet(p.id)) poShotDrop(p.id); }, 10000);   /* 되돌리기 시간이 지난 뒤 버림 */
        if (location.hash.includes(p.id)) location.hash = "#/postings"; else render();
        toast(`「${p.company || p.title || "공고"}」를 삭제했습니다`, "", { label: "되돌리기", run: () => { S.postings.splice(idx, 0, p); save(); render(); } });
      }
      break;
    case "po-ev-add":
      if (p) {
        const box = btn.closest(".ev-add");
        const type = box.querySelector("[name=type]").value, date = box.querySelector("[name=date]").value;
        if (!date) { toast("날짜를 고르세요.", "warn"); break; }
        p.events.push({ id: uid("ev"), type, date, time: box.querySelector("[name=time]").value, memo: box.querySelector("[name=memo]").value.trim() });
        p.events.sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));
        save(); render();
      }
      break;
    case "po-ev-del": if (p) { p.events = p.events.filter((e) => e.id !== btn.dataset.ev); save(); render(); } break;
    default: return false;
  }
  return true;
}

/* 입력 칸 (data-po) · 전형 단계 변경 */
function postingsInput(t) {
  if (t.dataset.po) { poForm[t.dataset.po] = t.value; return true; }
  if (t.dataset.poSearch) { poSearch[t.dataset.poSearch] = t.value; return true; }
  if (t.dataset.poSort) { poSort = t.value; render(); return true; }
  if (t.dataset.poDeadline) {
    const p = poGet(t.dataset.poDeadline);
    if (p) { p.deadline = /^\d{4}-\d{2}-\d{2}$/.test(t.value) ? t.value : ""; poApplySchedule(p, []); save(); render(); }   /* 마감 3일 전 알림도 다시 계산 */
    return true;
  }
  if (t.dataset.poApply) {
    const p = poGet(t.dataset.id);
    if (!p) return true;
    const k = t.dataset.poApply;
    if (k === "submitted") {
      p.apply.submitted = t.checked;
      p.apply.submittedAt = t.checked ? todayStr() : "";
      if (t.checked) {
        if (!PO_ACTIVE.includes(p.stage) || p.stage === "지원 예정") p.stage = "지원 완료";
        if (!p.events.some((e) => e.type === "지원 완료")) p.events.push({ id: uid("ev"), type: "지원 완료", date: todayStr(), time: "", memo: "" });
        toast("📮 지원 완료로 기록했습니다", "ok");
      }
      save(); render();
    } else {
      p.apply[k] = t.value;
      save();
    }
    return true;
  }
  if (t.dataset.poDoc) {
    const p = poGet(t.dataset.id);
    if (!p) return true;
    p.apply.docs = t.checked ? [...new Set([...p.apply.docs, t.dataset.poDoc])] : p.apply.docs.filter((d) => d !== t.dataset.poDoc);
    save(); render();
    return true;
  }
  if (t.dataset.poStage) {
    const p = poGet(t.dataset.poStage);
    if (!p) return true;
    const prev = p.stage;
    p.stage = t.value;
    if (t.value === "지원 완료" && prev !== "지원 완료" && !p.events.some((e) => e.type === "지원 완료")) {
      p.events.push({ id: uid("ev"), type: "지원 완료", date: todayStr(), time: "", memo: "" });
      toast("📅 오늘 날짜로 「지원 완료」 일정을 기록했습니다");
    }
    save(); render();
    return true;
  }
  return false;
}

/* 미리보기 주소는 파일마다 한 번만 만듭니다 (다시 그릴 때마다 새로 만들면 메모리가 샙니다) */
const poThumbs = new WeakMap();
function poThumb(f) {
  if (!poThumbs.has(f)) poThumbs.set(f, URL.createObjectURL(f));
  return poThumbs.get(f);
}

/* 스크린샷 붙여넣기(⌘V)·끌어놓기 */
function poAcceptImages(list) {
  const imgs = [...list].filter((f) => f.type && f.type.startsWith("image/"));
  if (!imgs.length) return false;
  poShot = poShot.concat(imgs.map((f, i) => (f.name ? f : new File([f], `screenshot-${Date.now()}-${i}.png`, { type: f.type })))).slice(0, 10);
  poTab = "image";
  render();
  return true;
}

/* ============================================================
   화면 — 목록
   ============================================================ */
function renderPostings(sub) {
  if (sub) return renderPostingDetail(sub);
  const comp = rsCompleteness();
  const list = S.postings;
  const counts = {
    all: list.length, star: list.filter((p) => p.star).length,
    active: list.filter((p) => PO_ACTIVE.includes(p.stage)).length,
    closed: list.filter((p) => PO_DONE.includes(p.stage) || (p.deadline && dday(p.deadline).kind === "off")).length,
  };
  const shown = list.filter((p) => poFilter === "star" ? p.star : poFilter === "active" ? PO_ACTIVE.includes(p.stage)
    : poFilter === "closed" ? PO_DONE.includes(p.stage) || (p.deadline && dday(p.deadline).kind === "off")
    : !(PO_DONE.includes(p.stage)))
    .slice().sort((a, b) => {
      if (poSort === "deadline") return (a.deadline || "9999").localeCompare(b.deadline || "9999");
      if (poSort === "recent") return b.createdAt.localeCompare(a.createdAt);
      return (b.fit?.computed.total ?? -1) - (a.fit?.computed.total ?? -1);
    });

  return `
  <div class="view-head">
    <h2>② 채용공고</h2>
    <p class="muted">공고를 넣으면 바로 목록에 뜨고 공고를 읽어 <strong>내 이력서와의 적합도</strong>를 매깁니다. ${clReady() ? "뒤에서 실행되니 기다리지 않고 여러 개를 넣어도 됩니다." : CL.mode === "local" ? "상단에서 Claude 로그인을 하면 뒤에서 자동으로 실행됩니다." : "claude.ai 모드에서는 공고마다 복사·붙여넣기 창이 열립니다."}</p>
  </div>

  ${comp.score < 50 ? `<p class="notice warn">① 내 이력서 완성도가 ${comp.score}% 입니다. 이력서가 비어 있으면 적합도가 낮게 나옵니다. <a href="#/resume">이력서 채우기 →</a></p>` : ""}

  <section class="card add-card">
    <div class="seg" role="tablist">
      ${[["link", "🔗 링크"], ["image", "🖼 스크린샷"], ["manual", "✍ 직접 입력"], ["search", "🔎 사람인에서 찾기"]].map(([k, l]) =>
        `<button class="seg-btn" role="tab" aria-selected="${poTab === k}" data-act="po-tab" data-tab="${k}" type="button">${l}</button>`).join("")}
    </div>
    ${poAddFormHTML()}
  </section>

  <div class="list-bar">
    <div class="chips">
      ${[["all", "진행 중인 공고", counts.all - list.filter((p) => PO_DONE.includes(p.stage)).length], ["star", "★ 관심", counts.star], ["active", "지원 진행", counts.active], ["closed", "마감·종료", counts.closed]].map(([k, l, n]) =>
        `<button class="chip ${poFilter === k ? "accent" : ""}" data-act="po-filter" data-f="${k}" type="button">${l} ${n}</button>`).join("")}
    </div>
    <div class="row">
      <details class="rubric-pop"><summary class="btn btn-sm btn-ghost">점수 기준 보기</summary>${poRubricHTML()}</details>
      <select data-po-sort="1" aria-label="정렬">
        ${[["score", "적합도 높은 순"], ["deadline", "마감 임박 순"], ["recent", "최근 추가 순"]].map(([k, l]) => `<option value="${k}"${poSort === k ? " selected" : ""}>${l}</option>`).join("")}
      </select>
    </div>
  </div>

  ${shown.length ? `<div class="po-list">${shown.map(poCardHTML).join("")}</div>`
    : `<section class="card"><p class="empty">${list.length ? "이 조건에 맞는 공고가 없습니다." : "아직 공고가 없습니다. 위에서 링크·스크린샷·직접 입력으로 넣어 보세요."}</p></section>`}`;
}

function poAddFormHTML() {
  if (poTab === "link") return `
    <div class="row add-row">
      <input type="url" inputmode="url" data-po="url" value="${esc(poForm.url)}" placeholder="사람인 · 잡코리아 · 원티드 · 회사 채용 페이지 링크" aria-label="공고 링크">
      <button class="btn btn-primary" data-act="po-add-link" type="button">추가하고 분석</button>
    </div>
    <details class="sub-det"><summary>페이지 본문이 안 읽히는 공고라면 — 본문 붙여넣기 (선택)</summary>
      <textarea data-po="pasted" rows="4" placeholder="자격요건·우대사항·주요 업무를 복사해 붙여넣으면 정확해집니다">${esc(poForm.pasted)}</textarea></details>
    <p class="muted small">사람인 공고는 회사 정보까지 함께 확인합니다. 로그인해야 보이는 공고나 이미지로 된 공고는 <button class="link-btn" data-act="po-tab" data-tab="image" type="button">스크린샷</button>으로 넣으세요.</p>`;

  if (poTab === "image") return `
    <div class="drop" data-drop="1" tabindex="0">
      ${poShot.length ? `<div class="shots">${poShot.map((f, i) => `
        <figure class="shot"><img src="${esc(poThumb(f))}" alt="스크린샷 ${i + 1}">
          <figcaption>${i + 1}</figcaption><button class="shot-del" data-act="po-shot-del" data-i="${i}" type="button" aria-label="삭제">×</button></figure>`).join("")}
        <button class="shot add" data-act="po-shot-pick" type="button">＋</button></div>`
      : `<button class="drop-empty" data-act="po-shot-pick" type="button">
          <strong>공고 캡처를 여기에 끌어놓거나 ⌘V 로 붙여넣기</strong>
          <span class="muted">긴 공고는 여러 장으로 나눠 찍어 순서대로 넣으세요 (최대 10장)</span></button>`}
    </div>
    <div class="row add-row">
      <input type="text" data-po="hint" value="${esc(poForm.hint)}" placeholder="메모 (선택) — 예: OO회사 마케팅 공고, 마감 10/3">
      <button class="btn btn-primary" data-act="po-add-image" type="button" ${poShot.length ? "" : "disabled"}>추가하고 분석</button>
    </div>
    <p class="muted small">🔒 스크린샷은 분석이 끝나면 지웁니다 (실패하면 다시 시도할 수 있게 그 공고를 지울 때까지만 보관). 저장되는 것은 읽어낸 공고 글자입니다.${CL.mode !== "local" ? " claude.ai 모드에서는 안내 창에서 이미지를 직접 첨부합니다." : ""}</p>`;

  if (poTab === "manual") return `
    <div class="rs-fields">
      <label class="field"><span>회사명 *</span><input type="text" data-po="company" value="${esc(poForm.company)}"></label>
      <label class="field span2"><span>공고 제목</span><input type="text" data-po="title" value="${esc(poForm.title)}"></label>
      <label class="field"><span>마감일</span><input type="date" data-po="deadline" value="${esc(poForm.deadline)}"></label>
      <label class="field span2"><span>링크 (선택)</span><input type="url" data-po="murl" value="${esc(poForm.murl)}"></label>
    </div>
    <label class="field"><span>공고 내용 * — 주요 업무·자격요건·우대사항을 붙여넣기</span>
      <textarea data-po="text" rows="7">${esc(poForm.text)}</textarea></label>
    <div class="row" style="justify-content:flex-end"><button class="btn btn-primary" data-act="po-add-manual" type="button">저장하고 분석</button></div>`;

  return `
    <div class="row add-row">
      <input type="text" data-po-search="keyword" value="${esc(poSearch.keyword)}" placeholder="직무 키워드 (비우면 희망 직무: ${esc(S.me.desiredJob || "-")})">
      <input type="text" data-po-search="region" value="${esc(poSearch.region)}" placeholder="지역 (비우면 희망 근무지: ${esc(S.resume.prefs.regions || "무관")})" style="max-width:260px">
      <button class="btn btn-primary" data-act="po-search" type="button" ${CL.mode === "local" && !CL.mcp?.authed ? "disabled" : ""}>사람인 검색</button>
    </div>
    <p class="muted small">${CL.mcp?.authed ? `사람인에서 찾습니다. 마음에 드는 공고를 [추가]하면 공고를 읽고 적합도를 매깁니다. 경력 구분은 희망 조건(${esc(S.resume.prefs.level)})을 씁니다.`
      : `<span class="warn-text">사람인 연결이 필요한 기능입니다.</span> 오른쪽 위 <button class="link-btn" data-act="setup" type="button">[연결 설정]</button>에서 사람인을 연결하면 쓸 수 있습니다. 그전에는 링크·스크린샷·직접 입력을 이용하세요.`}</p>
    ${poSearch.results.length ? `<div class="search-list">${poSearch.results.map((j, i) => {
      const added = S.postings.some((p) => (j.recIdx && p.recIdx === j.recIdx) || (j.url && p.url === j.url));
      return `<div class="search-item">
        <div><strong>${esc(j.title)}</strong><div class="muted small">${[j.company, j.location, j.career, j.deadlineText].filter(Boolean).map(esc).join(" · ")}</div></div>
        <div class="row">${j.url ? `<a class="btn btn-sm btn-ghost" href="${esc(j.url)}" target="_blank" rel="noopener noreferrer">보기 ↗</a>` : ""}
          ${added ? `<span class="chip ok">추가됨</span>` : `<button class="btn btn-sm" data-act="po-search-add" data-i="${i}" type="button" ${j.url ? "" : "disabled"}>추가</button>`}</div>
      </div>`; }).join("")}</div><p class="muted small">조회 ${esc(poSearch.at)} · 출처: 사람인</p>` : ""}`;
}

function poRubricHTML() {
  return `<div class="rubric">
    <strong>적합도는 이렇게 매깁니다 (100점 만점)</strong>
    <table>${PO_RUBRIC.map((r) => `<tr><th>${esc(r.label)}</th><td class="num">${r.weight}</td><td>${esc(r.how)}</td></tr>`).join("")}</table>
    <p class="muted small">근거는 <strong>① 내 이력서에 적은 문장</strong>만 인정합니다. 이력서에 없는 내용을 근거로 들면 빼고, 근거 없이 "충족"이라고 한 항목은 한 단계 낮춰 계산합니다. 등급: 85↑ 매우 적합 · 70↑ 적합 · 55↑ 보통 · 40↑ 도전 · 그 아래 낮음</p>
    <p class="muted small"><strong>키워드 일치</strong>는 공고 키워드가 이력서에 글자 그대로 있는지 센 참고 지표로, 적합도 점수와 별개입니다.</p>
  </div>`;
}

function poScoreHTML(p, big = false) {
  if (p.status === "analyzing") return `<div class="score busy"><i class="spin"></i><span>분석 중</span></div>`;
  if (p.status === "error") return `<div class="score err"><strong>!</strong><span>실패</span></div>`;
  if (!p.fit) return `<div class="score"><strong>–</strong><span>대기</span></div>`;
  const c = p.fit.computed;
  return `<div class="score ${PO_TONE(c.total)}${big ? " big" : ""}"><strong>${c.total}</strong><span>${esc(c.grade)}</span></div>`;
}

function poCardHTML(p) {
  const d = p.deadline ? dday(p.deadline) : null;
  const stale = poStale(p);
  const c = p.fit?.computed;
  const kw = p.title ? poKeywordMatch(p) : null;
  return `
  <article class="card po-card">
    <button class="star ${p.star ? "on" : ""}" data-act="po-star" data-id="${esc(p.id)}" type="button" aria-label="${p.star ? "관심 해제" : "관심 공고"}" aria-pressed="${p.star}">${p.star ? "★" : "☆"}</button>
    <a class="po-main" href="#/postings/${esc(p.id)}">
      ${poScoreHTML(p)}
      <div class="po-title">
        <div class="po-line"><strong>${esc(p.title || (p.status === "analyzing" ? "공고를 읽는 중…" : p.url || "제목 없음"))}</strong>
          ${d ? `<span class="chip ${d.kind}">${esc(d.text)}</span>` : p.deadlineText ? `<span class="chip">${esc(p.deadlineText)}</span>` : ""}</div>
        <div class="muted small">${[p.company, p.location, p.career, p.employmentType].filter(Boolean).map(esc).join(" · ") || esc({ link: "링크", image: "스크린샷", manual: "직접 입력", search: "사람인 검색" }[p.source])}${p.apply?.submitted ? ` · <span class="ok-text">📮 제출 ${esc(p.apply.submittedAt)}</span>` : ""}</div>
        ${p.status === "error" ? `<p class="small err-text">${esc(p.error)}</p>`
          : c ? `<p class="small">${esc(p.fit.summary || "")}</p>
              ${c.blockers.length ? `<p class="small err-text">⛔ 지원 조건 불일치: ${c.blockers.map(esc).join(", ")}</p>` : ""}
              <p class="muted small">필수 ${c.reqs.filter((r) => r.level === "필수" && r.status === "충족").length}/${c.reqs.filter((r) => r.level === "필수").length} 충족${kw && kw.total ? ` · 키워드 일치 ${kw.pct}%` : ""}${stale ? ` · <span class="warn-text">이력서 변경됨</span>` : ""}</p>` : ""}
      </div>
    </a>
    <div class="po-side">
      <select data-po-stage="${esc(p.id)}" aria-label="전형 단계">${PO_STAGES.map((s) => `<option${s === p.stage ? " selected" : ""}>${s}</option>`).join("")}</select>
      ${p.status === "error" || p.status === "pending" ? `<button class="btn btn-sm btn-primary" data-act="po-retry" data-id="${esc(p.id)}" type="button">${p.status === "error" ? "다시 시도" : "분석하기"}</button>`
        : p.status === "ready" && !p.fit ? `<button class="btn btn-sm btn-primary" data-act="${p.requirements.length ? "po-refit" : "po-reread"}" data-id="${esc(p.id)}" type="button">적합도 평가</button>`
        : stale ? `<button class="btn btn-sm" data-act="po-refit" data-id="${esc(p.id)}" type="button">다시 평가</button>` : ""}
    </div>
  </article>`;
}

/* ============================================================
   화면 — 상세
   ============================================================ */
function renderPostingDetail(id) {
  const p = poGet(id);
  if (!p) return `<section class="card"><p class="empty">공고를 찾을 수 없습니다. <a href="#/postings">목록으로</a></p></section>`;
  const f = p.fit;
  const c = f?.computed;
  const stale = poStale(p);
  const kw = poKeywordMatch(p);
  const snap = f?.evidenceSnap || {};
  const evList = (ids) => rsArr(ids).map((x) => snap[x] ? `<li><span class="ev-id">${esc(x)}</span> ${esc(snap[x].text)} <span class="muted small">— ${esc(snap[x].where)}</span></li>` : "").join("");
  const st = (s) => `<span class="chip ${s === "충족" || s === "부합" ? "ok" : s === "부분" || s === "확인 필요" ? "accent" : "warn"}">${esc(s)}</span>`;
  const d = p.deadline ? dday(p.deadline) : null;

  return `
  <div class="detail-top">
    <a class="btn btn-sm btn-ghost" href="#/postings">← 공고 목록</a>
    <div class="row wrap">
      <select data-po-stage="${esc(p.id)}" aria-label="전형 단계">${PO_STAGES.map((s) => `<option${s === p.stage ? " selected" : ""}>${s}</option>`).join("")}</select>
      ${p.url ? `<a class="btn btn-sm" href="${esc(p.url)}" target="_blank" rel="noopener noreferrer">원 공고 ↗</a>` : ""}
      <button class="btn btn-sm btn-danger" data-act="po-del" data-id="${esc(p.id)}" type="button">삭제</button>
    </div>
  </div>

  <section class="card detail-head">
    <button class="star ${p.star ? "on" : ""}" data-act="po-star" data-id="${esc(p.id)}" type="button" aria-pressed="${p.star}" aria-label="관심 공고">${p.star ? "★" : "☆"}</button>
    ${poScoreHTML(p, true)}
    <div class="po-title">
      <h2>${esc(p.title || "제목 없음")}</h2>
      <p class="muted">${[p.company, p.location, p.career, p.education, p.employmentType, p.salary].filter(Boolean).map(esc).join(" · ")}</p>
      <div class="chips" style="margin-top:6px">
        ${d ? `<span class="chip ${d.kind}">마감 ${esc(p.deadline)} · ${esc(d.text)}</span>` : p.deadlineText ? `<span class="chip">${esc(p.deadlineText)}</span>` : ""}
        ${stale ? `<span class="chip warn">이력서가 바뀌었습니다</span>` : ""}
        ${f ? `<span class="chip">평가 ${esc(f.at)}</span>` : ""}
      </div>
    </div>
    <div class="detail-cta">
      ${p.status === "analyzing" ? `<span class="muted">분석 중…</span>`
        : p.status === "error" || p.status === "pending" ? `<button class="btn btn-primary" data-act="po-retry" data-id="${esc(p.id)}" type="button">${p.status === "error" ? "다시 시도" : "분석하기"}</button>`
        : !p.requirements.length && !p.url && !p.rawText ? `<span class="muted small">공고 내용이 없어 평가할 수 없습니다 — 삭제 후 링크·스크린샷으로 다시 넣으세요</span>`
        : `<button class="btn ${stale || !p.fit ? "btn-primary" : ""}" data-act="${p.requirements.length ? "po-refit" : "po-reread"}" data-id="${esc(p.id)}" type="button">${p.fit ? "적합도 다시 평가" : "적합도 평가"}</button>`}
      <a class="btn btn-primary" href="#/interview/${esc(p.id)}">⑤ 면접 준비 →</a>
    </div>
  </section>

  ${p.status === "error" ? `<p class="notice warn">❌ ${esc(p.error)}</p>` : ""}

  ${c ? `
  <section class="card">
    <div class="card-head"><h3>적합도 ${c.total}점 · ${esc(c.grade)}</h3><details class="rubric-pop"><summary class="btn btn-sm btn-ghost">점수 기준</summary>${poRubricHTML()}</details></div>
    ${f.summary ? `<p>${esc(f.summary)}</p>` : ""}
    ${c.blockers.length ? `<p class="notice warn">⛔ 지원 조건 불일치 — ${c.blockers.map(esc).join(", ")}. 지원 자격을 원 공고에서 꼭 확인하세요.</p>` : ""}
    <table class="score-table">
      <thead><tr><th>기준</th><th class="num">배점</th><th class="num">점수</th><th>계산</th></tr></thead>
      <tbody>${c.parts.map((x) => `<tr><th>${esc(x.label)}</th><td class="num">${x.weight}</td><td class="num"><strong>${x.got}</strong></td><td class="muted small">${esc(x.detail)}</td></tr>`).join("")}</tbody>
      <tfoot><tr><th>합계</th><td class="num">100</td><td class="num"><strong>${c.total}</strong></td><td class="muted small">${c.capped ? "경력·학력 조건 불일치로 39점 상한" : ""}</td></tr></tfoot>
    </table>
    ${c.warnings.length ? `<details class="sub-det" open><summary>⚠ 점수 계산에서 자동으로 조정한 것 ${c.warnings.length}건</summary><ul>${c.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul></details>` : ""}
  </section>

  <section class="card">
    <div class="card-head"><h3>공고가 요구한 것 vs 내 이력서</h3><span class="muted small">항목마다 근거 문장을 보여 줍니다</span></div>
    <p class="muted small">초록색 칸의 <span class="ev-id">E1</span> 같은 번호는 <strong>① 내 이력서에 적은 문장</strong>을 가리킵니다.</p>
    <div class="req-list">
      ${c.reqs.map((r) => `
        <div class="req">
          <div class="req-head">${st(r.status)} <span class="chip ${r.level === "필수" ? "accent" : ""}">${r.level}</span> <strong>${esc(r.label)}</strong></div>
          ${r.detail ? `<p class="req-quote">공고: “${esc(r.detail)}”</p>` : ""}
          ${r.evidence.length ? `<ul class="ev-list">${evList(r.evidence)}</ul>` : `<p class="muted small">내 이력서에서 이걸 보여 줄 문장을 찾지 못했습니다.</p>`}
          ${r.reason ? `<p class="small">왜 이렇게 봤나: ${esc(r.reason)}</p>` : ""}
          ${r.adjusted ? `<p class="small warn-text">자동 조정: ${esc(r.adjusted)}</p>` : ""}
          ${r.gap ? `<p class="small gap">보완: ${esc(r.gap)}</p>` : ""}
        </div>`).join("") || `<p class="empty">요구사항을 읽지 못했습니다.</p>`}
      <div class="req">
        <div class="req-head"><span class="chip accent">${c.exp.level} / 5</span> <strong>직무 경험이 얼마나 가까운가</strong></div>
        ${c.exp.evidence.length ? `<ul class="ev-list">${evList(c.exp.evidence)}</ul>` : ""}
        ${c.exp.reason ? `<p class="small">왜 이렇게 봤나: ${esc(c.exp.reason)}</p>` : ""}
      </div>
    </div>
    <h4>지원 조건 비교</h4>
    <div class="table-wrap"><table class="cond-table">
      <thead><tr><th>조건</th><th>공고</th><th>나</th><th>판정</th></tr></thead>
      <tbody>${c.conds.map((x) => `<tr><th>${esc(x.label)} <span class="muted small">${x.w}점</span></th><td>${esc(x.posting || "-")}</td><td>${esc(x.mine || "-")}</td><td>${st(x.status)}${x.reason ? `<div class="muted small">${esc(x.reason)}</div>` : ""}</td></tr>`).join("")}</tbody>
    </table></div>
    <h4>키워드 일치 <span class="muted small">참고 지표 · ${kw.pct}% (${kw.hit.length}/${kw.total})</span></h4>
    <div class="chips">${kw.hit.map((w) => `<span class="chip ok">✓ ${esc(w)}</span>`).join("")}${kw.miss.map((w) => `<span class="chip off">○ ${esc(w)}</span>`).join("")}</div>
  </section>

  <div class="grid grid-2">
    <section class="card">
      <h3>💪 강점</h3>
      ${f.strengths.length ? `<ul class="plain">${f.strengths.map((s) => `<li>${esc(s.text)}${s.evidence.filter((x) => snap[x]).map((x) => `<div class="muted small">↳ ${esc(snap[x].text)}</div>`).join("")}</li>`).join("")}</ul>` : `<p class="muted">—</p>`}
      <h3 style="margin-top:14px">⚠ 부족한 점</h3>
      ${f.gaps.length ? `<ul class="plain">${f.gaps.map((g) => `<li>${esc(g)}</li>`).join("")}</ul>` : `<p class="muted">—</p>`}
    </section>
    <section class="card">
      <h3>✅ 지원하기 전에 할 일</h3>
      ${f.actions.length ? `<ol class="plain">${f.actions.map((a) => `<li><strong>${esc(a.what)}</strong>${a.why ? `<div class="muted small">${esc(a.why)}</div>` : ""}</li>`).join("")}</ol>` : `<p class="muted">—</p>`}
      <h3 style="margin-top:14px">✍ 이 회사에 맞춰 이력서 고치기</h3>
      ${f.resumeTips.length ? `<ul class="plain">${f.resumeTips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : `<p class="muted">—</p>`}
    </section>
  </div>` : p.status === "analyzing" ? `<section class="card"><p class="empty"><i class="spin"></i> 공고를 읽고 적합도를 계산하는 중입니다. 다른 화면으로 가도 계속 진행됩니다.</p></section>` : ""}

  <section class="card">
    <div class="card-head"><h3>📮 지원 기록</h3>
      <span class="chip ${p.apply.submitted ? "ok" : ""}">${p.apply.submitted ? `제출 완료 ${esc(p.apply.submittedAt)}` : "아직 제출 전"}</span></div>
    <div class="rs-fields">
      <label class="field"><span>지원한 곳 (사이트·경로)</span>
        <input type="text" data-po-apply="site" data-id="${esc(p.id)}" value="${esc(p.apply.site)}" placeholder="사람인 / 회사 채용페이지 / 이메일"></label>
      <label class="field"><span>사용한 계정 (아이디만)</span>
        <input type="text" data-po-apply="account" data-id="${esc(p.id)}" value="${esc(p.apply.account)}" placeholder="kakao 로그인 / abc@mail.com"></label>
    </div>
    <p class="muted small" style="margin:-4px 0 10px">🔒 비밀번호는 절대 적지 마세요. 어느 계정으로 지원했는지만 적어 두면 나중에 결과 확인할 때 헷갈리지 않습니다.</p>
    <p class="muted small">제출한 서류</p>
    <div class="chips" style="margin-bottom:10px">
      ${PO_DOCS.map((d) => `<label class="chip ${p.apply.docs.includes(d) ? "ok" : "off"}">
        <input type="checkbox" data-po-doc="${esc(d)}" data-id="${esc(p.id)}" ${p.apply.docs.includes(d) ? "checked" : ""}> ${esc(d)}</label>`).join("")}
    </div>
    <label class="check"><input type="checkbox" data-po-apply="submitted" data-id="${esc(p.id)}" ${p.apply.submitted ? "checked" : ""}>
      <span><strong>지원서를 제출했습니다</strong> — 체크하면 전형 단계가 「지원 완료」로 바뀌고 오늘 날짜가 일정에 기록됩니다.</span></label>
    <label class="field"><span>지원 메모 (자소서 문항 번호, 담당자, 제출한 파일 이름 등)</span>
      <textarea data-po-apply="note" data-id="${esc(p.id)}" rows="2">${esc(p.apply.note)}</textarea></label>
  </section>

  <div class="grid grid-2">
    <section class="card">
      <div class="card-head"><h3>📅 일정</h3><a class="btn btn-sm btn-ghost" href="#/calendar">달력 보기</a></div>
      <label class="field"><span>서류 마감일</span><input type="date" data-po-deadline="${esc(p.id)}" value="${esc(p.deadline)}"></label>
      <p class="muted small">공고에 적힌 날짜는 자동으로 들어옵니다 <span class="chip">자동</span>. 직접 추가·삭제해도 됩니다.</p>
      <ul class="ev-rows">${p.events.map((e) => `<li><span class="chip ev-${esc(PO_EVENT_TYPES.indexOf(e.type))}">${esc(e.type)}</span> ${esc(e.date)} ${esc(e.time)} <span class="muted">${esc(e.memo)}</span>${e.auto ? ` <span class="chip small">자동</span>` : ""}
        <button class="btn btn-sm btn-ghost" data-act="po-ev-del" data-id="${esc(p.id)}" data-ev="${esc(e.id)}" type="button" aria-label="일정 삭제">×</button></li>`).join("") || `<li class="muted small">추가한 일정이 없습니다.</li>`}</ul>
      <div class="ev-add row wrap">
        <select name="type">${PO_EVENT_TYPES.filter((t) => t !== "마감").map((t) => `<option>${t}</option>`).join("")}</select>
        <input type="date" name="date"><input type="time" name="time">
        <input type="text" name="memo" placeholder="메모 (장소 등)">
        <button class="btn btn-sm" data-act="po-ev-add" data-id="${esc(p.id)}" type="button">+ 일정</button>
      </div>
      <label class="field" style="margin-top:12px"><span>메모</span><textarea data-bind="postings.${S.postings.indexOf(p)}.memo" rows="3" placeholder="자소서 문항, 연락 담당자 등">${esc(p.memo)}</textarea></label>
    </section>

    <section class="card">
      <div class="card-head"><h3>📋 공고 내용</h3>${p.url || p.rawText ? `<button class="btn btn-sm btn-ghost" data-act="po-reread" data-id="${esc(p.id)}" type="button">공고 다시 읽기</button>` : ""}</div>
      ${p.summary ? `<p style="white-space:pre-line">${esc(p.summary)}</p>` : ""}
      ${p.duties.length ? `<h4>주요 업무</h4><ul class="plain">${p.duties.map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${p.process.length ? `<p class="small"><strong>전형</strong> ${p.process.map(esc).join(" → ")}</p>` : ""}
      ${p.benefits.length ? `<p class="small"><strong>복지</strong> ${p.benefits.map(esc).join(", ")}</p>` : ""}
      ${Object.values(p.companyInfo).some(Boolean) ? `<h4>회사 정보</h4><p class="small">${[p.companyInfo.industry, p.companyInfo.size, p.companyInfo.employees && `사원 ${p.companyInfo.employees}`, p.companyInfo.founded && `설립 ${p.companyInfo.founded}`].filter(Boolean).map(esc).join(" · ")}</p>${p.companyInfo.summary ? `<p class="small">${esc(p.companyInfo.summary)}</p>` : ""}` : ""}
      ${p.rawText ? `<details class="sub-det"><summary>읽어낸 공고 원문</summary><pre class="raw">${esc(p.rawText)}</pre></details>` : ""}
      ${p.missing.length ? `<p class="notice small">못 읽은 정보: ${p.missing.map(esc).join(", ")} — 원 공고에서 확인하세요.</p>` : ""}
      <p class="muted small" style="margin-top:8px">출처: ${p.sources.map(esc).join(", ") || { link: "링크", image: "스크린샷", manual: "직접 입력", search: "사람인 검색" }[p.source]} · 추가 ${esc(p.createdAt)}</p>
    </section>
  </div>`;
}
