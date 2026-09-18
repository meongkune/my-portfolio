/* ============================================================
   github.js — 개발자 (GitHub 저장소에서 이력서 채우기)
   ------------------------------------------------------------
   개발자에게는 GitHub 이 진짜 이력서입니다. 그런데 이 앱은 PDF·워드에서만
   내용을 읽을 수 있었습니다. 가장 크게 비어 있던 자리입니다.

   ▶ 왜 토큰이 필요 없나
   공개 저장소 정보는 GitHub API 가 인증 없이 내주고 CORS 도 열려 있어,
   브라우저에서 바로 부를 수 있습니다. 목록·언어 비중·README 까지 복사
   붙여넣기 없이 가져옵니다. 토큰을 받으면 비공개 저장소도 되지만 토큰이
   브라우저에 남게 되므로 쓰지 않습니다.
   (인증 없이는 IP 당 시간당 60회 — 저장소 수십 개를 훑기에 충분합니다.)

   ▶ Claude 는 어디에만 쓰나
   "무엇을 만들었나"를 "어떤 문제를 어떻게 풀었나"로 바꾸는 일에만 씁니다.
   목록을 가져오는 데는 쓰지 않습니다 — 지어낼 여지를 만들 이유가 없습니다.

   ▶ 2차 검수
   가져온 초안은 곧바로 이력서에 들어가지 않습니다. 항목마다 고쳐 쓰고
   체크한 것만 반영합니다. ingest.js 의 「변경 미리보기」와 같은 원칙입니다.
   ============================================================ */

const GH_SCHEMA = "pf-github-v1";
const GH_API = "https://api.github.com";

let ghState = { repos: null, picked: new Set(), drafts: null, busy: "", error: "" };

function ghConf() {
  S.github = S.github || { user: "", importedAt: "" };
  return S.github;
}

async function ghFetch(path) {
  const r = await fetch(GH_API + path, { headers: { Accept: "application/vnd.github+json" } });
  if (r.status === 403) throw new Error("GitHub 호출 한도를 넘었습니다. 한 시간 뒤에 다시 시도하세요.");
  if (r.status === 404) throw new Error("찾을 수 없습니다. 사용자명을 확인하세요.");
  if (!r.ok) throw new Error("GitHub 응답 오류 (" + r.status + ")");
  return r.json();
}

/* ---------- 저장소 목록 ---------- */
async function ghLoadRepos() {
  const user = (ghConf().user || "").trim();
  if (!user) { toast("GitHub 사용자명을 먼저 넣으세요.", "warn"); return; }
  /* 이전 계정의 결과를 먼저 지웁니다. 남겨 두면 조회에 실패했을 때
     엉뚱한 계정의 저장소를 방금 친 계정 것으로 오해하게 됩니다. */
  ghState.busy = "repos"; ghState.error = ""; ghState.repos = null;
  ghState.picked = new Set(); ghState.drafts = null; render();
  try {
    const list = await ghFetch("/users/" + encodeURIComponent(user) + "/repos?per_page=100&sort=pushed");
    ghState.repos = list.map((r) => ({
      name: r.name, full: r.full_name, desc: r.description || "", lang: r.language || "",
      fork: !!r.fork, created: (r.created_at || "").slice(0, 7), pushed: (r.pushed_at || "").slice(0, 7),
    }));
    /* 포크는 기본에서 빼 둡니다 — 남의 코드라 내 이력이 되지 않습니다 */
    ghState.picked = new Set(ghState.repos.filter((r) => !r.fork).map((r) => r.name));
    ghState.drafts = null;
  } catch (e) {
    ghState.error = e.message;
  } finally {
    ghState.busy = ""; render();
  }
}

/* ---------- 저장소 속 읽기 ---------- */
async function ghReadOne(full) {
  const out = { languages: {}, readme: "" };
  try { out.languages = await ghFetch("/repos/" + full + "/languages"); } catch (e) { /* 언어 정보 없음 */ }
  try {
    /* README 는 base64 로 옵니다. 너무 길면 앞부분만 — 프롬프트가 터집니다. */
    const j = await ghFetch("/repos/" + full + "/readme");
    const bin = atob(String(j.content || "").replace(/\n/g, ""));
    const bytes = Uint8Array.from(bin, (c) => c.charCodeAt(0));
    out.readme = new TextDecoder("utf-8").decode(bytes).slice(0, 3000);
  } catch (e) { /* README 없음 */ }
  return out;
}

