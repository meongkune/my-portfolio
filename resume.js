/* ============================================================
   resume.js — ① 내 이력서 (모든 정보의 출발점)
   ------------------------------------------------------------
   여기에 적은 내용만으로 공고 적합도·면접 질문이 만들어집니다.
   - 인적사항은 me.js 「내 정보(고정)」에서 읽습니다.
   - 프로젝트·경험의 "한 일·성과" 한 줄 한 줄이 적합도의 근거(E1, E2 …)가 됩니다.
   - 희망 조건(경력 구분·지역·고용형태)은 공고의 지원 조건과 비교합니다.
   - 첨부한 이력서에 맞춰 섹션 순서·추가 섹션·숨김(layout)이 바뀝니다.
   화면 미리보기와 docx 는 같은 데이터 모델(resumeModel)에서 나옵니다.
   ============================================================ */

const RESUME_SECTIONS = [
  {
    key: "education", title: "학력사항", required: true,
    hint: "최종 학력부터. 고등학교는 넣지 않아도 됩니다.",
    fields: [
      { k: "period", label: "기간", ph: "2020.03 – 2026.02" },
      { k: "school", label: "학교명", ph: "한국대학교" },
      { k: "major", label: "전공", ph: "경영학과" },
      { k: "status", label: "구분", type: "select", options: ["재학", "휴학", "졸업예정", "졸업", "수료", "중퇴"] },
      { k: "gpa", label: "학점 (선택)", ph: "3.8 / 4.5" },
    ],
    cols: [
      { k: "period", label: "기간", w: 1900 }, { k: "school", label: "학교명", w: 2500 },
      { k: "major", label: "전공", w: 2600 }, { k: "status", label: "구분", w: 1200 }, { k: "gpa", label: "학점", w: 1438 },
    ],
    emptyText: "—",
  },
  {
    key: "career", title: "경력사항",
    hint: "인턴·현장실습·아르바이트도 경력입니다. 한 일은 한 줄에 하나씩, 숫자를 넣어 적으세요 — 이 문장들이 점수 근거가 됩니다.",
    fields: [
      { k: "period", label: "기간", ph: "2025.07 – 2025.12" },
      { k: "company", label: "회사·기관명", ph: "(주)OO커머스" },
      { k: "role", label: "부서·직위", ph: "운영팀 인턴" },
      { k: "type", label: "형태", type: "select", options: ["인턴", "현장실습", "아르바이트", "계약직", "정규직", "프리랜서"] },
    ],
    sub: { k: "duties", label: "담당 업무·성과 — 한 줄에 하나씩", ph: "주문 문의 하루 평균 40건 응대\n반품 사유 분석 → 주간 보고서 작성, 반품률 8% → 6%" },
    cols: [
      { k: "period", label: "기간", w: 1900 }, { k: "company", label: "회사·기관명", w: 2900 },
      { k: "role", label: "부서·직위", w: 2600 }, { k: "type", label: "형태", w: 2238 },
    ],
    emptyText: "신입 (경력 없음)",
  },
  {
    key: "projects", title: "프로젝트·경험", optional: true,
    hint: "수업·캡스톤·공모전·대외활동·동아리·개인 프로젝트. 무엇을 했고 결과가 어땠는지 한 줄씩 적으세요.",
    fields: [
      { k: "period", label: "기간", ph: "2025.03 – 2025.06" },
      { k: "title", label: "프로젝트·활동명", ph: "교내 중고거래 앱 기획" },
      { k: "org", label: "구분·소속", ph: "캡스톤 · 팀 4인" },
      { k: "role", label: "내 역할", ph: "기획 리드" },
      { k: "skills", label: "사용 기술·도구", ph: "Figma, SQL" },
    ],
    sub: { k: "content", label: "한 일·성과 — 한 줄에 하나씩", ph: "재학생 42명 설문·인터뷰 6건으로 문제 정의\n거래 성사율 34% → 46%" },
    cols: [
      { k: "period", label: "기간", w: 1800 }, { k: "title", label: "프로젝트·활동명", w: 3400 },
      { k: "org", label: "구분·소속", w: 2200 }, { k: "role", label: "역할", w: 2238 },
    ],
  },
  {
    key: "skills", title: "보유 기술", optional: true,
    fields: [
      { k: "category", label: "분야", ph: "데이터 분석" },
      { k: "items", label: "기술·도구 (수준)", ph: "SQL(중), Python(하), Excel(상)" },
    ],
    cols: [{ k: "category", label: "분야", w: 2200 }, { k: "items", label: "기술·도구", w: 7438 }],
  },
  {
    key: "certificates", title: "자격증", optional: true,
    fields: [
      { k: "date", label: "취득일", ph: "2025.08" },
      { k: "name", label: "자격증명", ph: "SQLD" },
      { k: "issuer", label: "발행기관", ph: "한국데이터산업진흥원" },
    ],
    cols: [{ k: "date", label: "취득일", w: 1600 }, { k: "name", label: "자격증명", w: 4600 }, { k: "issuer", label: "발행기관", w: 3438 }],
  },
  {
    key: "languages", title: "어학", optional: true,
    fields: [
      { k: "test", label: "시험명", ph: "TOEIC" },
      { k: "score", label: "점수·등급", ph: "850" },
      { k: "date", label: "취득일", ph: "2025.11" },
    ],
    cols: [{ k: "test", label: "시험명", w: 4000 }, { k: "score", label: "점수·등급", w: 3038 }, { k: "date", label: "취득일", w: 2600 }],
  },
  {
    key: "awards", title: "수상 내역", optional: true,
    fields: [
      { k: "date", label: "수상일", ph: "2025.06" },
      { k: "title", label: "수상명", ph: "캡스톤디자인 경진대회 우수상" },
      { k: "org", label: "수여기관", ph: "한국대학교" },
    ],
    sub: { k: "desc", label: "내용 (선택)", ph: "무엇으로 받았는지 한 줄로", single: true },
    cols: [{ k: "date", label: "수상일", w: 1600 }, { k: "title", label: "수상명", w: 4600 }, { k: "org", label: "수여기관", w: 3438 }],
  },
  {
    key: "strengths", title: "핵심 역량", optional: true,
    hint: "자기소개서에 쓰는 강점. 강점 한 줄 + 그걸 보여주는 근거를 적습니다.",
    fields: [{ k: "title", label: "강점", ph: "데이터로 문제를 정의하는 기획력" }],
    sub: { k: "content", label: "근거 — 한 줄에 하나씩", ph: "설문 42명 분석으로 핵심 불편 도출" },
    cols: [{ k: "title", label: "강점", w: 9638 }],
  },
  {
    key: "extra", title: "그 외", optional: true,
    hint: "교육 이수·봉사·해외 경험 등 위에 없는 것. 따로 제목을 단 섹션이 필요하면 [+ 섹션 추가].",
    fields: [
      { k: "category", label: "항목", ph: "교육 이수" },
      { k: "period", label: "기간 (선택)", ph: "2026.09" },
      { k: "title", label: "제목", ph: "AI 활용 역량 강화 교육 (12시간)" },
    ],
    sub: { k: "content", label: "내용 (선택) — 한 줄에 하나씩", ph: "" },
    cols: [{ k: "category", label: "항목", w: 1800 }, { k: "period", label: "기간", w: 1900 }, { k: "title", label: "내용", w: 5938 }],
  },
];

