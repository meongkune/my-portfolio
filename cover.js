/* ============================================================
   cover.js — ③ 자기소개서
   ------------------------------------------------------------
   공고를 고르고 문항을 넣은 뒤(기업 문항 붙여넣기 / 자유 양식 추천 문항),
   초안을 쓰면 5가지 기준으로 점수와 고칠 문장을 돌려줍니다.

     1. 이력서·공고와 일관성 25 — 이력서에 없는 이야기는 감점, 공고 요구와 연결되는지
     2. 구체적 사례·수치     20 — 언제·무엇을·얼마나 가 있는지
     3. 비전·목표 일치       15 — 내 목표와 회사·직무 방향이 이어지는지
     4. 강점·차별화 + 직무 연관 20
     5. 공통 작성 원칙       20 — 「자소서 잘 쓰는 법」 자료를 검색해, 여러 곳에서
                                 공통으로 나온 원칙만 기준으로 삼습니다 (출처 표시)

   점수는 앱이 더합니다. 인용한 문장이 실제 초안에 없으면 그 지적은 버립니다.
   ============================================================ */

const CV_SCHEMA = "pf-cover-v1";
const CV_RULES_SCHEMA = "pf-writing-rules-v1";
const CV_CRITERIA = [
  { key: "consistency", label: "이력서·공고와 일관성", max: 25, how: "이력서에 있는 경험으로 쓰였는지, 공고가 요구한 역량과 이어지는지" },
  { key: "concrete", label: "구체적 사례·수치", max: 20, how: "언제 · 무엇을 · 어떻게 · 결과(숫자)가 들어갔는지" },
  { key: "vision", label: "비전·목표 일치", max: 15, how: "내 목표와 회사·직무의 방향이 이어지는지" },
  { key: "strength", label: "강점·차별화 · 직무 연관", max: 20, how: "남과 다른 점이 드러나고 그것이 이 직무에 쓸모 있는지" },
  { key: "basics", label: "공통 작성 원칙", max: 20, how: "검색해 모은 자소서 원칙 중 공통으로 나온 것들을 지켰는지" },
];
const CV_FREE_HINT = [
  { question: "지원 동기 (이 회사, 이 직무를 선택한 이유)", limit: 700 },
  { question: "직무 역량 (해당 직무를 잘할 수 있는 근거)", limit: 700 },
  { question: "협업·문제 해결 경험", limit: 700 },
  { question: "입사 후 목표와 성장 계획", limit: 700 },
];

const cvLen = (t) => String(t || "").length;
const cvLenNoSpace = (t) => String(t || "").replace(/\s/g, "").length;

function cvNormalize(c) {
  if (!c || typeof c !== "object") return null;
  return {
    mode: c.mode === "free" ? "free" : "questions",
    at: rsStr(c.at),
    items: (Array.isArray(c.items) ? c.items : []).filter((x) => x && typeof x === "object").map((x) => ({
      id: x.id || uid("cv"), question: rsStr(x.question), limit: Number(x.limit) > 0 ? Number(x.limit) : 0,
      draft: String(x.draft || ""), review: x.review && typeof x.review === "object" ? x.review : null,
      draftBy: rsStr(x.draftBy), blanks: rsArr(x.blanks), why: rsStr(x.why),
    })),
  };
}

/* ---------- 「자소서 잘 쓰는 법」 공통 원칙 조사 (한 번 해두면 계속 씁니다) ---------- */
function cvRulesPrompt() {
  return `취업 자기소개서를 잘 쓰는 방법을 실제 자료로 조사해, 여러 자료에서 공통으로 나오는 원칙만 추려 주세요.

[조사]
1) ${clNaverRule()} "자기소개서 잘 쓰는 법", "자소서 작성법 인사담당자", "신입 자소서 첨삭 기준" 같은 검색어로 찾습니다.
2) 채용 플랫폼·대학 취업지원센터·인사담당자 인터뷰 기사 등 서로 다른 출처 5곳 이상을 실제로 열어 읽습니다.
3) 여러 출처에 <반복해서> 나오는 원칙만 남깁니다. 한 곳에서만 나온 이야기는 버립니다.

[정리]
- rules 는 8~12개. rule 은 한 줄 지시문(예: "결론을 첫 문장에 쓴다"), why 는 왜 그런지 한 줄.
- count 는 그 원칙이 나온 출처 수, sources 는 그 출처들의 제목과 주소.
- 실제로 읽은 자료만 인용하고 주소를 지어내지 않습니다. 못 찾았으면 rules 를 비우고 notes 에 적습니다.

[출력] 설명 없이 아래 JSON 만 출력하세요.
${JSON.stringify({
    schema: CV_RULES_SCHEMA,
    rules: [{ rule: "", why: "", count: 0, sources: [{ title: "", url: "" }] }],
    sources: [{ title: "", url: "" }], notes: [""],
  }, null, 1)}`;
}

async function cvLoadRules(force = false) {
  if (S.writingRules?.items?.length && !force) return S.writingRules;
  const data = await clRun({ title: "자소서 작성 원칙 조사", prompt: cvRulesPrompt(), naver: true, web: true, expect: CV_RULES_SCHEMA });
  if (!data) return S.writingRules;
  const arr = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
  S.writingRules = {
    at: todayStr(),
    items: arr(data.rules).map((r) => ({
      rule: rsStr(r.rule), why: rsStr(r.why), count: Number(r.count) || 0,
      sources: arr(r.sources).map((x) => ({ title: rsStr(x.title), url: poCleanUrl(x.url) })).filter((x) => x.url),
    })).filter((r) => r.rule).sort((a, b) => b.count - a.count),
    sources: arr(data.sources).map((x) => ({ title: rsStr(x.title), url: poCleanUrl(x.url) })).filter((x) => x.url),
    notes: rsArr(data.notes),
  };
  save();
  return S.writingRules;
}

