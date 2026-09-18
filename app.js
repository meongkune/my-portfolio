/* ============================================================
   app.js — 코어 (상태 · 저장 · 화면 전환 · 이벤트 · 백업)
   ------------------------------------------------------------
   흐름: ① 내 이력서 → ② 채용공고·적합도 → ③ 자소서 → ④ 일정 → ⑤ 면접 준비
   - 상태는 S 하나. 바뀌면 브라우저(localStorage)에 자동 저장하고,
     로컬 자동 모드면 data/state.json 에도 저장합니다.
   ============================================================ */

/* ---------- 작은 도구 ---------- */
const $ = (sel, root = document) => root.querySelector(sel);
const uid = (p) => p + Math.random().toString(36).slice(2, 8);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const toLines = (v) => String(v || "").split("\n").map((s) => s.trim()).filter(Boolean);
const deep = (o) => JSON.parse(JSON.stringify(o));

function setPath(obj, path, value) {
  const keys = path.split(".");
  const last = keys.pop();
  const target = keys.reduce((o, k) => (o[k] = o[k] ?? {}), obj);
  target[last] = value;
}

function todayStr() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

function dday(dateStr) {
  if (!dateStr) return { text: "-", kind: "" };
  const diff = Math.round((new Date(`${dateStr}T00:00:00`) - new Date(`${todayStr()}T00:00:00`)) / 86400000);
  if (Number.isNaN(diff)) return { text: "-", kind: "" };
  if (diff === 0) return { text: "오늘", kind: "warn" };
  if (diff < 0) return { text: `${-diff}일 지남`, kind: "off" };
  return { text: `D-${diff}`, kind: diff <= 3 ? "warn" : "" };
}

function badge(text, kind) {
  const el = $("#save-state");
  if (!el) return;
  el.textContent = text;
  el.className = "pill" + (kind ? " " + kind : "");
}

/* 클립보드에 넣기 — 실제로 성공했을 때만 true 를 돌려줍니다.
   ① 사용자가 버튼을 누른 그 순간에 되는 방식(execCommand) 먼저
   ② 안 되면 최신 방식(Clipboard API)
   둘 다 막히면 false → 부르는 쪽에서 "직접 복사하세요" 안내를 띄웁니다. */
function copyTextSync(text) {
  const prev = document.activeElement;
  const ta = document.createElement("textarea");
  ta.value = text;
  ta.setAttribute("readonly", "");
  ta.style.cssText = "position:fixed;top:0;left:0;width:1px;height:1px;opacity:0;font-size:16px";
  (document.querySelector("dialog[open]") || document.body).appendChild(ta);
  let ok = false;
  try {
    ta.select();
    ta.setSelectionRange(0, text.length);
    ok = document.execCommand("copy");
  } catch (e) { ok = false; }
  ta.remove();
  if (prev && prev.focus) prev.focus({ preventScroll: true });
  return ok;
}

async function copyText(text) {
  if (copyTextSync(text)) return true;
  try { await navigator.clipboard.writeText(text); return true; } catch (e) { return false; }
}

/* ---------- 상태 · 저장 ---------- */
const STORE_KEY = "my-job-portfolio-v2";
const OLD_KEYS = ["my-job-portfolio-v1", "induk-aidx-portfolio-v1"];
let S = load();

function load() {
  let s = null;
  try {
    const raw = localStorage.getItem(STORE_KEY) || OLD_KEYS.map((k) => localStorage.getItem(k)).find(Boolean);
    s = raw ? JSON.parse(raw) : null;
  } catch (e) { s = null; }
  return normalizeState(s || deep(SEED_DATA));
}

