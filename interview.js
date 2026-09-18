/* ============================================================
   interview.js — ④ 면접 준비 (공고별)
   ------------------------------------------------------------
   지원할 공고 하나를 고르면 Claude 가
   ① 회사 조사: 사람인 회사 정보 · 회사 홈페이지(사업·인재상) · 최근 기사  → 출처 링크와 날짜를 남김
   ② 질문 만들기: 회사 이해 · 직무 역량 · 경험 검증 · 인성/조직 적합
      모든 질문에 「출제 근거」(기사/홈페이지/공고 요구사항/내 이력서 줄)와 답변에 쓸 내 근거를 붙입니다.
   ③ 연습: 답변 작성 · 핵심 키워드 확인 · 무작위 1문항
   출처가 조사 목록에 없는 기사·홈페이지 근거는 「출처 확인 필요」로 표시합니다.
   ============================================================ */

const IV_SCHEMA = "pf-interview-v1";
const IV_CATS = ["회사 이해", "직무 역량", "경험 검증", "인성·조직 적합"];
let ivBusy = new Set();
let ivPick = null;     /* 무작위 연습 중인 질문 id */
let ivCat = "전체";
let ivTimer = null;

function ivPrompt(p, inputs, ev) {
  return `취업 준비생이 이 회사 면접을 준비합니다. 회사를 조사한 뒤, 바로 연습할 수 있는 예상 질문을 만들어 주세요.

[지원 공고] ${p.company} · ${p.title}
주요 업무:
${p.duties.map((d) => `- ${d}`).join("\n") || "-"}
요구사항:
${p.requirements.map((r) => `${r.rid} (${r.level}) ${r.label}${r.detail ? ` — ${r.detail}` : ""}`).join("\n") || "-"}
${p.fit ? `적합도 평가에서 부족했던 요구사항: ${p.fit.computed.reqs.filter((r) => r.status !== "충족").map((r) => `${r.rid} ${r.label}`).join(", ") || "없음"}` : ""}

[지원자 근거 목록 — 경험 질문과 답변 가이드는 이 id 만 인용]
${rsEvidenceText(ev) || "(이력서 비어 있음)"}

[내가 다른 회사 면접에서 실제로 받은 질문 — 비슷한 질문이 또 나올 수 있으니 참고]
${ivPastQuestions(p.id) || "(아직 기록한 면접 후기가 없음)"}

[추가 자료]
- 회사 홈페이지: ${inputs.homepage || p.companyInfo.homepage || "(모름 — 검색으로 찾기)"}
${inputs.refs ? `- 지원자가 준 참고 자료:\n${inputs.refs}` : ""}

[조사 순서]
1) ${clSaraminRule()} search_company_info 로 회사 규모·업종을 확인합니다.
2) 회사 홈페이지(회사 소개·사업·채용·인재상 페이지)를 열어 무엇을 파는 회사인지, 인재상이 무엇인지 확인합니다.
3) ${inputs.news ? `${clNaverRule()} 회사명으로 최근 12개월 뉴스를 찾아 3~5건을 실제로 열어 읽습니다. 제목·매체·날짜·주소를 기록하고, 각 기사가 면접에서 어떻게 쓸모 있는지 한 줄로 적습니다.` : "기사 검색은 하지 않습니다."}
4) 지원 직무와 관련된 업계 흐름 1~2가지를 정리합니다.

[쉬운 말로]
- 취업 준비생이 읽습니다. 업계 용어는 풀어서 쓰고, 한 문장을 짧게 씁니다.
- overview 는 "이 회사가 무엇으로 돈을 버는 회사인지" 한두 문장으로 씁니다.

[질문 만들기] 12~15개
- 회사 이해 3~4 (근거: 기사나 홈페이지, basis.url 필수) / 직무 역량 4 (근거: 공고 요구사항 rid) /
  경험 검증 4 (근거: 지원자 근거 목록 E번호, 부족한 요구사항을 파고드는 질문 1개 이상) / 인성·조직 적합 2~3 (근거: 인재상)
- 각 질문마다:
  difficulty: "기본"(거의 나오는 질문) 또는 "심화"(압박·꼬리질문성)
  intent: 면접관이 확인하려는 것 한 줄
  frame: 답변 뼈대 3~4단계. 각 단계는 "단계 이름: 무엇을 말할지" 형식의 짧은 문장 (예: "상황: 어떤 문제가 있었는지 한 문장")
  sample: 지원자 근거 목록만 써서 만든 40초 분량 답변 예시. 목록에 없는 경험·숫자는 절대 지어내지 말고, 채워 넣을 곳은 [여기에 내 수치]처럼 빈칸으로 둡니다.
  followups: 이 답변 뒤에 나올 법한 꼬리질문 2개
  evidence: 답변에 쓸 E번호 / keywords: 답변에 들어가야 할 단어 2~4개

[그 밖에]
- askThem: 면접 끝에 지원자가 물어보면 좋은 질문 3개 (회사 조사 내용에 근거한 것)
- checklist: 면접 전날·당일 준비 체크리스트 5~7개 (공고·회사 정보에 맞춰 구체적으로)

[꼭 지킬 것]
- 실제로 열어 확인한 기사·페이지만 sources 와 recent 에 넣습니다. 못 찾았으면 비우고 notes 에 적습니다. 주소를 지어내지 않습니다.
- 지원자 근거 목록에 없는 경험을 가정하지 않습니다.

[출력] 설명 없이 아래 JSON 만 출력하세요.
${JSON.stringify({
    schema: IV_SCHEMA,
    company: {
      overview: "", business: [""], values: [""], homepage: "",
      recent: [{ title: "", outlet: "", date: "YYYY-MM-DD", url: "", point: "면접에서 이렇게 쓴다" }],
      jobInsights: [""],
    },
    questions: [{
      category: IV_CATS.join("|"), question: "", difficulty: "기본|심화",
      basis: { type: "기사|홈페이지|공고|이력서|직무 일반", ref: "", url: "" },
      intent: "", frame: ["상황: ", "행동: ", "결과: ", "연결: "], sample: "", followups: ["", ""],
      evidence: ["E1"], keywords: [""],
    }],
    askThem: [""], checklist: [""], sources: [{ title: "", url: "" }], notes: [""],
  }, null, 1)}`;
}