const RS_BASIC = [
  { k: "name", label: "이름" }, { k: "desiredJob", label: "희망 직무" },
  { k: "phone", label: "연락처" }, { k: "email", label: "이메일" },
];

/* 희망 조건 — 공고의 지원 조건과 비교합니다 (이력서 파일에는 나오지 않음) */
const RS_PREFS = [
  { k: "level", label: "경력 구분", type: "select", options: ["신입", "경력", "신입·경력 모두"] },
  { k: "years", label: "경력 연수 (경력일 때)", ph: "2" },
  { k: "regions", label: "희망 근무지", ph: "서울, 경기 성남" },
  { k: "employment", label: "희망 고용형태", ph: "정규직, 인턴" },
  { k: "salary", label: "희망 연봉 (선택)", ph: "3,500만 원 이상" },
  { k: "industries", label: "관심 업종 (선택)", ph: "커머스, 핀테크" },
  { k: "avoid", label: "피하고 싶은 조건 (선택)", ph: "교대근무, 파견" },
];

/* ---------- 데이터 도우미 ---------- */
const rsId = () => "rv" + Math.random().toString(36).slice(2, 8);
const rsStr = (v) => String(v ?? "").trim();
const rsArr = (v) => (Array.isArray(v) ? v : String(v ?? "").split("\n")).map((x) => (typeof x === "string" ? x : String(x ?? ""))).map(rsStr).filter(Boolean);

function rsBlankRow(sec) {
  const row = { id: rsId() };
  sec.fields.forEach((f) => { row[f.k] = f.type === "select" ? f.options[0] : ""; });
  if (sec.sub) row[sec.sub.k] = sec.sub.single ? "" : [];
  return row;
}

function rsHasContent(sec, row) {
  const keys = sec.fields.filter((f) => f.type !== "select").map((f) => f.k).concat(sec.sub ? [sec.sub.k] : []);
  return keys.some((k) => rsArr(row[k]).length > 0);
}

const RS_TO_STD = [
  [/^(프로젝트|프로젝트\s*[·및/]?\s*경험|주요\s*프로젝트|대외\s*활동|활동\s*경험|경험)$/, "projects", (row) => ({ id: row.id, period: row.period, title: row.title, org: "", role: "", skills: "", content: row.content })],
  [/^(보유\s*기술|기술|스킬|skills?|역량\s*및\s*기술|사용\s*기술)$/i, "skills", (row) => ({ id: row.id, category: row.period || "", items: [row.title, ...row.content].filter(Boolean).join(", ") })],
  [/^(핵심\s*역량|강점|나의\s*강점)$/, "strengths", (row) => ({ id: row.id, title: row.title, content: row.content })],
];

function rsNormalize(resume) {
  const r = resume && typeof resume === "object" ? resume : {};
  r.basic = r.basic || {};
  RESUME_SECTIONS.forEach((sec) => {
    if (!Array.isArray(r[sec.key])) r[sec.key] = [];
    for (let i = r[sec.key].length - 1; i >= 0; i--) if (!r[sec.key][i] || typeof r[sec.key][i] !== "object") r[sec.key].splice(i, 1);   /* 같은 배열 유지 (되돌리기용) */
    r[sec.key].forEach((row) => { if (!row.id) row.id = rsId(); });
  });
  if (!Array.isArray(r.custom)) r.custom = [];
  for (let i = r.custom.length - 1; i >= 0; i--) if (!r.custom[i] || typeof r.custom[i] !== "object") r.custom.splice(i, 1);
  r.custom.forEach((c) => {
    if (!c.id) c.id = rsId();
    c.title = rsStr(c.title) || "추가 섹션";
    c.rows = (Array.isArray(c.rows) ? c.rows : []).map((row) => ({ id: row.id || rsId(), period: rsStr(row.period), title: rsStr(row.title), content: rsArr(row.content) }));
  });

  const all = RESUME_SECTIONS.map((sec) => sec.key).concat(r.custom.map((c) => `custom:${c.id}`));
  const lay = r.layout && typeof r.layout === "object" ? r.layout : {};
  const order = (Array.isArray(lay.order) ? lay.order : []).filter((k) => all.includes(k));
  all.forEach((k) => {
    if (order.includes(k)) return;
    /* 새로 생긴 표준 섹션은 정의 순서대로 알맞은 자리에 끼웁니다 */
    const idx = RESUME_SECTIONS.findIndex((s) => s.key === k);
    const after = idx > 0 ? order.indexOf(RESUME_SECTIONS[idx - 1].key) : -1;
    if (idx >= 0 && after >= 0) order.splice(after + 1, 0, k); else order.push(k);
  });
  r.layout = { order, hidden: (Array.isArray(lay.hidden) ? lay.hidden : []).filter((k) => all.includes(k)) };
  /* 저장해 둔 이력서 양식들 (기업마다 요구 항목이 달라서 갈아 끼울 수 있게) */
  r.layouts = (Array.isArray(r.layouts) ? r.layouts : []).filter((x) => x && typeof x === "object" && x.name)
    .map((x) => ({ id: x.id || rsId(), name: String(x.name).trim().slice(0, 40), at: x.at || todayStr(),
      order: (Array.isArray(x.order) ? x.order : []).filter((k) => all.includes(k)),
      hidden: (Array.isArray(x.hidden) ? x.hidden : []).filter((k) => all.includes(k)) }));
  const p = r.prefs && typeof r.prefs === "object" ? r.prefs : {};
  r.prefs = {};
  RS_PREFS.forEach((f) => { r.prefs[f.k] = f.type === "select" ? (f.options.includes(p[f.k]) ? p[f.k] : f.options[0]) : rsStr(p[f.k]); });
  return r;
}