/* 저장본 → 현재 구조. 예전 버전(타겟 JD·역량 매칭·지원 목록)도 옮겨 옵니다. */
function normalizeState(s) {
  s = s && typeof s === "object" ? s : deep(SEED_DATA);
  s.meta = Object.assign({ version: "2" }, s.meta || {});
  s.resume = rsNormalize(s.resume || {});
  rsMergeStd(s.resume);

  /* 예전 「내 경험」 → 이력서 프로젝트·경험 */
  if (Array.isArray(s.experiences) && s.experiences.length) {
    s.experiences.filter((e) => e && e.title && !String(e.source || "").startsWith("resume-career:")).forEach((e) => {
      if (s.resume.projects.some((p) => p.title === e.title)) return;
      s.resume.projects.push({
        id: rsId(), period: e.period || "", title: e.title, org: [e.type, e.org].filter(Boolean).join(" · "), role: "", skills: "",
        content: [e.summary, ...(e.actions || []), ...(e.results || [])].map(rsStr).filter(Boolean),
      });
    });
    s.resume = rsNormalize(s.resume);
  }
  s.postings = poNormalize(s.postings);
  /* 자소서 작성 원칙 — 한 번 조사해 두면 계속 씁니다 */
  const w = s.writingRules;
  s.writingRules = w && Array.isArray(w.items) ? w : null;
  /* 지난 자소서 보관함 */
  s.coverLibrary = (Array.isArray(s.coverLibrary) ? s.coverLibrary : []).filter((x) => x && x.text && x.question)
    .map((x) => ({ id: x.id || uid("lib"), at: rsStr(x.at), company: rsStr(x.company), position: rsStr(x.position), question: rsStr(x.question), text: String(x.text), score: Number(x.score) || 0 }));
  /* 예전 「지원 목록」 → 공고 */
  if (Array.isArray(s.applications)) {
    const stageMap = { 관심: "검토 중", 서류: "지원 완료", 인적성: "서류 합격", "1차 면접": "면접 진행", "임원 면접": "면접 진행", "결과 대기": "면접 진행", 종료: "보류" };
    s.applications.filter((a) => a && a.company).forEach((a) => {
      if (s.postings.some((p) => p.company === a.company && p.title === a.position)) return;
      s.postings.push(...poNormalize([{ source: "manual", status: "pending", company: a.company, title: a.position, deadline: a.deadline, memo: a.memo, stage: stageMap[a.stage] || "검토 중" }]));
    });
  }
  ["experiences", "applications", "jd", "interview", "jobSearch", "scratch", "portfolio"].forEach((k) => delete s[k]);
  meNormalize(s);
  return s;
}

let saveTimer = null;
let serverTimer = null;
function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    S.meta.updatedAt = new Date().toISOString();
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(S));
      badge("저장됨 " + new Date().toLocaleTimeString("ko-KR", { hour: "2-digit", minute: "2-digit" }), "ok");
    } catch (e) {
      badge(CL.mode === "local" ? "파일에 저장 중" : "브라우저 저장 실패 — [백업]을 받아 두세요", "warn");
    }
    if (CL.mode === "local") {
      clearTimeout(serverTimer);
      serverTimer = setTimeout(() => {
        fetch("/api/state", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ state: S }) }).catch(() => {});
      }, 800);
    }
  }, 300);
}

/* 로컬 모드: 파일 저장본이 더 최신이면 그것을 씁니다 (브라우저 기록을 지운 경우 등) */
async function syncFromServer() {
  if (CL.mode !== "local") return;
  try {
    const j = await (await fetch("/api/state", { cache: "no-store" })).json();
    const remote = j.state;
    if (remote && String(remote.meta?.updatedAt || "") > String(S.meta?.updatedAt || "")) {
      S = normalizeState(remote);
      render();
      badge("저장 파일에서 불러옴", "ok");
    } else if (!remote) {
      save();
    }
  } catch (e) { /* 무시 */ }
}

/* ---------- 화면 전환 ---------- */
/* 메뉴는 번호가 아니라 '하는 일'로 나눕니다. 번호는 순서를 강요하는데,
   실제로는 공고를 보다가 이력서를 고치고 다시 공고로 돌아가기 때문입니다.
   group 은 사이드바에서 구분선을 넣을 자리를 정합니다. */
const MENUS = [
  { id: "home", label: "현황", icon: "◆", group: "", render: renderHome },
  { id: "resume", label: "이력서", icon: "▤", group: "준비", render: renderResume },
  { id: "postings", label: "채용공고", icon: "▶", group: "지원", render: renderPostings },
  { id: "commute", label: "통근", icon: "⇄", group: "", render: renderCommute },
  { id: "cover", label: "자소서", icon: "✎", group: "", render: renderCover },
  { id: "calendar", label: "일정", icon: "▦", group: "", render: renderCalendar },
  { id: "interview", label: "면접 준비", icon: "◇", group: "", render: renderInterview },
];