async function ivGenerate(id) {
  const p = poGet(id);
  if (!p || ivBusy.has(id)) return;
  const box = document.querySelector(".iv-inputs");
  const inputs = {
    homepage: box?.querySelector("[name=homepage]")?.value.trim() || "",
    refs: box?.querySelector("[name=refs]")?.value.trim() || "",
    news: box ? box.querySelector("[name=news]").checked : true,
  };
  const answered = (p.interview?.questions || []).filter((q) => rsStr(q.answer)).length;
  if (answered && !confirm(`작성한 답변 ${answered}개가 있습니다. 질문을 새로 만들면 같은 질문의 답변은 이어지고, 나머지는 「이전 답변」으로 보관됩니다. 계속할까요?`)) return;
  const ev = rsEvidence();
  ivBusy.add(id); render();
  try {
    const data = await clRun({ title: `면접 준비 — ${p.company}`, prompt: ivPrompt(p, inputs, ev), saramin: true, naver: true, web: true, expect: IV_SCHEMA });
    const target = poGet(id);
    if (data && target) {
      const byId = new Map(ev.map((e) => [e.id, e]));
      const arr = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
      data.company = data.company && typeof data.company === "object" ? data.company : {};
      data.company.recent = arr(data.company.recent).map((r) => ({ ...r, url: poCleanUrl(r.url) }));
      data.company.homepage = poCleanUrl(data.company.homepage);
      data.sources = arr(data.sources).map((x) => ({ title: rsStr(x.title), url: poCleanUrl(x.url) })).filter((x) => x.url);
      const srcUrls = new Set([...data.sources.map((x) => x.url), ...data.company.recent.map((r) => r.url), data.company.homepage].filter(Boolean));
      const old = target.interview?.questions || [];
      const snap = {};
      const questions = arr(data.questions).filter((q) => rsStr(q.question)).map((q) => {
        const basis = q.basis && typeof q.basis === "object" ? q.basis : {};
        const evidence = rsArr(q.evidence).filter((x) => byId.has(x));
        evidence.forEach((x) => { snap[x] = { where: byId.get(x).where, text: byId.get(x).text }; });
        if (/^E\d+$/.test(rsStr(basis.ref)) && byId.has(basis.ref)) snap[basis.ref] = { where: byId.get(basis.ref).where, text: byId.get(basis.ref).text };
        const needsUrl = ["기사", "홈페이지"].includes(basis.type);
        const prev = old.find((o) => o.question === rsStr(q.question));
        return {
          id: uid("q"), category: IV_CATS.includes(q.category) ? q.category : "직무 역량", question: rsStr(q.question),
          basis: { type: rsStr(basis.type) || "직무 일반", ref: rsStr(basis.ref), url: poCleanUrl(basis.url) },
          unverified: needsUrl && !(poCleanUrl(basis.url) && srcUrls.has(poCleanUrl(basis.url))),
          intent: rsStr(q.intent), guide: rsStr(q.guide), evidence, keywords: rsArr(q.keywords),
          difficulty: q.difficulty === "심화" ? "심화" : "기본",
          frame: rsArr(q.frame), sample: rsStr(q.sample), followups: rsArr(q.followups),
          answer: prev ? prev.answer : "",
        };
      });
      const kept = old.filter((o) => rsStr(o.answer) && !questions.some((q) => q.question === o.question))
        .map((o) => ({ question: o.question, answer: o.answer, at: target.interview?.at || "" }));
      target.interview = {
        at: todayStr(), inputs, company: data.company, questions, snap,
        archive: [...kept, ...(target.interview?.archive || [])].slice(0, 60),
        sources: data.sources, notes: rsArr(data.notes),
        askThem: rsArr(data.askThem), checklist: rsArr(data.checklist),
        reqMap: Object.fromEntries(target.requirements.map((r) => [r.rid, r.label])),
      };
      save();
      toast(`🎤 ${target.company} 면접 질문 ${questions.length}개를 만들었습니다`, "ok", { label: "보기", run: () => { location.hash = `#/interview/${id}`; } });
    }
  } catch (e) {
    toast("❌ " + e.message, "warn");
  } finally {
    ivBusy.delete(id); renderSoft();
  }
}