/* ---------- 문항 만들기 ---------- */
function cvSplitQuestions(text) {
  const raw = String(text || "").replace(/\r/g, "");
  const blocks = raw.split(/\n(?=\s*(?:\d+[.)]|[①-⑩]|문항\s*\d|Q\s*\d))/i).map((b) => b.trim()).filter(Boolean);
  const list = (blocks.length > 1 ? blocks : raw.split(/\n{2,}/)).map((b) => b.trim()).filter(Boolean);
  return list.map((b) => {
    const limit = Number((b.match(/(\d{3,4})\s*자/) || [])[1]) || 0;
    return { id: uid("cv"), question: b.replace(/\s+/g, " ").slice(0, 300), limit, draft: "", review: null };
  });
}

async function cvSuggestQuestions(p) {
  const data = await clRun({
    title: `자소서 문항 추천 — ${p.company}`, expect: "pf-cover-q-v1",
    prompt: `자유 양식 자기소개서를 쓰려는 지원자를 위해, 이 공고에 맞는 문항 4개를 만들어 주세요.

[공고] ${p.company} · ${p.title}
주요 업무: ${p.duties.join(" / ") || "-"}
요구사항: ${p.requirements.map((r) => `${r.level} ${r.label}`).join(" / ") || "-"}

- 지원 동기 / 직무 역량 / 협업·문제 해결 / 입사 후 목표 를 이 회사·직무에 맞게 구체적으로 바꿔 씁니다.
- 각 문항에 권장 글자 수(limit, 보통 600~800)와 왜 이 문항이 필요한지(why)를 답니다.
[출력] JSON 만: ${JSON.stringify({ schema: "pf-cover-q-v1", items: [{ question: "", limit: 700, why: "" }] })}`,
  });
  if (!data) return null;
  return (Array.isArray(data.items) ? data.items : []).filter((x) => rsStr(x?.question)).map((x) => ({
    id: uid("cv"), question: rsStr(x.question), limit: Number(x.limit) > 0 ? Number(x.limit) : 700, draft: "", review: null, why: rsStr(x.why),
  }));
}

/* ---------- 초안 만들어 주기 ----------
   내 이력서에 있는 내용만으로 뼈대를 잡아 줍니다. 숫자·이름은 [ ] 로 비워 두고 내가 채웁니다. */
function cvDraftPrompt(p, item, ev, rules) {
  return `취업 준비생의 자기소개서 초안을 만들어 주세요. 그대로 내는 글이 아니라, 본인이 고쳐 쓸 뼈대입니다.

[지원 공고] ${p.company} · ${p.title}
주요 업무: ${p.duties.join(" / ") || "-"}
요구사항: ${p.requirements.map((r) => `${r.rid} (${r.level}) ${r.label}`).join(" / ") || "-"}
${p.fit ? `적합도 평가에서 강했던 점: ${p.fit.strengths.map((x) => x.text).join(" / ") || "-"}\n부족했던 항목: ${p.fit.computed.reqs.filter((r) => r.status !== "충족").map((r) => r.label).join(", ") || "없음"}` : ""}

[지원자 근거 목록 — 이 목록에 있는 사실만 씁니다]
${rsEvidenceText(ev) || "(이력서가 비어 있음)"}

[문항] ${item.question}
[분량] ${item.limit ? `${item.limit}자 기준으로 ${Math.round(item.limit * 0.9)}~${item.limit}자` : "600~700자"}

[공통 작성 원칙]
${rules.length ? rules.slice(0, 8).map((r, i) => `${i + 1}. ${r.rule}`).join("\n") : "(두괄식 · 구체적 수치 · 직무 연결 · 과장 금지)"}

[꼭 지킬 것]
- 근거 목록에 없는 경험·수치·회사명을 지어내지 않습니다. 필요한데 없는 값은 [여기에 내 수치]처럼 대괄호 빈칸으로 둡니다.
- 문장은 짧고 담백하게. 과장된 수식어, 뻔한 표현("열정", "최선을 다해")은 쓰지 않습니다.
- usedEvidence 에는 실제로 쓴 근거의 E번호, blanks 에는 지원자가 채워야 할 빈칸 목록을 적습니다.

[출력] 설명 없이 아래 JSON 만 출력하세요.
${JSON.stringify({ schema: "pf-cover-draft-v1", draft: "", usedEvidence: ["E1"], blanks: ["채워야 할 것"], note: "고쳐 쓸 때 볼 것" }, null, 1)}`;
}

async function cvDraft(pid, itemId) {
  const p = poGet(pid);
  const item = p?.cover?.items.find((x) => x.id === itemId);
  if (!item || cvBusy.has(itemId)) return;
  if (!rsStr(item.question)) { toast("먼저 문항을 적어 주세요.", "warn"); return; }
  if (rsStr(item.draft) && !confirm("지금 쓴 초안을 AI 초안으로 바꿀까요? (되돌리기 가능)")) return;
  const prev = item.draft;
  cvBusy.add(itemId); renderSoft();
  try {
    const ev = rsEvidence();
    const data = await clRun({ title: `자소서 초안 — ${p.company}`, prompt: cvDraftPrompt(p, item, ev, S.writingRules?.items || []), expect: "pf-cover-draft-v1" });
    const t = poGet(pid)?.cover?.items.find((x) => x.id === itemId);
    if (data && t && rsStr(data.draft)) {
      t.draft = String(data.draft);
      t.draftBy = "ai";
      t.blanks = rsArr(data.blanks);
      t.review = null;
      save();
      toast(`초안을 만들었습니다 — 내 말로 고쳐 쓰고 [첨삭받기]로 확인하세요`, "ok",
        { label: "되돌리기", run: () => { t.draft = prev; t.draftBy = ""; t.blanks = []; save(); render(); } });
    }
  } catch (e) {
    toast("❌ " + e.message, "warn");
  } finally {
    cvBusy.delete(itemId); renderSoft();
  }
}