function ghLangPct(languages) {
  const total = Object.values(languages).reduce((a, b) => a + b, 0);
  if (!total) return [];
  return Object.entries(languages)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => ({ name: k, pct: Math.round((v / total) * 100) }))
    .filter((x) => x.pct >= 1);
}

function ghPrompt(repos) {
  const blocks = repos.map((r, i) => [
    "[" + (i + 1) + "] " + r.name,
    "- 설명: " + (r.desc || "(없음)"),
    "- 기간: " + r.created + " ~ " + r.pushed,
    "- 언어 비중: " + (r.langs.map((l) => l.name + " " + l.pct + "%").join(", ") || "(없음)"),
    "- README:",
    r.readme || "(없음)",
  ].join("\n")).join("\n---\n");

  const shape = {
    schema: GH_SCHEMA,
    projects: [{
      repo: "저장소 이름 그대로",
      title: "이력서에 쓸 프로젝트명 (한국어. 저장소 이름을 그대로 쓰지 말고 무엇인지 알 수 있게)",
      period: "2025.03 – 2025.06",
      org: "개인 프로젝트 / 팀 프로젝트 / 수업 과제 중 README 로 판단되는 것",
      role: "맡은 역할, 모르면 빈 문자열",
      skills: "쓴 기술·도구를 쉼표로",
      content: ["한 일과 성과를 한 줄씩. 문제 → 해결 → 결과 순서로. 3~5줄"],
      notes: "README 가 부실해 추측한 부분이나 직접 채워야 할 것",
    }],
    skillSummary: [{ category: "분야 (예: 백엔드, 프론트엔드, 데이터베이스)", items: "기술들을 쉼표로" }],
  };

  return `아래는 한 사람의 GitHub 공개 저장소 정보입니다. 이 사람은 개발 직무로 취업을 준비하고 있습니다.
저장소마다 이력서의 「프로젝트·경험」 항목 초안을 만들어 주세요.

개발자 이력서는 "무엇을 만들었나"가 아니라 "어떤 문제를 어떻게 풀었나"입니다.
README 에 적힌 내용만 근거로 삼고, 없는 성과나 숫자를 지어내지 마세요.
README 가 부실하면 content 를 짧게 두고 notes 에 무엇이 부족한지 적어 주세요.

${blocks}

아래 형식의 JSON 만 출력하세요. 설명이나 코드블록 표시는 붙이지 마세요.
${JSON.stringify(shape, null, 2)}`;
}

async function ghMakeDrafts() {
  const picked = (ghState.repos || []).filter((r) => ghState.picked.has(r.name));
  if (!picked.length) { toast("가져올 저장소를 하나 이상 고르세요.", "warn"); return; }
  if (picked.length > 8) { toast("한 번에 8개까지만 됩니다. 나눠서 가져오세요.", "warn"); return; }

  ghState.busy = "read"; ghState.error = ""; render();
  const enriched = [];
  try {
    for (const r of picked) {
      const extra = await ghReadOne(r.full);
      enriched.push(Object.assign({}, r, { langs: ghLangPct(extra.languages), readme: extra.readme }));
    }
  } catch (e) {
    ghState.error = e.message; ghState.busy = ""; render(); return;
  }

  ghState.busy = "draft"; render();
  try {
    const data = await clRun({ title: "GitHub 저장소 " + picked.length + "개 정리", prompt: ghPrompt(enriched), expect: GH_SCHEMA });
    if (!data) return;
    ghState.drafts = {
      projects: (data.projects || []).map((p) => Object.assign({}, p, { _pick: true })),
      skillSummary: (data.skillSummary || []).map((s) => Object.assign({}, s, { _pick: true })),
    };
    ghConf().importedAt = todayStr();
    save();
  } catch (e) {
    ghState.error = e.message;
  } finally {
    ghState.busy = ""; render();
  }
}