/* ============================================================
   인적성·코딩테스트 준비 — 이 회사가 어떤 시험을 보는지 찾아 준비 방법을 정리합니다
   ============================================================ */
function ivExamPrompt(p) {
  return `이 회사 채용의 필기·온라인 전형(인적성검사, 직무적성검사, 코딩테스트, 실무과제 등)을 조사해 준비 방법을 알려 주세요.

[지원 공고] ${p.company} · ${p.title}
전형 절차: ${p.process.join(" → ") || "(공고에 없음)"}
주요 업무: ${p.duties.join(" / ") || "-"}
공고 원문에 적힌 내용:
${(p.rawText || "").slice(0, 1500) || "(없음)"}

[조사]
1) ${clNaverRule()} "${p.company} 인적성", "${p.company} 코딩테스트 후기", "${p.company} 필기전형" 등으로 찾습니다.
2) ${clSaraminRule()}
3) 실제 후기·공고에서 확인한 것만 씁니다. 못 찾으면 exists 를 "모름"으로 두고 notes 에 적습니다. 비슷한 규모·업종 회사의 일반적인 전형은 general 에만 적습니다.

[정리]
- exists: "있음" / "없음" / "모름"
- types: 시험 종류마다 { name(예: 인적성검사·SQL 코딩테스트), format(문항 수·시간·온라인 여부), topics(나오는 유형), source(확인한 곳) }
- plan: 준비 계획 4~6단계 (무엇을 · 며칠 정도 · 왜)
- practice: 무료로 연습할 수 있는 곳 (title, url) — 실제로 확인한 곳만
- tips: 후기에서 자주 나온 조언 3~5개
- 취업 준비생이 읽습니다. 쉬운 말로 짧게 씁니다.

[출력] 설명 없이 아래 JSON 만 출력하세요.
${JSON.stringify({
    schema: "pf-exam-v1", exists: "있음|없음|모름",
    types: [{ name: "", format: "", topics: [""], source: "" }],
    plan: [{ step: "", days: "", why: "" }], practice: [{ title: "", url: "" }], tips: [""],
    sources: [{ title: "", url: "" }], notes: [""],
  }, null, 1)}`;
}