/* ---------- 지난 자소서 보관함 ----------
   잘 쓴 문항을 모아 두고, 다른 회사 비슷한 문항에 가져와 고쳐 씁니다. */
function cvLibAdd(p, item, score) {
  S.coverLibrary = Array.isArray(S.coverLibrary) ? S.coverLibrary : [];
  const text = rsStr(item.draft);
  if (!text) return false;
  const i = S.coverLibrary.findIndex((x) => x.question === item.question && x.company === p.company);
  const row = { id: uid("lib"), at: todayStr(), company: p.company, position: p.title, question: item.question, text, score: score || 0 };
  if (i >= 0) { row.id = S.coverLibrary[i].id; S.coverLibrary[i] = row; } else S.coverLibrary.unshift(row);
  S.coverLibrary = S.coverLibrary.slice(0, 80);
  save();
  return true;
}

const cvWords = (t) => new Set(String(t || "").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter((w) => w.length >= 2));
function cvSimilar(question) {
  const a = cvWords(question);
  return (Array.isArray(S.coverLibrary) ? S.coverLibrary : []).map((x) => {
    const b = cvWords(x.question);
    const hit = [...a].filter((w) => b.has(w)).length;
    return { ...x, sim: a.size ? hit / a.size : 0 };
  }).sort((x, y) => y.sim - x.sim || y.score - x.score);
}

function cvLibDialog(pid, itemId) {
  const p = poGet(pid);
  const item = p.cover.items.find((x) => x.id === itemId);
  const rows = cvSimilar(item.question);
  const dlg = document.createElement("dialog");
  dlg.className = "dlg";
  dlg.innerHTML = `
    <h3>📚 지난 자소서에서 가져오기</h3>
    <p class="muted small">비슷한 문항부터 보여 줍니다. 가져온 뒤에는 이 회사에 맞게 꼭 고쳐 쓰세요 — 그대로 내면 감점됩니다.</p>
    ${rows.length ? `<div class="lib-list">${rows.slice(0, 12).map((x, i) => `
      <div class="lib-item">
        <div><strong>${esc(x.question.slice(0, 60))}</strong>
          <div class="muted small">${esc(x.company)} · ${esc(x.at)}${x.score ? ` · ${x.score}점` : ""}${x.sim > 0.3 ? ` · 비슷한 문항` : ""}</div>
          <p class="small lib-prev">${esc(x.text.slice(0, 120))}…</p></div>
        <button class="btn btn-sm" data-lib="${i}" type="button">가져오기</button>
      </div>`).join("")}</div>`
    : `<p class="empty">보관된 자소서가 없습니다. 첨삭을 받으면 자동으로 보관되고, [보관] 버튼으로도 넣을 수 있습니다.</p>`}
    <div class="row dlg-actions"><button class="btn btn-ghost" data-lib="close" type="button">닫기</button></div>`;
  dlg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-lib]");
    if (!b) return;
    if (b.dataset.lib !== "close") {
      const row = rows[Number(b.dataset.lib)];
      const prev = item.draft;
      item.draft = row.text;
      item.draftBy = "library";
      item.review = null;
      save(); render();
      toast(`「${row.company}」 자소서를 가져왔습니다 — 이 회사에 맞게 고쳐 쓰세요`, "ok",
        { label: "되돌리기", run: () => { item.draft = prev; item.draftBy = ""; save(); render(); } });
    }
    dlg.close();
  });
  dlg.addEventListener("close", () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
}

/* ---------- 초안 검토 ---------- */
function cvReviewPrompt(p, item, ev, rules) {
  return `아래 자기소개서 초안을 취업 준비생 눈높이로 첨삭하고 점수를 매겨 주세요.

[지원 공고] ${p.company} · ${p.title}
주요 업무: ${p.duties.join(" / ") || "-"}
요구사항: ${p.requirements.map((r) => `${r.rid} (${r.level}) ${r.label}`).join(" / ") || "-"}
${p.fit ? `적합도 평가에서 부족했던 항목: ${p.fit.computed.reqs.filter((r) => r.status !== "충족").map((r) => r.label).join(", ") || "없음"}` : ""}

[지원자 근거 목록 — 사실 확인은 이 목록만 기준]
${rsEvidenceText(ev) || "(이력서가 비어 있음)"}

[공통 작성 원칙 — 여러 자료에서 공통으로 나온 것]
${rules.length ? rules.map((r, i) => `${i + 1}. ${r.rule}${r.why ? ` (${r.why})` : ""}`).join("\n") : "(아직 조사 전 — 일반적인 자소서 기준으로 평가하고 basics.note 에 적어 주세요)"}

[문항] ${item.question}
[글자 수 제한] ${item.limit ? `${item.limit}자` : "제한 없음"} / 현재 ${cvLen(item.draft)}자
[초안]
"""
${item.draft}
"""

[채점]
- 다섯 기준에 점수를 줍니다: ${CV_CRITERIA.map((c) => `${c.key}(${c.label}) 0~${c.max}`).join(" · ")}.
- 각 기준마다 왜 그 점수인지 한두 문장(reason)과, 초안에서 그렇게 판단한 근거 문장(quote — 초안에 있는 문장 그대로) 을 답니다.
- consistency 의 unsupported 에는 <이력서 근거 목록에 없는데 초안이 사실처럼 쓴 문장>을 그대로 옮깁니다. 지어낸 경험이 없으면 빈 배열.
- basics.checked 에는 위 공통 원칙 중 지킨 원칙 번호, basics.missed 에는 못 지킨 원칙 번호를 넣습니다.

[첨삭]
- fixes: 고치면 좋은 문장 3~5개. before(초안 문장 그대로) / after(고친 문장) / why(한 줄).
- addFromResume: 이력서 근거 중 이 문항에 넣으면 좋은 것 1~3개 (evidence 는 E번호, how 는 어떻게 녹일지).
- nextStep: 다시 쓸 때 가장 먼저 할 일 한 줄.
- 초안에 없는 경험을 지어내 넣지 않습니다. 부족하면 "이력서에서 가져오라"고 안내합니다.

[출력] 설명 없이 아래 JSON 만 출력하세요.
${JSON.stringify({
    schema: CV_SCHEMA,
    scores: { consistency: { score: 0, reason: "", quote: "", unsupported: [""] }, concrete: { score: 0, reason: "", quote: "" },
      vision: { score: 0, reason: "", quote: "" }, strength: { score: 0, reason: "", quote: "" },
      basics: { score: 0, reason: "", checked: [1], missed: [2], note: "" } },
    summary: "한 줄 총평", keep: ["살릴 점"], fixes: [{ before: "", after: "", why: "" }],
    addFromResume: [{ evidence: "E1", how: "" }], nextStep: "",
  }, null, 1)}`;
}