/* ---------- 검수한 것만 반영 ---------- */
function ghApply() {
  const d = ghState.drafts;
  if (!d) return;
  const projects = d.projects.filter((p) => p._pick);
  const skills = d.skillSummary.filter((s) => s._pick);
  if (!projects.length && !skills.length) { toast("반영할 항목을 고르세요.", "warn"); return; }

  let added = 0, skipped = 0;
  projects.forEach((p) => {
    const title = p.title || p.repo || "";
    /* 같은 이름이 이미 있으면 덮어쓰지 않습니다 — 손으로 고친 내용을 지우면 안 됩니다 */
    if (!title || S.resume.projects.some((x) => x.title === title)) { skipped += 1; return; }
    S.resume.projects.push({
      id: rsId(), period: p.period || "", title: title,
      org: p.org || "", role: p.role || "", skills: p.skills || "",
      content: (Array.isArray(p.content) ? p.content : toLines(p.content)).map(rsStr).filter(Boolean),
    });
    added += 1;
  });
  skills.forEach((s) => {
    if (!s.category || S.resume.skills.some((x) => x.category === s.category)) return;
    S.resume.skills.push({ id: rsId(), category: s.category, items: s.items || "" });
  });

  S.resume = rsNormalize(S.resume);
  save();
  ghState.drafts = null;
  toast("이력서에 반영했습니다 — 프로젝트 " + added + "건" + (skipped ? " (이미 있는 " + skipped + "건은 건너뜀)" : ""), "ok");
  location.hash = "#/resume";
}

/* ---------- 화면 ---------- */
function renderDev() {
  const conf = ghConf();
  const repos = ghState.repos;
  const d = ghState.drafts;

  return `
    <div class="view-head">
      <h2>개발자</h2>
      <p class="muted">GitHub 저장소를 읽어 이력서의 프로젝트·기술을 채웁니다. 반영 전에 직접 고칠 수 있습니다.</p>
    </div>

    ${ghState.error ? `<section class="card"><p class="err-text">${esc(ghState.error)}</p></section>` : ""}

    <section class="card">
      <div class="card-head"><h3>GitHub 계정</h3>
        ${conf.importedAt ? `<span class="chip">${esc(conf.importedAt)} 가져옴</span>` : ""}</div>
      <label class="field">
        <span>사용자명 — github.com/<b>여기</b></span>
        <input type="text" data-bind="github.user" value="${esc(conf.user)}" placeholder="예: octocat" />
      </label>
      <p class="muted small" style="margin:-6px 0 12px">
        공개 저장소만 읽습니다. 토큰이 필요 없고, 이 앱은 GitHub 에 아무것도 쓰지 않습니다.
      </p>
      <button class="btn btn-primary" type="button" data-act="gh-load" ${ghState.busy ? "disabled" : ""}>
        ${ghState.busy === "repos" ? "불러오는 중…" : "저장소 불러오기"}
      </button>
    </section>

    ${repos ? `
    <section class="card">
      <div class="card-head">
        <h3>저장소 ${repos.length}개</h3>
        <span class="muted small" id="gh-count">${ghState.picked.size}개 선택</span>
      </div>
      <p class="muted small" style="margin:-4px 0 12px">
        포크는 남의 코드라 기본에서 빼 두었습니다. 한 번에 8개까지 정리합니다.
      </p>
      <div class="gh-list">
        ${repos.map((r) => `
          <label class="gh-item${r.fork ? " gh-fork" : ""}">
            <input type="checkbox" data-gh-pick="${esc(r.name)}" ${ghState.picked.has(r.name) ? "checked" : ""} />
            <span class="gh-main">
              <strong>${esc(r.name)}</strong>
              ${r.fork ? `<span class="chip off">포크</span>` : ""}
              ${r.lang ? `<span class="chip">${esc(r.lang)}</span>` : ""}
              <span class="muted small gh-desc">${esc(r.desc || "설명 없음")}</span>
            </span>
            <span class="muted small gh-when">${esc(r.created)} ~ ${esc(r.pushed)}</span>
          </label>`).join("")}
      </div>
      <div class="row wrap" style="margin-top:14px">
        <button class="btn btn-primary" type="button" data-act="gh-draft" ${ghState.busy ? "disabled" : ""}>
          ${ghState.busy === "read" ? "저장소 읽는 중…" : ghState.busy === "draft" ? "정리하는 중…" : "고른 저장소로 초안 만들기"}
        </button>
      </div>
    </section>` : ""}

    ${d ? `
    <section class="card">
      <div class="card-head"><h3>초안 검수</h3>
        <span class="muted small">고치고 체크한 것만 반영됩니다</span></div>
      <p class="muted small" style="margin:-4px 0 14px">
        README 를 근거로 만든 초안입니다. 사실과 다른 곳은 여기서 고치세요.
        이력서에 같은 이름이 이미 있으면 건너뜁니다 — 손으로 고친 내용을 덮어쓰지 않습니다.
      </p>

      ${d.projects.map((p, i) => `
        <div class="gh-draft">
          <label class="check">
            <input type="checkbox" data-gh-dp="${i}" ${p._pick ? "checked" : ""} />
            <strong>${esc(p.title || p.repo || "이름 없음")}</strong>
          </label>
          <div class="gh-fields">
            <label class="field"><span>프로젝트명</span>
              <input type="text" data-gh-dpf="${i}.title" value="${esc(p.title || "")}" /></label>
            <label class="field"><span>기간</span>
              <input type="text" data-gh-dpf="${i}.period" value="${esc(p.period || "")}" /></label>
            <label class="field"><span>구분·소속</span>
              <input type="text" data-gh-dpf="${i}.org" value="${esc(p.org || "")}" /></label>
            <label class="field"><span>내 역할</span>
              <input type="text" data-gh-dpf="${i}.role" value="${esc(p.role || "")}" /></label>
          </div>
          <label class="field"><span>사용 기술·도구</span>
            <input type="text" data-gh-dpf="${i}.skills" value="${esc(p.skills || "")}" /></label>
          <label class="field"><span>한 일·성과 — 한 줄에 하나씩</span>
            <textarea rows="4" data-gh-dpf="${i}.content">${esc((Array.isArray(p.content) ? p.content : []).join("\n"))}</textarea></label>
          ${p.notes ? `<p class="notice warn small">⚠ ${esc(p.notes)}</p>` : ""}
        </div>`).join("")}

      ${d.skillSummary.length ? `
        <h4>보유 기술</h4>
        ${d.skillSummary.map((s, i) => `
          <label class="check">
            <input type="checkbox" data-gh-ds="${i}" ${s._pick ? "checked" : ""} />
            <span><strong>${esc(s.category || "")}</strong> — <span class="muted">${esc(s.items || "")}</span></span>
          </label>`).join("")}` : ""}

      <div class="row wrap" style="margin-top:16px">
        <button class="btn btn-primary" type="button" data-act="gh-apply">이력서에 반영</button>
        <button class="btn btn-ghost" type="button" data-act="gh-discard">버리기</button>
      </div>
    </section>` : ""}`;
}