async function ivExam(id) {
  const p = poGet(id);
  if (!p || ivBusy.has("exam" + id)) return;
  ivBusy.add("exam" + id); renderSoft();
  try {
    const data = await clRun({ title: `전형 준비 조사 — ${p.company}`, prompt: ivExamPrompt(p), saramin: true, naver: true, web: true, expect: "pf-exam-v1" });
    const t = poGet(id);
    if (data && t) {
      const arr = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === "object") : []);
      t.exam = {
        at: todayStr(), exists: rsStr(data.exists) || "모름",
        types: arr(data.types).map((x) => ({ name: rsStr(x.name), format: rsStr(x.format), topics: rsArr(x.topics), source: rsStr(x.source) })).filter((x) => x.name),
        plan: arr(data.plan).map((x) => ({ step: rsStr(x.step), days: rsStr(x.days), why: rsStr(x.why) })).filter((x) => x.step),
        practice: arr(data.practice).map((x) => ({ title: rsStr(x.title), url: poCleanUrl(x.url) })).filter((x) => x.url),
        tips: rsArr(data.tips), sources: arr(data.sources).map((x) => ({ title: rsStr(x.title), url: poCleanUrl(x.url) })).filter((x) => x.url),
        notes: rsArr(data.notes),
      };
      save();
      toast(`📝 ${t.company} 전형 준비 정보를 정리했습니다`, "ok");
    }
  } catch (e) {
    toast("❌ " + e.message, "warn");
  } finally {
    ivBusy.delete("exam" + id); renderSoft();
  }
}