function cvComputeReview(item, raw, ev, rulesLen) {
  const draft = String(item.draft || "");
  const inDraft = (t) => { const q = rsStr(t); return q && draft.replace(/\s/g, "").includes(q.replace(/\s/g, "").slice(0, 40)); };
  const byId = new Map(ev.map((e) => [e.id, e]));
  const warnings = [];
  const s = raw.scores && typeof raw.scores === "object" ? raw.scores : {};
  const parts = CV_CRITERIA.map((c) => {
    const j = s[c.key] && typeof s[c.key] === "object" ? s[c.key] : {};
    let got = Math.max(0, Math.min(c.max, Math.round(Number(j.score) || 0)));
    const quote = inDraft(j.quote) ? rsStr(j.quote) : "";
    if (rsStr(j.quote) && !quote) warnings.push(`${c.label}: 초안에 없는 문장을 근거로 들어 그 근거는 뺐습니다`);
    return { ...c, got, reason: rsStr(j.reason), quote };
  });
  const cons = s.consistency && typeof s.consistency === "object" ? s.consistency : {};
  const unsupported = rsArr(cons.unsupported).filter((x) => inDraft(x));
  const consPart = parts.find((p) => p.key === "consistency");
  if (unsupported.length && consPart.got > 12) {
    warnings.push(`이력서에 없는 내용 ${unsupported.length}건이 있어 일관성 점수를 12점으로 낮췄습니다`);
    consPart.got = 12;
  }
  const basics = s.basics && typeof s.basics === "object" ? s.basics : {};
  if (!rulesLen) {
    const b = parts.find((p) => p.key === "basics");
    warnings.push("작성 원칙을 아직 조사하지 않아 일반 기준으로 평가했습니다 — [원칙 조사]를 누르면 더 정확해집니다");
  }
  const total = parts.reduce((n, p) => n + p.got, 0);
  const over = item.limit ? cvLen(draft) - item.limit : 0;
  if (over > 0) warnings.push(`글자 수가 ${over}자 넘습니다 — 제출 시 잘릴 수 있습니다`);
  else if (item.limit && cvLen(draft) < item.limit * 0.7) warnings.push(`글자 수가 권장(${item.limit}자)의 70%에 못 미칩니다 — 내용을 더 채우세요`);

  const arr = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
  return {
    at: todayStr(), total, grade: total >= 85 ? "제출 가능" : total >= 70 ? "조금만 다듬기" : total >= 50 ? "보완 필요" : "다시 쓰기",
    parts, warnings, unsupported, summary: rsStr(raw.summary), keep: rsArr(raw.keep), nextStep: rsStr(raw.nextStep),
    basics: { checked: rsArr(basics.checked).length, missed: rsArr(basics.missed).map((x) => String(x)), note: rsStr(basics.note) },
    fixes: arr(raw.fixes).map((f) => ({ before: rsStr(f.before), after: rsStr(f.after), why: rsStr(f.why) }))
      .filter((f) => f.after && (!f.before || inDraft(f.before))),
    add: arr(raw.addFromResume).filter((a) => byId.has(rsStr(a.evidence)))
      .map((a) => ({ text: byId.get(rsStr(a.evidence)).text, where: byId.get(rsStr(a.evidence)).where, how: rsStr(a.how) })),
    len: cvLen(draft), lenNoSpace: cvLenNoSpace(draft), limit: item.limit,
  };
}

let cvBusy = new Set();

async function cvReview(pid, itemId) {
  const p = poGet(pid);
  const item = p?.cover?.items.find((x) => x.id === itemId);
  if (!item || cvBusy.has(itemId)) return;
  if (!rsStr(item.draft)) { toast("먼저 초안을 써 주세요. 짧아도 괜찮습니다.", "warn"); return; }
  cvBusy.add(itemId); renderSoft();
  try {
    const rules = S.writingRules?.items || [];
    const ev = rsEvidence();
    const data = await clRun({ title: `자소서 첨삭 — ${p.company}`, prompt: cvReviewPrompt(p, item, ev, rules), expect: CV_SCHEMA });
    const t = poGet(pid)?.cover?.items.find((x) => x.id === itemId);
    if (data && t) {
      t.review = cvComputeReview(t, data, ev, rules.length);
      p.cover.at = todayStr();
      if (t.review.total >= 70) cvLibAdd(p, t, t.review.total);   /* 잘 쓴 문항은 보관함에 모아 다른 회사에서 다시 씁니다 */
      save();
      toast(`✍ 첨삭 완료 — ${t.review.total}점 (${t.review.grade})`, "ok");
    }
  } catch (e) {
    toast("❌ " + e.message, "warn");
  } finally {
    cvBusy.delete(itemId); renderSoft();
  }
}

