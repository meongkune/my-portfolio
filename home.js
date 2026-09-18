/* ============================================================
   home.js — 현황 (첫 화면)
   ------------------------------------------------------------
   원래는 앱을 열면 곧바로 이력서 편집 폼이 나왔습니다. 폼은 '할 일'이지
   '현황'이 아니라서, 지금 무엇이 급한지 알 수 없었습니다.
   이 화면은 묻습니다 — 오늘 뭘 해야 하나?

   숫자는 전부 다른 파일의 함수에서 가져옵니다. 여기서 다시 계산하지
   않습니다. 두 곳에서 계산하면 반드시 어긋납니다.
   ============================================================ */

/* 사이드바에 붙는 작은 숫자. 0이면 아무것도 안 보여 줍니다 — 0을 보여
   주면 '아직 안 했다'는 잔소리가 되고, 잔소리는 곧 무시됩니다. */
function sideBadge(id) {
  if (id === "postings") { const n = S.postings.length; return n ? n : ""; }
  if (id === "calendar") { const n = hmUpcoming(7).length; return n ? n : ""; }
  return "";
}

/* 앞으로 n일 안에 있는 일정 */
function hmUpcoming(days) {
  const today = todayStr();
  const limit = new Date(`${today}T00:00:00`);
  limit.setDate(limit.getDate() + days);
  const limitStr = limit.toISOString().slice(0, 10);
  return calEvents().filter((e) => e.date >= today && e.date <= limitStr);
}

/* 다음에 할 일 — 위에서부터 하나씩 막힌 것을 찾습니다.
   여러 개를 한꺼번에 들이밀면 아무것도 안 하게 됩니다. 하나만 말합니다. */
function hmNextStep() {
  const comp = rsCompleteness();
  if (!S.me?.name) return { text: "이름·연락처부터 채우세요", to: "#/resume", why: "이력서와 자소서 전체가 여기서 시작합니다" };
  if (comp.score < 50) return { text: `이력서를 마저 채우세요 (${comp.score}%)`, to: "#/resume", why: "적합도 점수의 근거가 되는 내용입니다" };
  if (!S.postings.length) return { text: "관심 있는 채용공고를 넣어 보세요", to: "#/postings", why: "공고가 있어야 적합도·자소서·면접 준비가 돌아갑니다" };
  const near = hmUpcoming(3);
  if (near.length) return { text: `${near[0].name} ${near[0].type} — ${dday(near[0].date).text}`, to: "#/calendar", why: "가장 급한 일정입니다" };
  if (comp.score < 80) return { text: `이력서 완성도를 올리세요 (${comp.score}%)`, to: "#/resume", why: "성과에 숫자를 넣으면 크게 오릅니다" };
  return { text: "새 공고를 찾아보세요", to: "#/postings", why: "지금 급한 일은 없습니다" };
}

function renderHome() {
  const comp = rsCompleteness();
  const posts = S.postings;
  const soon = hmUpcoming(7);
  const next = hmNextStep();
  const withFit = posts.filter((p) => typeof p.fit === "number").sort((a, b) => b.fit - a.fit);

  return `
    <div class="view-head">
      <h2>현황</h2>
      <p class="muted">지금 어디까지 왔고 다음에 뭘 할지만 봅니다.</p>
    </div>

    <section class="card next-card">
      <span class="next-label">다음에 할 일</span>
      <a class="next-do" href="${next.to}">${esc(next.text)} →</a>
      <p class="muted small">${esc(next.why)}</p>
    </section>

    <div class="stat-row">
      <a class="stat" href="#/resume">
        <span class="stat-num">${comp.score}<em>%</em></span>
        <span class="stat-label">이력서 완성도</span>
      </a>
      <a class="stat" href="#/postings">
        <span class="stat-num">${posts.length}</span>
        <span class="stat-label">지원 중인 공고</span>
      </a>
      <a class="stat" href="#/calendar">
        <span class="stat-num ${soon.length ? "hot" : ""}">${soon.length}</span>
        <span class="stat-label">7일 안 일정</span>
      </a>
    </div>

    <div class="grid grid-2">
      <section class="card">
        <div class="card-head"><h3>가까운 일정</h3><a class="btn btn-sm btn-ghost" href="#/calendar">전체 보기</a></div>
        ${soon.length ? `<ul class="plain-list">${soon.slice(0, 6).map((e) => {
          const d = dday(e.date);
          return `<li><span class="dd ${d.kind}">${esc(d.text)}</span>
            <span class="ell">${esc(e.name)} · ${esc(e.type)}</span></li>`;
        }).join("")}</ul>` : `<p class="muted small">앞으로 7일 안에 잡힌 일정이 없습니다.</p>`}
      </section>

      <section class="card">
        <div class="card-head"><h3>적합도 높은 순</h3><a class="btn btn-sm btn-ghost" href="#/postings">전체 보기</a></div>
        ${withFit.length ? `<ul class="plain-list">${withFit.slice(0, 6).map((p) => `
          <li><span class="fit-num">${p.fit}</span>
            <span class="ell">${esc(p.company || p.title || "공고")}</span></li>`).join("")}</ul>`
        : `<p class="muted small">아직 적합도를 매긴 공고가 없습니다. 공고를 넣으면 이력서와 대조해 점수가 매겨집니다.</p>`}
      </section>
    </div>`;
}