function ivExamHTML(p) {
  const e = p.exam;
  const busy = ivBusy.has("exam" + p.id);
  return `
  <section class="card">
    <div class="card-head"><h3>📝 인적성·코딩테스트 준비</h3>
      <button class="btn btn-sm ${e ? "btn-ghost" : ""}" data-act="iv-exam" data-id="${esc(p.id)}" type="button" ${busy ? "disabled" : ""}>
        ${busy ? "찾아보는 중…" : e ? "다시 알아보기" : "이 회사 전형 알아보기"}</button></div>
    ${!e ? `<p class="muted small">이 회사가 인적성·코딩테스트를 보는지, 어떤 유형인지 후기와 공고에서 찾아 준비 계획을 만들어 줍니다.</p>`
    : `
      <p><span class="chip ${e.exists === "있음" ? "warn" : e.exists === "없음" ? "ok" : ""}">필기·온라인 전형 ${esc(e.exists)}</span> <span class="muted small">조사 ${esc(e.at)}</span></p>
      ${e.types.length ? `<h4>시험 종류</h4><ul class="plain">${e.types.map((t) => `<li><strong>${esc(t.name)}</strong>${t.format ? ` — ${esc(t.format)}` : ""}
        ${t.topics.length ? `<div class="muted small">나오는 유형: ${t.topics.map(esc).join(", ")}</div>` : ""}${t.source ? `<div class="muted small">확인: ${esc(t.source)}</div>` : ""}</li>`).join("")}</ul>` : ""}
      ${e.plan.length ? `<h4>준비 계획</h4><ol class="plain">${e.plan.map((x) => `<li><strong>${esc(x.step)}</strong>${x.days ? ` <span class="chip">${esc(x.days)}</span>` : ""}${x.why ? `<div class="muted small">${esc(x.why)}</div>` : ""}</li>`).join("")}</ol>` : ""}
      ${e.practice.length ? `<h4>연습할 수 있는 곳</h4><ul class="plain">${e.practice.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title || x.url)} ↗</a></li>`).join("")}</ul>` : ""}
      ${e.tips.length ? `<h4>후기에서 자주 나온 조언</h4><ul class="plain">${e.tips.map((t) => `<li>${esc(t)}</li>`).join("")}</ul>` : ""}
      ${e.notes.length ? `<p class="notice small">${e.notes.map(esc).join(" / ")}</p>` : ""}
      ${e.sources.length ? `<details class="sub-det"><summary>출처 ${e.sources.length}개</summary><ul class="plain small">${e.sources.map((x) => `<li><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.title || x.url)}</a></li>`).join("")}</ul></details>` : ""}`}
  </section>`;
}

/* ============================================================
   면접 후기 기록 — 실제로 받은 질문을 남겨 다음 회사 준비에 씁니다
   ============================================================ */
const IV_ROUNDS = ["1차(실무) 면접", "2차(임원) 면접", "인성 면접", "PT·과제 면접", "기타"];
const IV_FEEL = ["잘 봤다", "보통", "아쉽다"];

function ivDebriefHTML(p) {
  const list = p.debrief || [];
  return `
  <section class="card">
    <div class="card-head"><h3>🗒 면접 후기 기록</h3><span class="muted small">여기 적어 두면 다음 회사 예상 질문에 반영됩니다</span></div>
    ${list.map((d, i) => `
      <div class="item">
        <div class="card-head"><strong>${esc(d.round)} · ${esc(d.date)}</strong>
          <div class="row"><span class="chip ${d.feel === "잘 봤다" ? "ok" : d.feel === "아쉽다" ? "warn" : ""}">${esc(d.feel)}</span>
            <button class="btn btn-sm btn-ghost btn-danger" data-act="iv-db-del" data-id="${esc(p.id)}" data-db="${esc(d.id)}" type="button">삭제</button></div></div>
        ${d.questions.length ? `<p class="muted small">받은 질문</p><ul class="plain small">${d.questions.map((q) => `<li>${esc(q)}</li>`).join("")}</ul>` : ""}
        ${d.lesson ? `<p class="small">💡 ${esc(d.lesson)}</p>` : ""}
      </div>`).join("")}
    <div class="db-add stack">
      <div class="row wrap">
        <select name="round">${IV_ROUNDS.map((r) => `<option>${r}</option>`).join("")}</select>
        <input type="date" name="date" value="${todayStr()}">
        <select name="feel">${IV_FEEL.map((f) => `<option${f === "보통" ? " selected" : ""}>${f}</option>`).join("")}</select>
      </div>
      <textarea name="questions" rows="3" placeholder="실제로 받은 질문을 한 줄에 하나씩 적으세요"></textarea>
      <input type="text" name="lesson" placeholder="다음에 이렇게 하자 (한 줄)">
      <button class="btn btn-sm btn-primary" data-act="iv-db-add" data-id="${esc(p.id)}" type="button">후기 저장</button>
    </div>
  </section>`;
}

/* 지난 면접에서 실제로 받은 질문 — 새 질문을 만들 때 참고합니다 */
function ivPastQuestions(exceptId) {
  const out = [];
  S.postings.forEach((p) => {
    if (p.id === exceptId) return;
    (p.debrief || []).forEach((d) => d.questions.forEach((q) => out.push(`- (${p.company} ${d.round}) ${q}`)));
  });
  return out.slice(0, 25).join("\n");
}

function interviewAction(act, btn) {
  if (!String(act).startsWith("iv-")) return false;
  const id = btn.dataset.id;
  if (act === "iv-gen") ivGenerate(id);
  if (act === "iv-exam") ivExam(id);
  if (act === "iv-db-add") {
    const p = poGet(id);
    const box = btn.closest(".db-add");
    const questions = toLines(box.querySelector("[name=questions]").value);
    const date = box.querySelector("[name=date]").value || todayStr();
    if (!questions.length && !box.querySelector("[name=lesson]").value.trim()) { toast("받은 질문이나 메모를 적어 주세요.", "warn"); return true; }
    p.debrief = (p.debrief || []).concat({
      id: uid("db"), date, round: box.querySelector("[name=round]").value, feel: box.querySelector("[name=feel]").value,
      questions, lesson: box.querySelector("[name=lesson]").value.trim(),
    }).sort((a, b) => b.date.localeCompare(a.date));
    save(); render();
    toast("면접 후기를 저장했습니다 — 다음 회사 예상 질문에 반영됩니다", "ok");
  }
  if (act === "iv-db-del") {
    const p = poGet(id);
    p.debrief = (p.debrief || []).filter((d) => d.id !== btn.dataset.db);
    save(); render();
  }
  if (act === "iv-pick") {
    const iv = poGet(id)?.interview;
    const pool = (iv?.questions || []).filter((q) => ivCat === "전체" || q.category === ivCat);
    ivPick = pool.length ? pool[Math.floor(Math.random() * pool.length)].id : null;
    render();
    document.getElementById(`q-${ivPick}`)?.scrollIntoView({ block: "center" });
  }
  if (act === "iv-all") { ivPick = null; render(); }
  if (act === "iv-timer") {
    const el = document.getElementById(`timer-${btn.dataset.q}`);
    if (!el) return true;
    clearInterval(ivTimer);
    let left = 60;
    el.textContent = "60초 — 지금부터 말해 보세요";
    ivTimer = setInterval(() => {
      left--;
      el.textContent = left > 0 ? `${left}초 남음` : "끝! 말한 내용을 적어 보세요";
      if (left <= 0) clearInterval(ivTimer);
    }, 1000);
  }
  if (act === "iv-cat") { ivCat = btn.dataset.cat; ivPick = null; render(); }
  return true;
}

function ivSelect(t) {
  if (!t.dataset.ivSelect) return false;
  location.hash = t.value ? `#/interview/${t.value}` : "#/interview";
  return true;
}