const rsCustomOf = (r, key) => r.custom.find((c) => `custom:${c.id}` === key);
const rsKeyTitle = (r, key) => (RESUME_SECTIONS.find((s) => s.key === key) || {}).title || rsCustomOf(r, key)?.title || key;

/* 지금 화면 구성을 「양식」으로 저장합니다 (같은 이름이면 덮어씀) */
function rsSaveLayout(name) {
  const r = S.resume;
  const clean = String(name || "").trim().slice(0, 40);
  if (!clean) return null;
  const item = { id: rsId(), name: clean, at: todayStr(), order: r.layout.order.slice(), hidden: r.layout.hidden.slice() };
  const i = r.layouts.findIndex((x) => x.name === clean);
  if (i >= 0) { item.id = r.layouts[i].id; r.layouts[i] = item; } else r.layouts.push(item);
  return item;
}

function rsApplyLayout(order, customTitles) {
  const r = rsNormalize(S.resume);
  rsMergeStd(r);
  const byTitle = (t) => r.custom.find((c) => ingNorm(c.title) === ingNorm(t));
  const keys = [];
  (Array.isArray(order) ? order : []).forEach((k) => {
    const key = String(k || "");
    if (RESUME_SECTIONS.some((s) => s.key === key)) keys.push(key);
    else if (key.startsWith("custom:")) {
      const c = byTitle(key.slice(7));
      const std = RS_TO_STD.find(([re]) => re.test(key.slice(7).trim()));
      if (c) keys.push(`custom:${c.id}`); else if (std && !keys.includes(std[1])) keys.push(std[1]);
    }
  });
  (customTitles || []).forEach((t) => { const c = byTitle(t); if (c && !keys.includes(`custom:${c.id}`)) keys.push(`custom:${c.id}`); });
  if (!keys.length) return;
  const rest = r.layout.order.filter((k) => !keys.includes(k));
  r.layout.order = keys.concat(rest);
  r.layout.hidden = rest.filter((k) => {                     /* 내용이 있는 섹션은 숨기지 않습니다 */
    const sec = RESUME_SECTIONS.find((s) => s.key === k);
    return sec ? !r[k].some((row) => rsHasContent(sec, row)) : !rsCustomOf(r, k)?.rows.length;
  });
  S.resume = r;
}

/* 추가 섹션 중 기본 섹션과 같은 것(프로젝트·보유 기술·핵심 역량)은 기본 섹션으로 합칩니다 — 적합도 근거가 한곳에 모이도록.
   불러올 때·문서 반영할 때만 실행합니다 (입력 중인 섹션 제목이 바뀌는 도중에 사라지지 않게). */
function rsMergeStd(r) {

  const keep = r.custom.filter((c) => {
    const hit = RS_TO_STD.find(([re]) => re.test(c.title.replace(/\s+/g, " ").trim()));
    if (!hit) return true;
    const [, key, conv] = hit;
    if (!Array.isArray(r[key])) r[key] = [];
    c.rows.forEach((row) => { if (!r[key].some((x) => x.id === row.id)) r[key].push(conv(row)); });
    if (r.layout && Array.isArray(r.layout.order)) {
      const i = r.layout.order.indexOf(`custom:${c.id}`);
      if (i >= 0) r.layout.order.splice(i, 1, ...(r.layout.order.includes(key) ? [] : [key]));
    }
    return false;
  });
  r.custom.splice(0, r.custom.length, ...keep);
  return r;
}

const RS_CUSTOM_COLS = [{ k: "period", label: "기간", w: 1900 }, { k: "title", label: "내용", w: 7738 }];

function rsToday() {
  const d = new Date();
  return `${d.getFullYear()}년 ${String(d.getMonth() + 1).padStart(2, "0")}월 ${String(d.getDate()).padStart(2, "0")}일`;
}

/* ---------- 근거 목록 — 적합도·면접 질문이 인용하는 단위 ----------
   E1, E2 … 한 줄 한 줄. 화면 표시용 where(어느 섹션 어느 항목)와 text 를 가집니다. */
function rsEvidence(resume = S.resume) {
  const r = resume;
  const out = [];
  const add = (where, text) => { const t = rsStr(text); if (t) out.push({ id: `E${out.length + 1}`, where, text: t }); };
  const me = S.me || {};
  if (me.headline) add("내 정보 · 한 줄 소개", me.headline);
  RESUME_SECTIONS.forEach((sec) => {
    r[sec.key].filter((row) => rsHasContent(sec, row)).forEach((row) => {
      const head = sec.fields.map((f) => rsStr(row[f.k])).filter(Boolean).join(" · ");
      add(sec.title, head);
      if (sec.sub) rsArr(row[sec.sub.k]).forEach((line) => add(`${sec.title} · ${sec.fields.map((f) => rsStr(row[f.k])).filter(Boolean).slice(1, 3).join(" ") || head}`, line));
    });
  });
  r.custom.forEach((c) => c.rows.forEach((row) => {
    add(c.title, [row.period, row.title].filter(Boolean).join(" · "));
    row.content.forEach((line) => add(`${c.title} · ${row.title}`, line));
  }));
  return out;
}

const rsEvidenceText = (ev = rsEvidence()) => ev.map((e) => `${e.id} [${e.where}] ${e.text}`).join("\n");

function rsPrefsText() {
  const p = S.resume.prefs || {};
  return RS_PREFS.map((f) => (p[f.k] ? `${f.label}: ${p[f.k]}` : "")).filter(Boolean).join("\n") || "(희망 조건 미입력)";
}

/* 이력서가 바뀌었는지 알아보는 지문 — 적합도 결과가 옛 이력서 기준인지 표시합니다 */
function rsFingerprint() {
  const s = rsEvidenceText() + "|" + rsPrefsText();
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return String(h >>> 0);
}