function currentRoute() {
  const [id, sub] = (location.hash || "").replace(/^#\//, "").split("/");
  return MENUS.some((m) => m.id === id) ? { id, sub: sub ? decodeURIComponent(sub) : "" } : { id: "home", sub: "" };
}

/* 백그라운드 작업이 끝났을 때 쓰는 다시 그리기.
   입력 칸에 글을 쓰는 중이면(한글 조합 포함) 화면을 갈아엎지 않고, 칸에서 벗어난 뒤 그립니다. */
let renderPending = false;
let pointerDown = false;
const isTyping = () => {
  const a = document.activeElement;
  return !!a && $("#view").contains(a) && (a.tagName === "TEXTAREA" || (a.tagName === "INPUT" && !["checkbox", "radio", "button"].includes(a.type)));
};
function renderSoft() {
  if (isTyping()) {
    renderPending = true;
    renderChrome();
    return;
  }
  render();
}
function flushPending() {
  if (!renderPending || isTyping() || pointerDown) return;
  renderPending = false;
  render();
}
document.addEventListener("pointerdown", () => { pointerDown = true; }, true);
document.addEventListener("pointerup", () => { pointerDown = false; setTimeout(flushPending, 50); }, true);
document.addEventListener("focusout", () => setTimeout(flushPending, 50));
setInterval(flushPending, 700);   /* 창이 포커스를 잃은 상태 등 focusout 이 오지 않는 경우 대비 */

function renderChrome(id = currentRoute().id) {
  $("#tabs").innerHTML = MENUS.map((m) => {
    const busy = m.id === "postings" && S.postings.some((p) => p.status === "analyzing");
    return `${m.group ? `<span class="side-group">${esc(m.group)}</span>` : ""}
      <a class="side-item" href="#/${m.id}" ${m.id === id ? 'aria-current="page"' : ""}>
        <span class="side-icon" aria-hidden="true">${m.icon}</span>
        <span class="side-label">${esc(m.label)}</span>
        ${busy ? '<i class="spin"></i>' : `<span class="side-badge">${sideBadge(m.id)}</span>`}
      </a>`;
  }).join("");
  renderMeBar();
  clRenderStatus();
}

let renderedKey = null;
function render() {
  renderPending = false;
  const { id, sub } = currentRoute();
  const menu = MENUS.find((m) => m.id === id);
  let html;
  try {
    html = menu.render(sub);
  } catch (e) {
    console.error(e);
    html = `<section class="card"><h3>⚠ 화면 오류</h3><pre class="raw">${esc(e.stack || e)}</pre></section>`;
  }
  /* 입력 중이던 칸의 포커스·커서를 지킵니다 */
  const active = document.activeElement;
  const focusKey = active && (active.dataset.bind || active.dataset.po || active.dataset.poSearch);
  const caret = focusKey && typeof active.selectionStart === "number" ? [active.selectionStart, active.selectionEnd] : null;

  $("#view").innerHTML = html;
  renderChrome(id);

  if (focusKey) {
    const el = document.querySelector(`[data-bind="${CSS.escape(focusKey)}"], [data-po="${CSS.escape(focusKey)}"], [data-po-search="${CSS.escape(focusKey)}"]`);
    if (el) { el.focus({ preventScroll: true }); if (caret) try { el.setSelectionRange(caret[0], caret[1]); } catch (e) { /* date 등 */ } }
  }
  const key = id + "/" + sub;
  if (key !== renderedKey) { window.scrollTo({ top: 0 }); renderedKey = key; }
}

/* ---------- 이벤트 ---------- */
function onInput(ev) {
  const t = ev.target;
  if (postingsInput(t) || ivSelect(t) || rsLayoutPick(t) || coverInput(t)) return;
  const path = t.dataset.bind;
  if (!path) return;
  let value = t.value;
  if (t.dataset.type === "lines") value = toLines(value);
  setPath(S, path, value);
  save();
  if (t.dataset.type === "answer") ivRefreshKeywords(t);
  refreshResumePreview();   /* 미리보기·완성도만 다시 그립니다 (입력 칸은 건드리지 않음) */
}
$("#view").addEventListener("input", (ev) => { if (ev.target.tagName !== "SELECT") onInput(ev); });
$("#view").addEventListener("change", (ev) => {
  if (ev.target.tagName === "SELECT" || ev.target.type === "date" || ev.target.type === "time") onInput(ev);
});

document.addEventListener("click", (ev) => {
  const btn = ev.target.closest("[data-act]");
  if (!btn) return;
  const act = btn.dataset.act;
  if (act === "me-edit") return meDialog();
  if (act === "setup") return clSetupDialog();
  if (resumeAction(act, btn) || postingsAction(act, btn) || coverAction(act, btn) || calendarAction(act, btn) || interviewAction(act, btn) || commuteAction(act, btn)) ev.preventDefault();
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Enter" && !ev.isComposing && ev.target.dataset?.po === "url") { ev.preventDefault(); postingsAction("po-add-link", ev.target); }
});

/* 스크린샷: ⌘V 붙여넣기 · 끌어놓기 (② 채용공고 화면) */
document.addEventListener("paste", (ev) => {
  if (currentRoute().id !== "postings" || currentRoute().sub) return;
  const files = [...(ev.clipboardData?.items || [])].filter((i) => i.kind === "file").map((i) => i.getAsFile()).filter(Boolean);
  if (files.length && poAcceptImages(files)) { ev.preventDefault(); toast(`🖼 스크린샷 ${files.length}장을 넣었습니다`, "ok"); }
});
const hasFiles = (ev) => [...(ev.dataTransfer?.types || [])].includes("Files");
document.addEventListener("dragover", (ev) => { if (currentRoute().id === "postings" && !currentRoute().sub && hasFiles(ev)) { ev.preventDefault(); document.body.classList.add("dragging"); } });
document.addEventListener("dragleave", (ev) => { if (!ev.relatedTarget) document.body.classList.remove("dragging"); });
document.addEventListener("drop", (ev) => {
  document.body.classList.remove("dragging");
  if (currentRoute().id !== "postings" || currentRoute().sub || !hasFiles(ev)) return;   /* 글자 끌어놓기는 그대로 둡니다 */
  ev.preventDefault();
  if (!poAcceptImages(ev.dataTransfer.files)) toast("이미지 파일만 넣을 수 있습니다. PDF 공고는 본문을 복사해 [직접 입력]으로 넣으세요.", "warn");
});

window.addEventListener("hashchange", render);
/* 다른 탭에서 저장하면 이 탭도 최신으로 (서로 덮어쓰지 않게) */
window.addEventListener("storage", (ev) => {
  if (ev.key !== STORE_KEY || !ev.newValue) return;
  try { S = normalizeState(JSON.parse(ev.newValue)); renderSoft(); badge("다른 탭의 변경을 반영함", "ok"); } catch (e) { /* 무시 */ }
});
window.addEventListener("beforeunload", (ev) => {
  if (CL.jobs.size) { ev.preventDefault(); ev.returnValue = ""; }   /* 분석 중에 창을 닫으면 결과를 잃습니다 */
});

/* ---------- 백업 · 복원 · 초기화 ---------- */
$("#btn-theme").addEventListener("click", () => {
  const next = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  document.documentElement.dataset.theme = next;
  try { localStorage.setItem("pf-theme", next); } catch (e) { /* 사생활 보호 모드 등 — 이번 세션만 적용됩니다 */ }
});

$("#btn-export").addEventListener("click", () => {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([JSON.stringify(S, null, 2)], { type: "application/json;charset=utf-8" }));
  a.download = `취업포트폴리오_백업_${todayStr()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  toast("백업 파일을 받았습니다", "ok");
});

$("#file-import").addEventListener("change", async (ev) => {
  const file = ev.target.files?.[0];
  ev.target.value = "";
  if (!file) return;
  try {
    const next = normalizeState(clParseJson(await file.text()));
    const prev = S;
    S = next; save(); render();
    toast("백업을 불러왔습니다", "ok", { label: "되돌리기", run: () => { S = prev; save(); render(); } });
  } catch (e) {
    toast("불러오기 실패 — [백업]으로 받은 파일만 불러올 수 있습니다", "warn");
  }
});

$("#btn-clear").addEventListener("click", () => {
  if (!confirm("내 정보·이력서·공고·일정·면접 준비를 모두 지웁니다.\n먼저 [백업]을 받아 두는 것을 권합니다. 계속할까요?")) return;
  const prev = S;
  S = normalizeState(deep(SEED_DATA));
  save(); location.hash = "#/resume"; render();
  toast("모두 지웠습니다", "", { label: "되돌리기", run: () => { S = prev; save(); render(); } });
});

/* ---------- 시작 ---------- */
document.addEventListener("DOMContentLoaded", async () => {
  render();
  await clDetect();
  await syncFromServer();
  render();
  if (CL.mode === "local") {
    if (!CL.auth?.loggedIn) {
      toast("자동 실행을 쓰려면 Claude 구독 로그인이 한 번 필요합니다", "warn", { label: "연결 설정", run: () => clSetupDialog() });
    }
    clRefreshStatus(true);
  }
});