function renderInterview(sub) {
  const candidates = S.postings.filter((p) => p.title && !PO_DONE.includes(p.stage))
    .sort((a, b) => (b.star - a.star) || (PO_ACTIVE.includes(b.stage) - PO_ACTIVE.includes(a.stage)));
  const p = sub ? poGet(sub) : null;
  const head = `
  <div class="view-head">
    <h2>⑤ 면접 준비</h2>
    <p class="muted">회사 <strong>뉴스·홈페이지</strong>를 찾아 읽고, <strong>공고 요구사항</strong>과 <strong>내 이력서</strong>에 맞춰 질문을 만듭니다. 질문마다 왜 나오는지, 어떻게 답할지, 이어질 꼬리질문까지 함께 보여 줍니다.</p>
  </div>
  <section class="card">
    <label class="field"><span>공고 선택</span>
      <select data-iv-select="1">
        <option value="">— 공고를 고르세요 —</option>
        ${candidates.map((c) => `<option value="${esc(c.id)}"${c.id === sub ? " selected" : ""}>${c.star ? "★ " : ""}${esc(c.company)} · ${esc(c.title)} (${esc(c.stage)})${c.interview ? " · 준비됨" : ""}</option>`).join("")}
      </select></label>
    ${candidates.length ? "" : `<p class="muted">분석된 공고가 없습니다. <a href="#/postings">② 채용공고에서 공고를 넣으세요 →</a></p>`}
  </section>`;
  if (!p) return head;

  const iv = p.interview;
  const busy = ivBusy.has(p.id);
  const inputs = `
  <section class="card iv-inputs">
    <div class="card-head"><h3>${esc(p.company)} · ${esc(p.title)}</h3><a class="btn btn-sm btn-ghost" href="#/postings/${esc(p.id)}">공고·적합도 보기</a></div>
    <div class="rs-fields">
      <label class="field span2"><span>회사 홈페이지 (모르면 비워 두세요 — 검색합니다)</span>
        <input type="url" name="homepage" value="${esc(iv?.inputs?.homepage || p.companyInfo.homepage || "")}" placeholder="https://"></label>
    </div>
    <label class="field"><span>참고할 기사·자료 링크나 메모 (선택 · 없으면 비워 두세요)</span>
      <textarea name="refs" rows="2" placeholder="https://news… 또는 '최근 해외 진출 발표'">${esc(iv?.inputs?.refs || "")}</textarea></label>
    <label class="check"><input type="checkbox" name="news" ${iv?.inputs?.news === false ? "" : "checked"}> 최근 1년 뉴스 검색해서 반영 (네이버 검색 사용)</label>
    <div class="row" style="justify-content:flex-end">
      <button class="btn btn-primary" data-act="iv-gen" data-id="${esc(p.id)}" type="button" ${busy ? "disabled" : ""}>${busy ? "회사 찾아보는 중…" : iv ? "다시 조사하고 질문 만들기" : "🎤 회사 조사하고 예상 질문 만들기"}</button>
    </div>
    ${busy ? `<p class="muted small"><i class="spin"></i> 뉴스와 홈페이지를 읽는 중입니다. 2~3분 걸릴 수 있고, 다른 화면으로 가도 계속됩니다.</p>` : ""}
  </section>`;
  if (!iv) return head + inputs + ivExamHTML(p) + ivDebriefHTML(p);

  const c = iv.company || {};
  const qs = iv.questions.filter((q) => ivCat === "전체" || q.category === ivCat);
  const list = ivPick ? qs.filter((q) => q.id === ivPick) : qs;
  const basisHTML = (q) => {
    const b = q.basis;
    let ref = b.ref;
    if (/^E\d+$/.test(ref) && iv.snap[ref]) ref = `${ref} ${iv.snap[ref].text}`;
    if (/^R\d+$/.test(ref) && iv.reqMap?.[ref]) ref = `${ref} ${iv.reqMap[ref]}`;
    return `<span class="chip ${q.unverified ? "warn" : ""}">근거 · ${esc(b.type)}</span> ${b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${esc(ref || b.url)} ↗</a>` : esc(ref)}${q.unverified ? ` <span class="warn-text small">출처 확인 필요</span>` : ""}`;
  };

  return head + inputs + `
  <div class="grid grid-2">
    <section class="card">
      <h3>🏢 회사 브리프 <span class="muted small">조사 ${esc(iv.at)}</span></h3>
      ${c.overview ? `<p>${esc(c.overview)}</p>` : ""}
      ${rsArr(c.business).length ? `<h4>사업·서비스</h4><ul class="plain">${rsArr(c.business).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${rsArr(c.values).length ? `<h4>인재상·핵심가치</h4><div class="chips">${rsArr(c.values).map((x) => `<span class="chip accent">${esc(x)}</span>`).join("")}</div>` : ""}
      ${rsArr(c.jobInsights).length ? `<h4>이 직무·업계 흐름</h4><ul class="plain">${rsArr(c.jobInsights).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${rsArr(iv.askThem).length ? `<h4>🙋 내가 물어보면 좋은 질문</h4><ul class="plain">${rsArr(iv.askThem).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
      ${rsArr(iv.checklist).length ? `<h4>✅ 면접 전 준비물·체크</h4><ul class="plain">${rsArr(iv.checklist).map((x) => `<li>${esc(x)}</li>`).join("")}</ul>` : ""}
    </section>
    <section class="card">
      <h3>📰 최근 기사</h3>
      ${(c.recent || []).filter((r) => r.title).length ? `<ul class="news">${c.recent.filter((r) => r.title).map((r) => `
        <li>${r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer"><strong>${esc(r.title)}</strong> ↗</a>` : `<strong>${esc(r.title)}</strong>`}
          <div class="muted small">${[r.outlet, r.date].filter(Boolean).map(esc).join(" · ")}</div>
          ${r.point ? `<p class="small">→ ${esc(r.point)}</p>` : ""}</li>`).join("")}</ul>` : `<p class="muted">찾은 기사가 없습니다.</p>`}
      ${iv.notes.length ? `<p class="notice small">${iv.notes.map(esc).join(" / ")}</p>` : ""}
      ${iv.sources.length ? `<details class="sub-det"><summary>조사 출처 ${iv.sources.length}개</summary><ul class="plain small">${iv.sources.map((s) => `<li><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.title || s.url)}</a></li>`).join("")}</ul></details>` : ""}
    </section>
  </div>

  <section class="card">
    <div class="card-head">
      <h3>예상 질문 ${iv.questions.length}개</h3>
      <div class="row wrap">
        <button class="btn btn-sm btn-primary" data-act="iv-pick" data-id="${esc(p.id)}" type="button">🎲 무작위 1문항</button>
        ${ivPick ? `<button class="btn btn-sm" data-act="iv-all" type="button">전체 보기</button>` : ""}
      </div>
    </div>
    <div class="chips">${["전체", ...IV_CATS].map((k) => `<button class="chip ${ivCat === k ? "accent" : ""}" data-act="iv-cat" data-cat="${esc(k)}" type="button">${esc(k)} ${k === "전체" ? iv.questions.length : iv.questions.filter((q) => q.category === k).length}</button>`).join("")}</div>
    ${ivPick ? `<p class="notice small" style="margin-top:10px">실제 면접처럼 먼저 소리 내어 1분 동안 답해 본 뒤 적어 보세요.</p>` : ""}
  </section>

  ${(iv.archive || []).length ? `<details class="card sub-det"><summary>이전 질문의 답변 ${iv.archive.length}개 (새로 만들기 전에 쓴 답변)</summary>
    ${iv.archive.map((a) => `<div class="req" style="margin-top:8px"><strong class="small">${esc(a.question)}</strong><p class="small" style="white-space:pre-line">${esc(a.answer)}</p></div>`).join("")}</details>` : ""}

  ${list.map((q) => {
    const idx = iv.questions.indexOf(q);
    const hits = q.keywords.filter((k) => String(q.answer || "").toLowerCase().includes(k.toLowerCase()));
    return `
    <section class="card iv-q" id="q-${esc(q.id)}">
      <div class="iv-q-head"><span class="chip ${q.difficulty === "심화" ? "warn" : ""}">${esc(q.category)}${q.difficulty === "심화" ? " · 심화" : ""}</span><h3>${esc(q.question)}</h3></div>
      <p class="small basis">${basisHTML(q)}</p>
      ${q.intent ? `<p class="small muted">면접관이 보려는 것: ${esc(q.intent)}</p>` : ""}
      ${rsArr(q.frame).length ? `<div class="frame">${rsArr(q.frame).map((f, n) => `<div class="frame-step"><span>${n + 1}</span>${esc(f)}</div>`).join("")}</div>` : ""}
      <details class="sub-det"><summary>답변 예시 보기${q.evidence.length ? ` · 내 경험 ${q.evidence.length}개 활용` : ""}</summary>
        ${q.sample ? `<p class="sample">${esc(q.sample)}</p><p class="muted small">그대로 외우지 말고 내 말로 바꾸세요. [ ] 안은 내 숫자·이름으로 채웁니다.</p>` : ""}
        ${q.guide ? `<p class="small"><strong>답변 구성</strong> ${esc(q.guide)}</p>` : ""}
        ${q.evidence.length ? `<ul class="ev-list">${q.evidence.map((x) => iv.snap[x] ? `<li><span class="ev-id">${esc(x)}</span> ${esc(iv.snap[x].text)} <span class="muted small">— ${esc(iv.snap[x].where)}</span></li>` : "").join("")}</ul>` : ""}
        ${rsArr(q.followups).length ? `<p class="small" style="margin-top:6px"><strong>이어서 나올 질문</strong></p><ul class="plain small">${rsArr(q.followups).map((f) => `<li>${esc(f)}</li>`).join("")}</ul>` : ""}
      </details>
      <div class="row" style="margin-top:8px"><button class="btn btn-sm" data-act="iv-timer" data-q="${esc(q.id)}" type="button">⏱ 1분 연습</button>
        <span class="muted small" id="timer-${esc(q.id)}"></span></div>
      <label class="field" style="margin-top:8px"><span>내 답변 — 먼저 소리 내어 말해 본 뒤 적어 보세요</span>
        <textarea data-bind="postings.${S.postings.indexOf(p)}.interview.questions.${idx}.answer" data-type="answer" rows="4" placeholder="상황 → 한 일 → 결과(숫자) 순서로">${esc(q.answer)}</textarea></label>
      <div class="chips kw-chips" data-kw="${esc(q.keywords.join("|"))}">
        <span class="muted small">키워드 ${hits.length}/${q.keywords.length}</span>
        ${q.keywords.map((k) => `<span class="chip ${hits.includes(k) ? "ok" : "off"}">${hits.includes(k) ? "✓" : "○"} ${esc(k)}</span>`).join("")}
      </div>
    </section>`;
  }).join("") + ivExamHTML(p) + ivDebriefHTML(p)}`;
}

/* 답변 입력 중 키워드 칩만 갱신 */
function ivRefreshKeywords(textarea) {
  const box = textarea.closest(".iv-q")?.querySelector(".kw-chips");
  if (!box) return;
  const kws = box.dataset.kw ? box.dataset.kw.split("|") : [];
  const v = textarea.value.toLowerCase();
  const hits = kws.filter((k) => v.includes(k.toLowerCase()));
  box.innerHTML = `<span class="muted small">키워드 ${hits.length}/${kws.length}</span>` +
    kws.map((k) => `<span class="chip ${hits.includes(k) ? "ok" : "off"}">${hits.includes(k) ? "✓" : "○"} ${esc(k)}</span>`).join("");
}