/* ---------- 완성도 점검 ---------- */
function rsCompleteness() {
  const r = S.resume;
  const me = S.me || {};
  const has = (k) => { const sec = RESUME_SECTIONS.find((s) => s.key === k); return r[k].filter((row) => rsHasContent(sec, row)).length; };
  const lines = [...r.career.flatMap((c) => rsArr(c.duties)), ...r.projects.flatMap((p) => rsArr(p.content)), ...r.custom.flatMap((c) => c.rows.flatMap((x) => x.content))];
  const withNum = lines.filter((l) => /\d/.test(l)).length;
  const checks = [
    { ok: !!(me.name && (me.phone || me.email)), label: "내 정보 (이름·연락처)", fix: "상단 [내 정보]" },
    { ok: !!me.desiredJob, label: "희망 직무", fix: "상단 [내 정보]" },
    { ok: has("education") > 0, label: "학력", fix: "학력사항" },
    { ok: has("career") + has("projects") + r.custom.length > 0, label: "경력 또는 프로젝트·경험 1개 이상", fix: "경력사항 / 프로젝트·경험" },
    { ok: lines.length >= 3, label: "한 일·성과 3줄 이상", fix: "담당 업무·성과를 한 줄씩" },
    { ok: lines.length > 0 && withNum / lines.length >= 0.4, label: `성과에 숫자 (${withNum}/${lines.length}줄)`, fix: "건수·%·기간 등 숫자 넣기" },
    { ok: has("skills") > 0, label: "보유 기술", fix: "보유 기술" },
    { ok: !!(r.prefs.regions || r.prefs.employment), label: "희망 조건 (근무지·고용형태)", fix: "희망 조건" },
  ];
  return { score: Math.round((checks.filter((c) => c.ok).length / checks.length) * 100), checks, evidenceCount: rsEvidence().length };
}

/* ---------- 이력서 모델 — 미리보기와 docx 가 함께 씁니다 ---------- */
function resumeModel(resume) {
  const r = resume;
  const sections = r.layout.order.filter((key) => !r.layout.hidden.includes(key)).map((key) => {
    const sec = RESUME_SECTIONS.find((s) => s.key === key);
    if (sec) {
      return {
        title: sec.title, cols: sec.cols, optional: !!sec.optional, empty: sec.emptyText || "—",
        rows: r[sec.key].filter((row) => rsHasContent(sec, row)).map((row) => ({
          cells: sec.cols.map((c) => rsStr(row[c.k])),
          sub: (sec.key === "projects" && rsStr(row.skills) ? [`사용 기술: ${rsStr(row.skills)}`] : []).concat(sec.sub ? rsArr(row[sec.sub.k]) : []),
        })),
      };
    }
    const c = rsCustomOf(r, key);
    return {
      title: c.title, cols: RS_CUSTOM_COLS, optional: true, empty: "—",
      rows: c.rows.filter((row) => row.title || row.content.length).map((row) => ({ cells: [row.period, row.title], sub: row.content })),
    };
  }).filter((s) => s.rows.length || !s.optional);

  const me = (typeof S !== "undefined" && S.me) || {};
  const basic = RS_BASIC.map((f) => [f.label, rsStr(me[f.k] ?? r.basic[f.k])])
    .concat([["영문 이름", me.nameEn], ["생년월일", me.birth], ["주소", me.address]].map(([l, v]) => [l, rsStr(v)]).filter(([, v]) => v))
    .concat((me.extra || []).filter((x) => x.value).map((x) => [x.label, x.value]));
  if (basic.length % 2) basic.push(["", ""]);
  return { name: rsStr(me.name ?? r.basic.name), basic, sections };
}

/* ============================================================
   화면
   ============================================================ */