function githubAction(act, btn) {
  if (act === "gh-load") { ghLoadRepos(); return true; }
  if (act === "gh-draft") { ghMakeDrafts(); return true; }
  if (act === "gh-apply") { ghApply(); return true; }
  if (act === "gh-discard") { ghState.drafts = null; render(); return true; }
  return false;
}

/* 체크박스·입력을 건드릴 때마다 화면을 다시 그리면 쓰던 글이 날아갑니다.
   여기서는 상태만 바꾸고 화면은 그대로 둡니다. */
function githubInput(t) {
  if (t.dataset.ghPick !== undefined) {
    if (t.checked) ghState.picked.add(t.dataset.ghPick); else ghState.picked.delete(t.dataset.ghPick);
    const n = document.querySelector("#gh-count");
    if (n) n.textContent = ghState.picked.size + "개 선택";
    return true;
  }
  if (!ghState.drafts) return false;
  if (t.dataset.ghDp !== undefined) { ghState.drafts.projects[Number(t.dataset.ghDp)]._pick = t.checked; return true; }
  if (t.dataset.ghDs !== undefined) { ghState.drafts.skillSummary[Number(t.dataset.ghDs)]._pick = t.checked; return true; }
  if (t.dataset.ghDpf !== undefined) {
    const parts = t.dataset.ghDpf.split(".");
    const p = ghState.drafts.projects[Number(parts[0])];
    if (p) p[parts[1]] = parts[1] === "content" ? toLines(t.value) : t.value;
    return true;
  }
  return false;
}