/* ---------- 버튼 · 입력 ---------- */
function coverAction(act, btn) {
  if (!String(act).startsWith("cv-")) return false;
  const pid = btn.dataset.id;
  const p = pid ? poGet(pid) : null;
  const ensure = () => { if (p && !p.cover) p.cover = { mode: "questions", at: "", items: [] }; return p?.cover; };

  if (act === "cv-mode") {
    const c = ensure();
    c.mode = btn.dataset.mode;
    save(); render();
  }
  if (act === "cv-paste") {
    const box = document.querySelector("[data-cv-paste]");
    const items = cvSplitQuestions(box?.value);
    if (!items.length) { toast("문항을 붙여넣어 주세요. 여러 문항이면 줄을 나눠 넣으면 됩니다.", "warn"); return true; }
    const c = ensure();
    c.items = c.items.concat(items);
    save(); render();
    toast(`문항 ${items.length}개를 넣었습니다`, "ok");
  }
  if (act === "cv-suggest") {
    const c = ensure();
    (async () => {
      btn.disabled = true;
      try {
        const items = await cvSuggestQuestions(p);
        if (items) { c.items = c.items.concat(items); save(); render(); toast(`이 공고에 맞는 문항 ${items.length}개를 만들었습니다`, "ok"); }
      } catch (e) { toast("❌ " + e.message, "warn"); }
      btn.disabled = false;
    })();
  }
  if (act === "cv-basic") {
    const c = ensure();
    c.items = c.items.concat(CV_FREE_HINT.map((x) => ({ ...x, id: uid("cv"), draft: "", review: null })));
    save(); render();
  }
  if (act === "cv-add") { const c = ensure(); c.items.push({ id: uid("cv"), question: "", limit: 700, draft: "", review: null }); save(); render(); }
  if (act === "cv-del") {
    const c = ensure();
    const i = c.items.findIndex((x) => x.id === btn.dataset.item);
    const removed = c.items.splice(i, 1)[0];
    save(); render();
    toast("문항을 지웠습니다", "", { label: "되돌리기", run: () => { c.items.splice(i, 0, removed); save(); render(); } });
  }
  if (act === "cv-review") cvReview(pid, btn.dataset.item);
  if (act === "cv-draft") cvDraft(pid, btn.dataset.item);
  if (act === "cv-lib") cvLibDialog(pid, btn.dataset.item);
  if (act === "cv-keep") {
    const item = p.cover.items.find((x) => x.id === btn.dataset.item);
    toast(cvLibAdd(p, item, item.review?.total || 0) ? "보관함에 넣었습니다" : "초안이 비어 있습니다", "ok");
  }
  if (act === "cv-rules") {
    (async () => {
      btn.disabled = true;
      try { await cvLoadRules(true); render(); toast("자소서 작성 원칙을 정리했습니다", "ok"); }
      catch (e) { toast("❌ " + e.message, "warn"); }
      btn.disabled = false;
    })();
  }
  if (act === "cv-export") { cvExport(p, btn.dataset.kind); return true; }
  if (act === "cv-copy") {
    const item = p.cover.items.find((x) => x.id === btn.dataset.item);
    copyText(item.draft).then((ok) => ok ? toast("초안을 복사했습니다", "ok")
      : cvManualCopy(item.draft, "초안"));
  }
  if (act === "cv-apply-fix") {
    const item = p.cover.items.find((x) => x.id === btn.dataset.item);
    const fix = item.review.fixes[Number(btn.dataset.i)];
    if (!fix.before || !item.draft.includes(fix.before)) { toast("원문을 찾지 못했습니다. 직접 고쳐 주세요.", "warn"); return true; }
    item.draft = item.draft.replace(fix.before, fix.after);
    save(); render();
    toast("문장을 바꿨습니다 — 다시 [첨삭받기]로 확인해 보세요", "ok");
  }
  return true;
}

function coverInput(t) {
  if (t.dataset.cvSelect != null) { location.hash = t.value ? `#/cover/${t.value}` : "#/cover"; return true; }
  if (!t.dataset.cv) return false;
  const p = poGet(t.dataset.cvPid);
  const item = p?.cover?.items.find((x) => x.id === t.dataset.cvItem);
  if (!item) return true;
  if (t.dataset.cv === "limit") item.limit = Number(t.value) || 0;
  else item[t.dataset.cv] = t.value;
  save();
  if (t.dataset.cv === "draft") cvRefreshCount(t, item);
  return true;
}

function cvRefreshCount(t, item) {
  const el = t.closest(".cv-item")?.querySelector("[data-cv-count]");
  if (!el) return;
  const n = cvLen(t.value);
  const over = item.limit && n > item.limit;
  el.className = `chip ${over ? "warn" : item.limit && n >= item.limit * 0.7 ? "ok" : ""}`;
  el.textContent = `${n}자${item.limit ? ` / ${item.limit}자` : ""} (공백 제외 ${cvLenNoSpace(t.value)}자)`;
}

/* ---------- 제출용 내보내기 ----------
   resume.js 의 docx 만드는 도구(wPara·wRun·rsZip)를 그대로 씁니다. */