function renderResume() {
  const r = S.resume;
  const me = S.me;
  const editors = r.layout.order.map((key) => {
    const sec = RESUME_SECTIONS.find((s) => s.key === key);
    return sec ? rsSectionHTML(sec, r) : rsCustomHTML(r, key);
  }).join("");

  return `
  <div class="view-head">
    <h2>① 내 이력서</h2>
    <p class="muted">여기 적은 내용이 <strong>적합도 점수의 근거</strong>이자 <strong>자소서·면접 답변</strong>의 재료가 됩니다. 가지고 있는 파일을 넣으면 한 번에 채워집니다.</p>
  </div>

  <section class="card ing-card">
    <div class="ing-actions">
      <button class="ing-btn" data-act="ing-open" data-mode="resume" type="button">
        <strong>📄 가지고 있는 이력서 넣기</strong>
        <span class="muted">이력서 파일을 넣으면 내용과 항목 구성을 그대로 가져옵니다. 이력서·경력기술서를 함께 넣어도 됩니다.</span>
      </button>
      <button class="ing-btn" data-act="ing-open" data-mode="fill" type="button">
        <strong>📂 자소서·포트폴리오에서 채우기</strong>
        <span class="muted">여러 파일을 한 번에 넣으면 빠진 내용만 채우고, 같은 항목은 최신 내용으로 바꿉니다.</span>
      </button>
    </div>
    <p class="muted small" style="margin-top:8px">PDF · 워드 · 한글(HWPX) · 텍스트 · 사진 모두 됩니다 · 반영 전에 무엇이 바뀌는지 먼저 보여 줍니다 · 🔒 고정한 내 정보는 그대로입니다</p>
  </section>

  ${rsCompHTML()}

  <div class="rs-layout">
    <div class="rs-editor">
      <section class="card">
        <div class="card-head"><h3>인적사항 <span class="chip ${me.locked ? "ok" : "warn"}">${me.locked ? "🔒 고정" : "🔓 편집 가능"}</span></h3>
          <button class="btn btn-sm" data-act="me-edit" type="button">${me.locked ? "내 정보 보기" : "내 정보 편집"}</button></div>
        <dl class="me-summary">
          ${ME_FIELDS.map((f) => `<dt>${esc(f.label)}</dt><dd class="${me[f.k] ? "" : "muted"}">${esc(me[f.k] || "—")}</dd>`).join("")}
          ${(me.extra || []).map((x) => `<dt>${esc(x.label)}</dt><dd class="${x.value ? "" : "muted"}">${esc(x.value || "—")}</dd>`).join("")}
        </dl>
      </section>

      <section class="card">
        <div class="card-head"><h3>희망 조건 <span class="chip">공고와 비교할 때 씁니다</span></h3></div>
        <p class="muted small" style="margin:-4px 0 10px">공고의 경력·근무지·고용형태 조건과 맞는지 볼 때 씁니다. 이력서 파일에는 나오지 않습니다.</p>
        <div class="rs-fields">
          ${RS_PREFS.map((f) => f.type === "select"
            ? `<label class="field"><span>${esc(f.label)}</span><select data-bind="resume.prefs.${f.k}">${f.options.map((o) => `<option${o === r.prefs[f.k] ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`
            : `<label class="field"><span>${esc(f.label)}</span><input type="text" data-bind="resume.prefs.${f.k}" value="${esc(r.prefs[f.k])}" placeholder="${esc(f.ph)}"></label>`).join("")}
        </div>
      </section>

      ${editors}

      <div class="row" style="justify-content:center;margin-top:16px">
        <button class="btn btn-sm" type="button" data-act="rs-custom-add">+ 항목 추가 (포트폴리오 · 해외 경험 등)</button>
      </div>
    </div>

    <aside class="rs-side">
      <section class="card">
        <div class="card-head">
          <h3>이력서 미리보기</h3>
          <button class="btn btn-primary btn-sm" type="button" data-act="rs-docx">📄 docx로 받기</button>
        </div>
        ${rsLayoutBarHTML(r)}
        <p class="muted small" style="margin-bottom:6px">항목 이름을 누르면 이력서에서 <strong>빼거나 넣을</strong> 수 있고, ↑ 를 누르면 순서가 앞으로 갑니다.</p>
        <div class="chips rs-layout-chips" style="margin-bottom:8px">
          ${r.layout.order.map((key, i) => {
            const hidden = r.layout.hidden.includes(key);
            const sec = RESUME_SECTIONS.find((s) => s.key === key);
            const n = sec ? r[key].filter((row) => rsHasContent(sec, row)).length : rsCustomOf(r, key).rows.length;
            return `<span class="chip ${hidden ? "off" : n ? "ok" : ""}">
              <button type="button" class="chip-btn" data-act="rs-toggle-sec" data-key="${esc(key)}" title="${hidden ? "보이기" : "숨기기"}">${hidden ? "◌" : n ? "✓" : "○"} ${esc(rsKeyTitle(r, key))}${n ? " " + n : ""}</button>
              ${i ? `<button type="button" class="chip-btn" data-act="rs-move-sec" data-key="${esc(key)}" title="앞으로">↑</button>` : ""}
            </span>`;
          }).join("")}
        </div>
        <div id="rs-preview" class="resume-paper-wrap">${resumePreviewHTML()}</div>
      </section>
    </aside>
  </div>`;
}

/* 이력서 양식 고르기 · 저장 */
function rsLayoutBarHTML(r) {
  return `<div class="row wrap layout-bar">
    <span class="muted small">이력서 양식</span>
    <select data-rs-layout aria-label="이력서 양식 고르기">
      <option value="">지금 구성 (저장 안 함)</option>
      ${r.layouts.map((x) => `<option value="${esc(x.id)}">${esc(x.name)}</option>`).join("")}
    </select>
    <button class="btn btn-sm" data-act="rs-layout-save" type="button" title="지금 항목 구성을 이름 붙여 저장">저장</button>
    ${r.layouts.length ? `<button class="btn btn-sm btn-ghost btn-danger" data-act="rs-layout-del" type="button">삭제</button>` : ""}
  </div>
  ${r.layouts.length ? "" : `<p class="muted small" style="margin:4px 0 6px">💡 기업마다 요구하는 항목이 다릅니다. 자주 쓰는 구성을 「공공기관용」·「IT 기업용」처럼 저장해 두고 갈아 끼우세요.</p>`}`;
}

function rsCompHTML() {
  const comp = rsCompleteness();
  return `<section class="card comp-card">
    <div class="card-head">
      <h3>이력서 완성도 <span class="chip ${comp.score >= 75 ? "ok" : comp.score >= 50 ? "accent" : "warn"}">${comp.score}%</span></h3>
      <span class="muted small">점수 근거로 쓸 수 있는 문장 <strong>${comp.evidenceCount}</strong>개</span>
    </div>
    <div class="meter"><i style="width:${comp.score}%"></i></div>
    <div class="chips" style="margin-top:10px">
      ${comp.checks.map((c) => `<span class="chip ${c.ok ? "ok" : "off"}" title="${esc(c.ok ? "" : "채우는 곳: " + c.fix)}">${c.ok ? "✓" : "○"} ${esc(c.label)}${c.ok ? "" : ` <span class="small">→ ${esc(c.fix)}</span>`}</span>`).join("")}
    </div>
  </section>`;
}

function rsCustomHTML(r, key) {
  const c = rsCustomOf(r, key);
  const ci = r.custom.indexOf(c);
  return `
  <section class="card">
    <div class="card-head">
      <input type="text" class="rs-custom-title" data-bind="resume.custom.${ci}.title" value="${esc(c.title)}" aria-label="섹션 제목">
      <div class="row">
        <button class="btn btn-sm" type="button" data-act="rs-custom-row" data-ci="${ci}">+ 추가</button>
        <button class="btn btn-sm btn-danger" type="button" data-act="rs-custom-del" data-ci="${ci}">섹션 삭제</button>
      </div>
    </div>
    ${c.rows.length ? c.rows.map((row, i) => `
      <div class="item">
        <div class="rs-fields">
          <label class="field"><span>기간 (선택)</span><input type="text" data-bind="resume.custom.${ci}.rows.${i}.period" value="${esc(row.period)}"></label>
          <label class="field span2"><span>제목</span><input type="text" data-bind="resume.custom.${ci}.rows.${i}.title" value="${esc(row.title)}"></label>
        </div>
        <div class="rs-row-foot">
          <label class="field"><span>내용 — 한 줄에 하나씩</span>
            <textarea data-bind="resume.custom.${ci}.rows.${i}.content" data-type="lines" rows="3">${esc(row.content.join("\n"))}</textarea></label>
          <button class="btn btn-sm btn-danger" type="button" data-act="rs-custom-row-del" data-ci="${ci}" data-i="${i}">삭제</button>
        </div>
      </div>`).join("") : `<p class="empty">[+ 추가] 를 눌러 입력하세요.</p>`}
  </section>`;
}

function rsSectionHTML(sec, r) {
  const rows = r[sec.key];
  const tag = sec.required ? `<span class="chip accent">필수</span>` : "";
  return `
  <section class="card" id="sec-${sec.key}">
    <div class="card-head">
      <h3>${esc(sec.title)} ${tag}</h3>
      <button class="btn btn-sm" type="button" data-act="rs-add" data-sec="${sec.key}">+ 추가</button>
    </div>
    ${sec.hint ? `<p class="muted small" style="margin:-4px 0 10px">${esc(sec.hint)}</p>` : ""}
    ${rows.length ? rows.map((row, i) => `
      <div class="item">
        <div class="rs-fields">${sec.fields.map((f) => rsFieldHTML(sec, i, f, row)).join("")}</div>
        <div class="rs-row-foot">
          ${sec.sub ? rsSubHTML(sec, i, row) : "<span></span>"}
          <button class="btn btn-sm btn-danger" type="button" data-act="rs-del" data-sec="${sec.key}" data-i="${i}">삭제</button>
        </div>
      </div>`).join("")
      : `<p class="empty">${sec.optional ? "해당 없으면 비워 두세요. 이력서에서 빠집니다." : "[+ 추가] 를 눌러 입력하세요."}</p>`}
  </section>`;
}

function rsFieldHTML(sec, i, f, row) {
  const path = `resume.${sec.key}.${i}.${f.k}`;
  if (f.type === "select") {
    return `<label class="field"><span>${esc(f.label)}</span>
      <select data-bind="${path}">${f.options.map((o) => `<option${o === row[f.k] ? " selected" : ""}>${esc(o)}</option>`).join("")}</select></label>`;
  }
  return `<label class="field"><span>${esc(f.label)}</span>
    <input type="text" data-bind="${path}" value="${esc(row[f.k])}" placeholder="${esc(f.ph || "")}"></label>`;
}

/* 양식 고르기 (app.js 의 입력 처리기가 부릅니다) */
function rsLayoutPick(t) {
  if (!t.hasAttribute("data-rs-layout")) return false;
  const item = S.resume.layouts.find((x) => x.id === t.value);
  if (item) {
    S.resume.layout = { order: item.order.slice(), hidden: item.hidden.slice() };
    S.resume = rsNormalize(S.resume);
    save(); render();
    toast(`「${item.name}」 양식으로 바꿨습니다`, "ok");
  }
  return true;
}

function rsSubHTML(sec, i, row) {
  const s = sec.sub;
  const path = `resume.${sec.key}.${i}.${s.k}`;
  return s.single
    ? `<label class="field"><span>${esc(s.label)}</span><input type="text" data-bind="${path}" value="${esc(rsStr(row[s.k]))}" placeholder="${esc(s.ph)}"></label>`
    : `<label class="field"><span>${esc(s.label)}</span>
         <textarea data-bind="${path}" data-type="lines" rows="3" placeholder="${esc(s.ph)}">${esc(rsArr(row[s.k]).join("\n"))}</textarea></label>`;
}

function resumePreviewHTML() {
  const m = resumeModel(S.resume);
  const td = (v) => (v ? esc(v) : "&nbsp;");
  const pct = (w) => `${(w / 96.38).toFixed(2)}%`;
  return `
  <div class="resume-paper">
    <h1>이력서</h1>
    <p class="rp-en">RESUME</p>
    <h4>인적사항</h4>
    <table>
      <colgroup><col style="width:15%"><col style="width:35%"><col style="width:15%"><col style="width:35%"></colgroup>
      ${m.basic.filter((_, i) => i % 2 === 0).map((a, j) => { const b = m.basic[j * 2 + 1]; return `
      <tr><th>${esc(a[0])}</th><td>${td(a[1])}</td><th>${esc(b[0])}</th><td>${td(b[1])}</td></tr>`; }).join("")}
    </table>
    ${m.sections.map((sec) => `
      <h4>${esc(sec.title)}</h4>
      <table>
        <colgroup>${sec.cols.map((c) => `<col style="width:${pct(c.w)}">`).join("")}</colgroup>
        <tr>${sec.cols.map((c) => `<th>${esc(c.label)}</th>`).join("")}</tr>
        ${sec.rows.length ? sec.rows.map((row) => `
          <tr>${row.cells.map((v) => `<td>${td(v)}</td>`).join("")}</tr>
          ${row.sub.length ? `<tr class="rp-subrow"><td colspan="${sec.cols.length}">${row.sub.map((s) => `· ${esc(s)}`).join("<br>")}</td></tr>` : ""}`).join("")
          : `<tr><td colspan="${sec.cols.length}" class="rp-empty">${esc(sec.empty)}</td></tr>`}
      </table>`).join("")}
    <div class="rp-sign">
      위 기재 사항은 사실과 다름없음을 확인합니다.<br>${esc(rsToday())}<br>
      <strong>성명 ${esc(m.name)} (인)</strong>
    </div>
  </div>`;
}

function refreshResumePreview() {
  const el = document.getElementById("rs-preview");
  if (el) el.innerHTML = resumePreviewHTML();
  const comp = document.querySelector(".comp-card");
  if (comp) comp.outerHTML = rsCompHTML();
}

function resumeAction(act, btn) {
  if (act === "rs-add") {
    const sec = RESUME_SECTIONS.find((s) => s.key === btn.dataset.sec);
    if (sec) { S.resume[sec.key].push(rsBlankRow(sec)); save(); render(); }
    return true;
  }
  if (act === "rs-del") {
    const list = S.resume[btn.dataset.sec];
    const i = Number(btn.dataset.i);
    if (list && list[i]) {
      const removed = list.splice(i, 1)[0];
      save(); render();
      const key = btn.dataset.sec;
      toast("항목을 삭제했습니다", "", { label: "되돌리기", run: () => { S.resume[key].splice(i, 0, removed); save(); render(); } });
    }
    return true;
  }
  if (act === "rs-docx") { exportResumeDocx(); return true; }
  if (act === "ing-open") { ingOpen(btn.dataset.mode); return true; }
  const lay = S.resume.layout;
  if (act === "rs-toggle-sec") {
    const k = btn.dataset.key;
    lay.hidden = lay.hidden.includes(k) ? lay.hidden.filter((x) => x !== k) : lay.hidden.concat(k);
    save(); render(); return true;
  }
  if (act === "rs-move-sec") {
    const i = lay.order.indexOf(btn.dataset.key);
    if (i > 0) [lay.order[i - 1], lay.order[i]] = [lay.order[i], lay.order[i - 1]];
    save(); render(); return true;
  }
  if (act === "rs-layout-save") {
    const cur = document.querySelector("[data-rs-layout]")?.selectedOptions[0];
    const name = prompt("이 구성을 어떤 이름으로 저장할까요? (예: 공공기관용, IT 기업용)", cur && cur.value ? cur.textContent : "");
    if (rsSaveLayout(name)) { save(); render(); toast(`이력서 양식 「${name.trim()}」을 저장했습니다`, "ok"); }
    return true;
  }
  if (act === "rs-layout-del") {
    const sel = document.querySelector("[data-rs-layout]");
    const item = S.resume.layouts.find((x) => x.id === sel?.value);
    if (!item) { toast("지울 양식을 먼저 고르세요.", "warn"); return true; }
    if (!confirm(`양식 「${item.name}」을 지울까요? (이력서 내용은 그대로입니다)`)) return true;
    S.resume.layouts = S.resume.layouts.filter((x) => x !== item);
    save(); render(); return true;
  }
  if (act === "rs-custom-add") {
    const title = prompt("섹션 제목 (예: 포트폴리오, 해외 경험)");
    if (!title || !title.trim()) return true;
    const std = RS_TO_STD.find(([re]) => re.test(title.trim()));
    if (std) {
      toast(`「${title.trim()}」은(는) 기본 섹션 「${RESUME_SECTIONS.find((x) => x.key === std[1]).title}」에 적어 주세요 — 적합도 근거로 쓰입니다`, "warn");
      document.getElementById(`sec-${std[1]}`)?.scrollIntoView({ block: "start" });
      return true;
    }
    S.resume.custom.push({ id: rsId(), title: title.trim(), rows: [{ id: rsId(), period: "", title: "", content: [] }] });
    S.resume = rsNormalize(S.resume);
    save(); render(); return true;
  }
  const cs = S.resume.custom[Number(btn.dataset.ci)];
  if (act === "rs-custom-row" && cs) { cs.rows.push({ id: rsId(), period: "", title: "", content: [] }); save(); render(); return true; }
  if (act === "rs-custom-row-del" && cs) { cs.rows.splice(Number(btn.dataset.i), 1); save(); render(); return true; }
  if (act === "rs-custom-del" && cs) {
    if (cs.rows.length && !confirm(`「${cs.title}」 섹션과 내용 ${cs.rows.length}건을 지울까요?`)) return true;
    S.resume.custom = S.resume.custom.filter((x) => x !== cs);
    S.resume = rsNormalize(S.resume);
    save(); render(); return true;
  }
  return false;
}

/* ============================================================
   docx 만들기 — WordprocessingML 을 직접 씁니다
   ============================================================ */
const DOCX_MIME = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const RS_ACCENT = "1F3A93";
const RS_LINE = "BFC6D0";
const RS_HEADFILL = "EEF2FB";
const RS_SUBFILL = "F7F9FC";
const RS_PAGE_W = 9638;   /* A4(11906) - 좌우 여백 1134×2 */

/* XML 1.0 에 넣을 수 없는 제어문자(탭·줄바꿈 제외)를 지우고 특수문자를 이스케이프합니다. */
const RS_BAD_XML = new RegExp("[\\u0000-\\u0008\\u000B\\u000C\\u000E-\\u001F]", "g");
const xe = (s) => String(s ?? "")
  .replace(RS_BAD_XML, "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function wRun(text, o = {}) {
  const rpr = (o.b ? "<w:b/>" : "")
    + (o.color ? `<w:color w:val="${o.color}"/>` : "")
    + (o.spacing ? `<w:spacing w:val="${o.spacing}"/>` : "")
    + (o.sz ? `<w:sz w:val="${o.sz}"/><w:szCs w:val="${o.sz}"/>` : "");
  return `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${xe(text)}</w:t></w:r>`;
}

function wPara(runs, o = {}) {
  const ppr = `<w:spacing w:before="${o.before || 0}" w:after="${o.after || 0}"/>`
    + (o.ind ? `<w:ind w:left="${o.ind}"/>` : "")
    + (o.jc ? `<w:jc w:val="${o.jc}"/>` : "");
  return `<w:p><w:pPr>${ppr}</w:pPr>${runs}</w:p>`;
}

function wHeading(text) {
  return `<w:p><w:pPr><w:keepNext/>`
    + `<w:pBdr><w:bottom w:val="single" w:sz="12" w:space="2" w:color="${RS_ACCENT}"/></w:pBdr>`
    + `<w:spacing w:before="320" w:after="100"/></w:pPr>`
    + wRun(text, { b: true, sz: 22, color: RS_ACCENT }) + `</w:p>`;
}

function wCell(content, w, o = {}) {
  return `<w:tc><w:tcPr><w:tcW w:w="${w}" w:type="dxa"/>`
    + (o.span ? `<w:gridSpan w:val="${o.span}"/>` : "")
    + (o.fill ? `<w:shd w:val="clear" w:color="auto" w:fill="${o.fill}"/>` : "")
    + `<w:vAlign w:val="center"/></w:tcPr>${content}</w:tc>`;
}

function wRow(cells, o = {}) {
  return `<w:tr><w:trPr><w:cantSplit/>${o.header ? "<w:tblHeader/>" : ""}</w:trPr>${cells}</w:tr>`;
}

function wTable(widths, rows) {
  const total = widths.reduce((a, b) => a + b, 0);
  const border = (side) => `<w:${side} w:val="single" w:sz="4" w:space="0" w:color="${RS_LINE}"/>`;
  return `<w:tbl><w:tblPr><w:tblW w:w="${total}" w:type="dxa"/>`
    + `<w:tblBorders>${["top", "left", "bottom", "right", "insideH", "insideV"].map(border).join("")}</w:tblBorders>`
    + `<w:tblLayout w:type="fixed"/>`
    + `<w:tblCellMar><w:top w:w="50" w:type="dxa"/><w:left w:w="90" w:type="dxa"/>`
    + `<w:bottom w:w="50" w:type="dxa"/><w:right w:w="90" w:type="dxa"/></w:tblCellMar></w:tblPr>`
    + `<w:tblGrid>${widths.map((w) => `<w:gridCol w:w="${w}"/>`).join("")}</w:tblGrid>${rows}</w:tbl>`;
}

function resumeDocumentXml(resume) {
  const m = resumeModel(resume);
  const body = [];

  body.push(wPara(wRun("이력서", { b: true, sz: 40, spacing: 160 }), { jc: "center", after: 20 }));
  body.push(wPara(wRun("RESUME", { sz: 16, color: "6B7280", spacing: 60 }), { jc: "center", after: 200 }));

  /* 인적사항 — 2행 4열 */
  const bw = [1400, 3419, 1400, 3419];
  const basicRow = (a, b) => wRow(
    wCell(wPara(wRun(a[0], { b: true, sz: 18 }), { jc: "center" }), bw[0], { fill: RS_HEADFILL })
    + wCell(wPara(wRun(a[1], { sz: 18 })), bw[1])
    + wCell(wPara(wRun(b[0], { b: true, sz: 18 }), { jc: "center" }), bw[2], { fill: RS_HEADFILL })
    + wCell(wPara(wRun(b[1], { sz: 18 })), bw[3]));
  body.push(wHeading("인적사항"));
  body.push(wTable(bw, m.basic.filter((_, i) => i % 2 === 0).map((a, j) => basicRow(a, m.basic[j * 2 + 1])).join("")));

  /* 각 항목 */
  m.sections.forEach((sec) => {
    const w = sec.cols.map((c) => c.w);
    const head = wRow(sec.cols.map((c, j) =>
      wCell(wPara(wRun(c.label, { b: true, sz: 18 }), { jc: "center" }), w[j], { fill: RS_HEADFILL })).join(""), { header: true });

    const rows = sec.rows.length
      ? sec.rows.map((row) =>
          wRow(row.cells.map((v, j) => wCell(wPara(wRun(v, { sz: 18 })), w[j])).join(""))
          + (row.sub.length
            ? wRow(wCell(row.sub.map((s) => wPara(wRun(`· ${s}`, { sz: 17, color: "374151" }), { ind: 80 })).join(""),
                RS_PAGE_W, { span: w.length, fill: RS_SUBFILL }))
            : "")).join("")
      : wRow(wCell(wPara(wRun(sec.empty, { sz: 18, color: "6B7280" }), { jc: "center" }), RS_PAGE_W, { span: w.length }));

    body.push(wHeading(sec.title));
    body.push(wTable(w, head + rows));
  });

  body.push(wPara(wRun("위 기재 사항은 사실과 다름없음을 확인합니다.", { sz: 19 }), { jc: "center", before: 560, after: 120 }));
  body.push(wPara(wRun(rsToday(), { sz: 19 }), { jc: "center", after: 200 }));
  body.push(wPara(wRun(`성명   ${m.name}   (인)`, { b: true, sz: 20 }), { jc: "right" }));

  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" `
    + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>`
    + body.join("")
    + `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>`
    + `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>`
    + `</w:sectPr></w:body></w:document>`;
}

const RS_STYLES_XML = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">`
  + `<w:docDefaults><w:rPrDefault><w:rPr>`
  + `<w:rFonts w:ascii="Malgun Gothic" w:eastAsia="맑은 고딕" w:hAnsi="Malgun Gothic" w:cs="Malgun Gothic"/>`
  + `<w:sz w:val="19"/><w:szCs w:val="19"/><w:lang w:val="en-US" w:eastAsia="ko-KR"/>`
  + `</w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="0" w:line="264" w:lineRule="auto"/></w:pPr></w:pPrDefault>`
  + `</w:docDefaults>`
  + `<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/><w:qFormat/></w:style>`
  + `</w:styles>`;

const RS_CONTENT_TYPES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">`
  + `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>`
  + `<Default Extension="xml" ContentType="application/xml"/>`
  + `<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>`
  + `<Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>`
  + `</Types>`;

const RS_ROOT_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>`
  + `</Relationships>`;

const RS_DOC_RELS = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
  + `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">`
  + `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
  + `</Relationships>`;

/* ---------- ZIP (압축 없이 저장하는 방식) ---------- */
const RS_CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function rsCrc32(bytes) {
  let c = 0xFFFFFFFF;
  for (let i = 0; i < bytes.length; i++) c = RS_CRC_TABLE[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
  return (c ^ 0xFFFFFFFF) >>> 0;
}

function rsZip(files) {
  const enc = new TextEncoder();
  const now = new Date();
  const time = (now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2);
  const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
  const parts = [];
  const central = [];
  let offset = 0;

  files.forEach((f) => {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = rsCrc32(data);

    const local = new DataView(new ArrayBuffer(30));
    local.setUint32(0, 0x04034b50, true);
    local.setUint16(4, 20, true);
    local.setUint16(6, 0x0800, true);          /* 파일명 UTF-8 */
    local.setUint16(8, 0, true);               /* 압축 없음 */
    local.setUint16(10, time, true);
    local.setUint16(12, date, true);
    local.setUint32(14, crc, true);
    local.setUint32(18, data.length, true);
    local.setUint32(22, data.length, true);
    local.setUint16(26, name.length, true);
    local.setUint16(28, 0, true);
    parts.push(new Uint8Array(local.buffer), name, data);

    const dir = new DataView(new ArrayBuffer(46));
    dir.setUint32(0, 0x02014b50, true);
    dir.setUint16(4, 20, true);
    dir.setUint16(6, 20, true);
    dir.setUint16(8, 0x0800, true);
    dir.setUint16(10, 0, true);
    dir.setUint16(12, time, true);
    dir.setUint16(14, date, true);
    dir.setUint32(16, crc, true);
    dir.setUint32(20, data.length, true);
    dir.setUint32(24, data.length, true);
    dir.setUint16(28, name.length, true);
    dir.setUint32(42, offset, true);
    central.push(new Uint8Array(dir.buffer), name);

    offset += 30 + name.length + data.length;
  });

  const dirSize = central.reduce((n, c) => n + c.length, 0);
  const end = new DataView(new ArrayBuffer(22));
  end.setUint32(0, 0x06054b50, true);
  end.setUint16(8, files.length, true);
  end.setUint16(10, files.length, true);
  end.setUint32(12, dirSize, true);
  end.setUint32(16, offset, true);

  const all = parts.concat(central, [new Uint8Array(end.buffer)]);
  const out = new Uint8Array(all.reduce((n, p) => n + p.length, 0));
  let pos = 0;
  all.forEach((p) => { out.set(p, pos); pos += p.length; });
  return out;
}

/* 이력서 데이터 → docx 파일 바이트 (브라우저·node 어디서나 동작) */
function resumeDocxBytes(resume) {
  return rsZip([
    { name: "[Content_Types].xml", text: RS_CONTENT_TYPES },
    { name: "_rels/.rels", text: RS_ROOT_RELS },
    { name: "word/document.xml", text: resumeDocumentXml(resume) },
    { name: "word/styles.xml", text: RS_STYLES_XML },
    { name: "word/_rels/document.xml.rels", text: RS_DOC_RELS },
  ]);
}

function exportResumeDocx() {
  const r = rsNormalize(S.resume);
  const name = rsStr(S.me?.name || r.basic.name);
  if (!name && !confirm("이름이 비어 있습니다. 그래도 받을까요?")) return;

  const blob = new Blob([resumeDocxBytes(r)], { type: DOCX_MIME });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `이력서_${(name || "이름없음").replace(/[\\/:*?"<>|()\s]/g, "")}.docx`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  badge("이력서 docx 를 받았습니다", "ok");
}