function cvDocxBytes(p) {
  const body = [];
  body.push(wPara(wRun("자기소개서", { b: true, sz: 32, spacing: 100 }), { jc: "center", after: 80 }));
  body.push(wPara(wRun(`${p.company} · ${p.title}`, { sz: 19, color: "6A6A6A" }), { jc: "center", after: 240 }));
  body.push(wPara(wRun(`${S.me.name || ""}${S.me.phone ? ` · ${S.me.phone}` : ""}${S.me.email ? ` · ${S.me.email}` : ""}`, { sz: 18 }), { jc: "right", after: 200 }));
  p.cover.items.forEach((item, i) => {
    const len = cvLen(item.draft);
    body.push(wPara(wRun(`${i + 1}. ${item.question}`, { b: true, sz: 20 }), { before: 240, after: 60 }));
    body.push(wPara(wRun(`(${len}자${item.limit ? ` / ${item.limit}자` : ""})`, { sz: 16, color: "8B95A1" }), { after: 80 }));
    String(item.draft || "").split("\n").forEach((line) => body.push(wPara(wRun(line, { sz: 19, spacing: 40 }), { after: 60 })));
  });
  const xml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>`
    + `<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main" `
    + `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><w:body>`
    + body.join("")
    + `<w:sectPr><w:pgSz w:w="11906" w:h="16838"/>`
    + `<w:pgMar w:top="1134" w:right="1134" w:bottom="1134" w:left="1134" w:header="567" w:footer="567" w:gutter="0"/>`
    + `</w:sectPr></w:body></w:document>`;
  return rsZip([
    { name: "[Content_Types].xml", text: RS_CONTENT_TYPES },
    { name: "_rels/.rels", text: RS_ROOT_RELS },
    { name: "word/document.xml", text: xml },
    { name: "word/styles.xml", text: RS_STYLES_XML },
    { name: "word/_rels/document.xml.rels", text: RS_DOC_RELS },
  ]);
}

const cvPlainText = (p) => p.cover.items.map((item, i) =>
  `${i + 1}. ${item.question}${item.limit ? ` (${item.limit}자)` : ""}\n\n${item.draft}\n\n[${cvLen(item.draft)}자]`).join("\n\n────────\n\n");

/* 브라우저가 복사를 막았을 때 — 직접 골라 복사할 수 있게 창으로 보여 줍니다 */
function cvManualCopy(text, label) {
  const dlg = document.createElement("dialog");
  dlg.className = "dlg";
  dlg.innerHTML = `<h3>${esc(label)} 복사</h3>
    <p class="notice warn small">이 브라우저가 자동 복사를 막았습니다. 아래 칸을 누르면 전체가 선택됩니다 — <strong>⌘C</strong> 로 복사하세요.</p>
    <textarea class="prompt-preview" rows="12" readonly></textarea>
    <div class="row dlg-actions"><button class="btn btn-ghost" type="button">닫기</button></div>`;
  const ta = dlg.querySelector("textarea");
  ta.value = text;
  ta.addEventListener("focus", () => ta.select());
  dlg.querySelector("button").onclick = () => dlg.close();
  dlg.addEventListener("close", () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
  ta.focus(); ta.select();
}

function cvExport(p, kind) {
  const filled = p.cover.items.filter((x) => rsStr(x.draft));
  if (!filled.length) { toast("내보낼 초안이 없습니다.", "warn"); return; }
  const name = `자소서_${(p.company || "회사").replace(/[\\/:*?"<>|\s]/g, "")}_${todayStr()}`;
  if (kind === "copy") {
    const text = cvPlainText(p);
    copyText(text).then((ok) => ok ? toast("전체 문항을 복사했습니다", "ok") : cvManualCopy(text, "자소서 전체"));
    return;
  }
  const blob = kind === "docx" ? new Blob([cvDocxBytes(p)], { type: DOCX_MIME }) : new Blob([cvPlainText(p)], { type: "text/plain;charset=utf-8" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${name}.${kind === "docx" ? "docx" : "txt"}`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  toast(`${kind === "docx" ? "Word 파일" : "텍스트 파일"}로 받았습니다`, "ok");
}

/* ---------- 화면 ---------- */
function renderCover(sub) {
  const list = S.postings.filter((x) => x.title)
    .sort((a, b) => (PO_DONE.includes(a.stage) - PO_DONE.includes(b.stage)) || (b.star - a.star) || (b.fit?.computed.total ?? 0) - (a.fit?.computed.total ?? 0));
  const p = sub ? poGet(sub) : null;
  const rules = S.writingRules;

  const head = `
  <div class="view-head">
    <h2>③ 자소서</h2>
    <p class="muted">공고를 고르고 문항을 넣으면, 내 이력서·공고와 견줘 <strong>고칠 문장까지</strong> 짚어 줍니다. 이력서에 없는 이야기는 바로 표시됩니다.</p>
  </div>
  <section class="card">
    <label class="field"><span>어느 공고의 자소서인가요?</span>
      <select data-cv-select="1">
        <option value="">— 공고 고르기 —</option>
        ${list.map((c) => `<option value="${esc(c.id)}"${c.id === sub ? " selected" : ""}>${c.star ? "★ " : ""}${esc(c.company)} · ${esc(c.title)}${c.fit ? ` (적합도 ${c.fit.computed.total})` : ""}${c.cover?.items.length ? ` · 자소서 ${c.cover.items.length}문항` : ""}${PO_DONE.includes(c.stage) ? ` · ${esc(c.stage)}` : ""}</option>`).join("")}
      </select></label>
    ${list.length ? "" : `<p class="muted">먼저 <a href="#/postings">② 채용공고</a>에 공고를 넣어 주세요.</p>`}
  </section>
  ${cvRulesCardHTML(rules)}`;
  if (!p) return head;

  const c = p.cover || { mode: "questions", items: [] };
  return head + `
  <section class="card">
    <div class="card-head"><h3>${esc(p.company)} · ${esc(p.title)}</h3>
      <div class="row wrap"><a class="btn btn-sm btn-ghost" href="#/postings/${esc(p.id)}">적합도 보기</a><a class="btn btn-sm btn-ghost" href="#/interview/${esc(p.id)}">면접 준비</a></div></div>
    ${(c.items || []).some((x) => rsStr(x.draft)) ? `<div class="row wrap export-row">
      <span class="muted small">제출용으로 내보내기</span>
      <button class="btn btn-sm" data-act="cv-export" data-kind="docx" data-id="${esc(p.id)}" type="button">📄 Word(docx)</button>
      <button class="btn btn-sm" data-act="cv-export" data-kind="txt" data-id="${esc(p.id)}" type="button">📝 텍스트</button>
      <button class="btn btn-sm btn-ghost" data-act="cv-export" data-kind="copy" data-id="${esc(p.id)}" type="button">전체 복사</button>
    </div>` : ""}
    ${p.fit ? `<p class="muted small">적합도 ${p.fit.computed.total}점 · 부족한 항목: ${p.fit.computed.reqs.filter((r) => r.status !== "충족").map((r) => esc(r.label)).join(", ") || "없음"} → 자소서에서 보완하면 좋습니다.</p>` : ""}
    <div class="seg" style="margin-top:10px">
      ${[["questions", "📋 기업 문항이 있어요"], ["free", "✍ 자유 양식이에요"]].map(([k, l]) =>
        `<button class="seg-btn" aria-selected="${c.mode === k}" data-act="cv-mode" data-mode="${k}" data-id="${esc(p.id)}" type="button">${l}</button>`).join("")}
    </div>
    ${c.mode === "questions" ? `
      <label class="field"><span>공고·채용 사이트의 자소서 문항을 그대로 붙여넣으세요 (여러 개면 줄을 나눠서)</span>
        <textarea data-cv-paste rows="4" placeholder="1. 지원 동기를 기술하시오 (700자)&#10;2. 입사 후 포부 (500자)"></textarea></label>
      <div class="row" style="justify-content:flex-end"><button class="btn" data-act="cv-paste" data-id="${esc(p.id)}" type="button">문항 넣기</button></div>`
    : `
      <p class="muted small">자유 양식이면 아래 버튼으로 문항을 만들어 쓰세요. 회사가 원하는 이야기를 빠뜨리지 않게 됩니다.</p>
      <div class="row wrap">
        <button class="btn btn-primary btn-sm" data-act="cv-suggest" data-id="${esc(p.id)}" type="button">이 공고에 맞는 문항 만들기</button>
        <button class="btn btn-sm" data-act="cv-basic" data-id="${esc(p.id)}" type="button">기본 4문항 넣기</button>
      </div>`}
    <div class="row" style="justify-content:flex-end;margin-top:8px"><button class="btn btn-sm btn-ghost" data-act="cv-add" data-id="${esc(p.id)}" type="button">+ 빈 문항 추가</button></div>
  </section>

  ${c.items.map((item, i) => cvItemHTML(p, item, i)).join("") || `<section class="card"><p class="empty">문항을 먼저 넣어 주세요.</p></section>`}`;
}

function cvRulesCardHTML(rules) {
  const top = rules?.items?.slice(0, 12) || [];
  return `
  <section class="card">
    <div class="card-head"><h3>📚 자소서 잘 쓰는 법 <span class="muted small">${rules?.at ? `${esc(rules.at)} 조사` : "아직 조사 전"}</span></h3>
      <button class="btn btn-sm ${top.length ? "btn-ghost" : "btn-primary"}" data-act="cv-rules" type="button">${top.length ? "다시 조사" : "원칙 조사하기"}</button></div>
    ${top.length ? `
      <p class="muted small">여러 자료에서 <strong>공통으로</strong> 나온 원칙만 모았습니다. 아래 원칙이 채점 기준(20점)이 됩니다.</p>
      <ol class="plain cv-rules">${top.map((r) => `<li><strong>${esc(r.rule)}</strong>${r.count ? ` <span class="chip">${r.count}곳</span>` : ""}${r.why ? `<div class="muted small">${esc(r.why)}</div>` : ""}</li>`).join("")}</ol>
      ${rules.sources?.length ? `<details class="sub-det"><summary>출처 ${rules.sources.length}개</summary><ul class="plain small">${rules.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a></li>`).join("")}</ul></details>` : ""}`
    : `<p class="muted small">한 번만 눌러 두면 「자소서 잘 쓰는 법」 자료를 찾아 공통 원칙을 정리해 두고, 모든 자소서 채점에 같은 기준으로 씁니다.</p>`}
  </section>`;
}

function cvItemHTML(p, item, i) {
  const r = item.review;
  const busy = cvBusy.has(item.id);
  const len = cvLen(item.draft);
  const over = item.limit && len > item.limit;
  return `
  <section class="card cv-item">
    <div class="card-head">
      <h3>문항 ${i + 1}</h3>
      <div class="row wrap">
        <span class="chip ${over ? "warn" : item.limit && len >= item.limit * 0.7 ? "ok" : ""}" data-cv-count>${len}자${item.limit ? ` / ${item.limit}자` : ""} (공백 제외 ${cvLenNoSpace(item.draft)}자)</span>
        <button class="btn btn-sm btn-ghost" data-act="cv-copy" data-id="${esc(p.id)}" data-item="${esc(item.id)}" type="button">복사</button>
        <button class="btn btn-sm btn-ghost btn-danger" data-act="cv-del" data-id="${esc(p.id)}" data-item="${esc(item.id)}" type="button">삭제</button>
      </div>
    </div>
    <div class="row wrap cv-qrow">
      <input type="text" data-cv="question" data-cv-pid="${esc(p.id)}" data-cv-item="${esc(item.id)}" value="${esc(item.question)}" placeholder="문항 (예: 지원 동기를 기술하시오)">
      <input type="number" min="0" step="100" data-cv="limit" data-cv-pid="${esc(p.id)}" data-cv-item="${esc(item.id)}" value="${item.limit || ""}" placeholder="글자 수" aria-label="글자 수 제한">
    </div>
    ${item.why ? `<p class="muted small">${esc(item.why)}</p>` : ""}
    <label class="field"><span>내 초안 — 직접 써도 되고, 막히면 아래 [🤖 초안 만들어 주기]로 뼈대를 받아 고쳐 써도 됩니다</span>
      <textarea data-cv="draft" data-cv-pid="${esc(p.id)}" data-cv-item="${esc(item.id)}" rows="10" placeholder="경험 하나를 골라 '상황 → 내가 한 일 → 결과(숫자)' 순으로 써 보세요.">${esc(item.draft)}</textarea></label>
    ${item.draftBy === "ai" ? `<p class="notice small">🤖 AI 가 만든 뼈대입니다. <strong>[ ] 안을 내 숫자·경험으로 채우고 내 말투로 바꾼 뒤</strong> 첨삭받으세요.${rsArr(item.blanks).length ? ` 채울 것: ${rsArr(item.blanks).map(esc).join(" · ")}` : ""}</p>`
      : item.draftBy === "library" ? `<p class="notice small">📚 지난 자소서를 가져왔습니다. 이 회사 이름·지원 동기를 꼭 고치세요.</p>` : ""}
    <div class="row wrap" style="justify-content:flex-end">
      <button class="btn btn-sm btn-ghost" data-act="cv-lib" data-id="${esc(p.id)}" data-item="${esc(item.id)}" type="button">📚 지난 자소서에서 가져오기</button>
      <button class="btn btn-sm btn-ghost" data-act="cv-keep" data-id="${esc(p.id)}" data-item="${esc(item.id)}" type="button">보관</button>
      <button class="btn" data-act="cv-draft" data-id="${esc(p.id)}" data-item="${esc(item.id)}" type="button" ${busy ? "disabled" : ""}>🤖 초안 만들어 주기</button>
      <button class="btn btn-primary" data-act="cv-review" data-id="${esc(p.id)}" data-item="${esc(item.id)}" type="button" ${busy ? "disabled" : ""}>${busy ? "작업 중…" : r ? "다시 첨삭받기" : "✍ 첨삭받기"}</button>
    </div>
    ${r ? cvReviewHTML(p, item, r) : ""}
  </section>`;
}

function cvReviewHTML(p, item, r) {
  const tone = r.total >= 85 ? "ok" : r.total >= 70 ? "accent" : "warn";
  return `
  <div class="cv-review">
    <div class="cv-score-row">
      <div class="score ${tone}"><strong>${r.total}</strong><span>${esc(r.grade)}</span></div>
      <div>
        <p><strong>${esc(r.summary || "")}</strong></p>
        <p class="muted small">첨삭 ${esc(r.at)} · ${r.len}자${r.limit ? ` / ${r.limit}자` : ""}</p>
      </div>
    </div>
    <table class="score-table">
      <thead><tr><th>기준</th><th class="num">배점</th><th class="num">점수</th><th>이유</th></tr></thead>
      <tbody>${r.parts.map((x) => `<tr><th>${esc(x.label)}<div class="muted small">${esc(x.how)}</div></th><td class="num">${x.max}</td><td class="num"><strong>${x.got}</strong></td>
        <td><div class="small">${esc(x.reason)}</div>${x.quote ? `<div class="req-quote small">“${esc(x.quote)}”</div>` : ""}</td></tr>`).join("")}</tbody>
      <tfoot><tr><th>합계</th><td class="num">100</td><td class="num"><strong>${r.total}</strong></td><td></td></tr></tfoot>
    </table>
    ${r.unsupported.length ? `<p class="notice warn small"><strong>이력서에 없는 내용 ${r.unsupported.length}건</strong> — 사실이면 ① 내 이력서에 먼저 넣고, 아니면 빼세요.<br>${r.unsupported.map((x) => `· ${esc(x)}`).join("<br>")}</p>` : ""}
    ${r.warnings.length ? `<ul class="plain small warn-text">${r.warnings.map((w) => `<li>${esc(w)}</li>`).join("")}</ul>` : ""}
    ${r.keep.length ? `<h4>👍 이건 그대로 두세요</h4><ul class="plain small">${r.keep.map((k) => `<li>${esc(k)}</li>`).join("")}</ul>` : ""}
    ${r.fixes.length ? `<h4>✏️ 이렇게 고쳐 보세요</h4>
      <div class="fixes">${r.fixes.map((f, i) => `
        <div class="fix">
          ${f.before ? `<p class="fix-before">${esc(f.before)}</p>` : ""}
          <p class="fix-after">${esc(f.after)}</p>
          ${f.why ? `<p class="muted small">${esc(f.why)}</p>` : ""}
          ${f.before ? `<button class="btn btn-sm" data-act="cv-apply-fix" data-id="${esc(p.id)}" data-item="${esc(item.id)}" data-i="${i}" type="button">이 문장 바꾸기</button>` : ""}
        </div>`).join("")}</div>` : ""}
    ${r.add.length ? `<h4>📌 이력서에서 가져오면 좋은 내용</h4><ul class="ev-list">${r.add.map((a) => `<li>${esc(a.text)} <span class="muted small">— ${esc(a.where)}</span>${a.how ? `<div class="small">→ ${esc(a.how)}</div>` : ""}</li>`).join("")}</ul>` : ""}
    ${r.nextStep ? `<p class="notice small">👉 다음에 할 일: ${esc(r.nextStep)}</p>` : ""}
  </div>`;
}
