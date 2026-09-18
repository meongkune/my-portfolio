/* ============================================================
   claude.js — Claude 실행 통로 (구독 전용, API 키 없음)
   ------------------------------------------------------------
   ① 로컬 자동  : start.command 로 띄웠을 때. Claude Code(구독 로그인)가 뒤에서 실행 → 결과 자동 반영.
                 작업은 기다리지 않습니다. 목록에 "분석 중"으로 뜨고 다른 일을 계속할 수 있습니다.
   ② claude.ai  : 정적 주소로 열었거나, 로컬 로그인 전에 직접 고른 경우. 복사 → 붙여넣기.

   로그인·사람인 연결은 앱을 열 때 확인하고, 필요하면 [연결 설정] 창에서 바로 처리합니다.
   ============================================================ */

const CL = {
  mode: "bridge",          /* local | bridge */
  ready: false,
  auth: null,              /* { loggedIn, method, email } */
  mcp: null,               /* { found, authed } */
  mcpName: "playmcp",
  jobs: new Map(),         /* id → { title, startedAt } */
};

async function clDetect() {
  if (/^https?:$/.test(location.protocol)) {
    try {
      const r = await fetch("/api/health", { cache: "no-store" });
      const j = r.ok ? await r.json() : null;
      if (j && j.ok) { CL.noCli = !j.claude; if (j.claude) { CL.mode = "local"; CL.mcpName = j.mcpName || CL.mcpName; } }
    } catch (e) { /* 정적 호스팅 */ }
  }
  CL.ready = true;
  if (CL.mode === "local") await clRefreshStatus(false);
  return CL;
}

async function clRefreshStatus(mcp = true, force = false) {
  if (CL.mode !== "local") return;
  try {
    const r = await fetch(`/api/status${mcp ? `?mcp=${force ? "force" : "1"}` : ""}`, { cache: "no-store" });
    const j = await r.json();
    CL.auth = j.auth;
    if (j.mcp) CL.mcp = j.mcp;
  } catch (e) { /* 서버 꺼짐 */ }
  clRenderStatus();
}

let clSetupShared = null;
let clBridgeChain = Promise.resolve();
const clReady = () => CL.mode === "local" && CL.auth?.loggedIn;

/* Claude 응답에서 JSON 만 뽑습니다 */
function clParseJson(text) {
  const s = String(text || "").trim();
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const body = fence ? fence[1] : s;
  const start = body.indexOf("{");
  const end = body.lastIndexOf("}");
  if (start === -1 || end === -1) throw new Error("결과에서 JSON 을 찾지 못했습니다.");
  return JSON.parse(body.slice(start, end + 1));
}

const clB64 = (buf) => {
  const bytes = new Uint8Array(buf);
  let bin = "";
  for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
  return btoa(bin);
};

/* ---------- 실행 ----------
   opts: { title, prompt, files:[{file, name, attachHint}], saramin, web, expect }
   반환: JSON 객체 · 사용자가 취소하면 null · 실패하면 throw */
async function clRun(opts) {
  if (!CL.ready) await clDetect();
  if (CL.mode === "local") {
    if (!CL.auth?.loggedIn) {
      /* 여러 공고를 한꺼번에 넣어도 설정 창은 하나만 */
      clSetupShared = clSetupShared || clSetupDialog({ reason: "자동 실행하려면 Claude 구독 계정으로 한 번만 로그인하면 됩니다. 로그인하면 기다리던 작업이 이어서 진행됩니다.", offerBridge: true }).finally(() => { clSetupShared = null; });
      const choice = await clSetupShared;
      if (choice === "bridge") return clCheck(await clRunBridge(opts), opts);
      if (!CL.auth?.loggedIn) return null;
    }
    try {
      return clCheck(await clRunLocal(opts), opts);
    } catch (e) {
      if (e.code === "not_logged_in") {
        CL.auth = { loggedIn: false };
        clRenderStatus();
        return clRun(opts);
      }
      throw e;
    }
  }
  return clCheck(await clRunBridge(opts), opts);
}

function clCheck(data, opts) {
  if (data && (typeof data !== "object" || Array.isArray(data))) throw new Error("결과 형식이 올바르지 않습니다.");
  /* schema 표시만 빠진 경우는 받아 줍니다 (다른 작업의 결과를 붙여넣은 경우만 막음) */
  if (data && opts.expect && data.schema && data.schema !== opts.expect) {
    throw new Error(`형식이 다른 결과입니다 (필요: ${opts.expect}). 이 작업의 프롬프트로 다시 받아 주세요.`);
  }
  return data;
}

async function clRunLocal({ title, prompt, files = [], saramin = false, web = false, naver = false, webDomains = [] }) {
  const id = uid("job");
  CL.jobs.set(id, { title, startedAt: Date.now() });
  clRenderStatus();
  try {
    const payloadFiles = [];
    for (const f of files) if (f.file) payloadFiles.push({ name: f.file.name || f.name, data: clB64(await f.file.arrayBuffer()) });
    const r = await fetch("/api/run", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt, files: payloadFiles, tools: { saramin, web, naver, webDomains } }),
    });
    const j = await r.json().catch(() => ({ ok: false, error: `HTTP ${r.status}` }));
    if (!j.ok) throw Object.assign(new Error(j.error || "Claude 실행 실패"), { code: j.code });
    const data = clParseJson(j.text);
    if (data && typeof data === "object") data._usedSaramin = !!j.usedSaramin;
    return data;
  } finally {
    CL.jobs.delete(id);
    clRenderStatus();
  }
}

/* ---------- claude.ai 브릿지 ----------
   창이 여러 개 겹치지 않게 차례대로 엽니다 */
function clRunBridge(opts) {
  const run = clBridgeChain.then(() => clRunBridgeOne(opts));
  clBridgeChain = run.catch(() => {});
  return run;
}

function clRunBridgeOne({ title, prompt, files = [], saramin = false, web = false, naver = false }) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "dlg";
    const attach = files.filter((f) => f.attachHint);
    dlg.innerHTML = `
      <h3>🤖 ${esc(title)} <span class="chip">claude.ai</span></h3>
      <ol class="steps">
        <li><strong>[복사하고 claude.ai 열기]</strong> → 새 대화에 붙여넣기 (⌘V)</li>
        ${attach.length ? `<li><strong>이미지를 claude.ai 입력창에 함께 첨부하세요.</strong> 아래에서 먼저 내려받으세요:<br>
          ${attach.map((f, i) => `<a class="btn btn-sm" data-cl="dl" data-i="${i}" href="#">⬇ ${esc(f.name || f.file?.name || `이미지 ${i + 1}`)}</a>`).join(" ")}</li>` : ""}
        ${saramin || naver ? `<li>입력창 <strong>＋ → 커넥터</strong>에서 <strong>PlayMCP</strong>(사람인${naver ? " · 네이버 검색" : ""}) 켜기 · 사용 허락 창이 뜨면 [허용]</li>` : ""}
        ${web ? `<li>입력창 <strong>＋</strong>에서 <strong>웹 검색</strong>이 켜져 있는지 확인</li>` : ""}
        <li>답변이 끝나면 <strong>답변 전체를 복사</strong>해 아래 칸에 붙여넣고 [반영]</li>
      </ol>
      <div class="row wrap" style="margin:10px 0">
        <button class="btn btn-primary btn-sm" data-cl="open" type="button">복사하고 claude.ai 열기 ↗</button>
        <button class="btn btn-sm" data-cl="copy" type="button">복사만 하기</button>
        <button class="btn btn-sm btn-ghost" data-cl="peek" type="button">내용 보기</button>
      </div>
      <p class="small" data-cl-msg></p>
      <div data-cl-manual hidden>
        <p class="notice warn small">복사가 막혀 있습니다. 아래 칸을 누르면 전체가 선택됩니다 — <strong>⌘C</strong> 로 복사한 뒤
          <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">claude.ai 열기 ↗</a> 에 붙여넣으세요.</p>
      </div>
      <textarea class="prompt-preview" data-cl-prompt rows="8" readonly hidden></textarea>
      <textarea rows="6" data-cl-in placeholder="Claude 답변을 통째로 붙여넣으세요"></textarea>
      <p class="notice warn" data-cl-err hidden></p>
      <div class="row dlg-actions">
        <button class="btn btn-primary" data-cl="apply" type="button">반영</button>
        <button class="btn btn-ghost" data-cl="cancel" type="button">나중에</button>
      </div>`;
    document.body.appendChild(dlg);
    const promptBox = dlg.querySelector("[data-cl-prompt]");
    promptBox.value = prompt;
    const msg = dlg.querySelector("[data-cl-msg]");
    const manual = dlg.querySelector("[data-cl-manual]");
    const showManual = (copied = false) => {
      manual.hidden = false;
      manual.firstElementChild.className = `notice ${copied ? "" : "warn"} small`;
      manual.firstElementChild.innerHTML = copied
        ? `붙여넣기가 안 되면 아래 칸을 눌러 <strong>⌘C</strong> 로 직접 복사하세요.`
        : `이 브라우저가 복사를 막았습니다. 아래 칸을 누르면 전체가 선택됩니다 — <strong>⌘C</strong> 로 복사한 뒤 claude.ai 에 붙여넣으세요.`;
      promptBox.hidden = false;
      promptBox.focus();
      promptBox.select();
    };
    promptBox.addEventListener("focus", () => promptBox.select());
    const finish = (v) => { dlg.close(); dlg.remove(); resolve(v); };

    dlg.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-cl]");
      if (!b) return;
      const act = b.dataset.cl;
      if (act === "open" || act === "copy") {
        const ok = await copyText(prompt);
        /* 복사가 됐든 안 됐든 아래 칸을 펼쳐 둡니다 — 브라우저가 복사를 막는 경우가 있어서, 직접 복사할 길을 항상 남깁니다 */
        showManual(ok);
        msg.textContent = ok
          ? (act === "open" ? "✅ 복사했습니다. 새 탭 claude.ai 입력칸에 ⌘V 로 붙여넣으세요." : "✅ 복사했습니다.")
          : "";
        msg.className = "small ok-text";
        if (act === "open") {
          /* 새 탭으로만 엽니다. 막히면 이 화면을 떠나지 않고 주소를 보여 줍니다 (붙여넣을 칸을 잃지 않도록) */
          const w = window.open("https://claude.ai/new", "_blank", "noopener");
          if (!w || w.closed) {
            msg.innerHTML = `${ok ? "✅ 복사했습니다. " : ""}새 탭이 열리지 않았습니다 — <a href="https://claude.ai/new" target="_blank" rel="noopener noreferrer">claude.ai 를 직접 열어</a> 붙여넣으세요.`;
            msg.className = "small";
          }
        }
        return;
      }
      if (act === "dl") {
        e.preventDefault();
        const f = attach[Number(b.dataset.i)]?.file;
        if (f) {
          const a2 = document.createElement("a");
          a2.href = URL.createObjectURL(f);
          a2.download = f.name || "screenshot.png";
          a2.click();
          setTimeout(() => URL.revokeObjectURL(a2.href), 2000);
        }
        return;
      }
      if (act === "peek") { promptBox.hidden = !promptBox.hidden; if (!promptBox.hidden) { promptBox.focus(); promptBox.select(); } return; }
      if (act === "cancel") finish(null);
      if (act === "apply") {
        try { finish(clParseJson(dlg.querySelector("[data-cl-in]").value)); }
        catch (ex) {
          const err = dlg.querySelector("[data-cl-err]");
          err.hidden = false;
          err.textContent = `❌ 결과를 알아보지 못했습니다. 답변을 처음부터 끝까지 모두 복사했는지 확인해 주세요. (${ex.message})`;
        }
      }
    });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(null); });
    dlg.showModal();
  });
}

/* ---------- 연결 설정 창 (로그인 · 사람인) ----------
   반환: "ok" | "bridge" | null */
function clSetupDialog({ reason = "", offerBridge = false } = {}) {
  return new Promise((resolve) => {
    const dlg = document.createElement("dialog");
    dlg.className = "dlg setup-dlg";
    let poll = null;
    let loginUrl = "";
    let loginStarted = false;
    let mcpBusy = false;

    const draw = () => {
      const a = CL.auth || {};
      const m = CL.mcp;
      dlg.innerHTML = `
        <h3>⚙ 연결 설정</h3>
        ${reason ? `<p class="notice">${esc(reason)}</p>` : ""}
        ${CL.mode !== "local" ? `
          ${CL.noCli ? `<p class="notice warn">이 컴퓨터에 <strong>Claude Code</strong> 가 없어서 자동 처리를 쓸 수 없습니다.
            <a href="https://claude.com/claude-code" target="_blank" rel="noopener noreferrer">Claude Code 설치 페이지</a>에서 설치한 뒤 <code>start.command</code> 로 다시 열어 주세요.
            설치 없이도 아래 <strong>복사해서 쓰기</strong>로 모든 기능을 쓸 수 있습니다.</p>` : ""}
          <p class="muted">지금은 <strong>복사해서 쓰기 모드</strong>입니다. 버튼을 누르면 준비된 글을 복사해 claude.ai 에 붙여넣고, 답변을 다시 가져오는 방식입니다. 내 컴퓨터에서 <code>start.command</code> 로 열면 자동으로 처리됩니다.</p>` : `
        <div class="setup-step ${a.loggedIn ? "done" : ""}">
          <div class="setup-head"><span class="setup-no">${a.loggedIn ? "✓" : "1"}</span>
            <strong>Claude 구독 로그인</strong>
            <span class="chip ${a.loggedIn ? "ok" : "warn"}">${a.loggedIn ? `로그인됨${a.email ? ` · ${esc(a.email)}` : ""}` : "필요"}</span></div>
          ${a.loggedIn ? "" : `
            <p class="muted">쓰고 있는 Claude 구독(Pro/Max) 계정으로 로그인합니다. 따로 요금이 붙지 않고, 한 번만 하면 됩니다.</p>
            ${loginStarted ? `
              <ol class="steps">
                <li>열린 브라우저 창에서 로그인·승인 <span class="muted">(창이 안 열렸다면 <a href="${esc(loginUrl)}" target="_blank" rel="noopener noreferrer">여기를 눌러 열기 ↗</a>)</span></li>
                <li>승인 후 <strong>코드가 보이면</strong> 복사해 붙여넣기 — 코드 없이 "완료" 화면이면 잠시 기다리면 자동 확인됩니다</li>
              </ol>
              <div class="row"><input type="text" data-su-code placeholder="인증 코드 붙여넣기 (보일 때만)" autocomplete="off">
                <button class="btn btn-sm" data-su="code" type="button">코드 보내기</button></div>
              <p class="muted small" data-su-wait>로그인 완료를 기다리는 중…</p>`
            : `<button class="btn btn-primary" data-su="login" type="button">브라우저로 로그인</button>`}`}
        </div>

        <div class="setup-step ${m?.authed ? "done" : ""}">
          <div class="setup-head"><span class="setup-no">${m?.authed ? "✓" : "2"}</span>
            <strong>사람인·네이버 검색 연결</strong> <span class="muted small">(선택 · 연결하면 공고·회사 정보가 정확해집니다)</span>
            <span class="chip ${m?.authed ? "ok" : m ? "warn" : ""}">${!m ? "확인 전" : m.authed ? "연결됨" : m.found ? "카카오 인증 필요" : "미등록"}</span></div>
          ${m?.authed ? "" : `
            <p class="muted"><strong>가장 쉬운 방법:</strong> <a href="https://claude.ai/settings/connectors" target="_blank" rel="noopener noreferrer">claude.ai 설정 → 커넥터</a>에서 <strong>PlayMCP</strong>를 연결하고,
  <a href="https://playmcp.kakao.com" target="_blank" rel="noopener noreferrer">PlayMCP</a> 도구함에 <strong>사람인</strong>과 <strong>네이버 검색</strong>을 담아 두세요. 그다음 [다시 확인]을 누르면 자동으로 잡힙니다.
  <span class="muted">(claude.ai 커넥터를 쓸 수 없을 때만 [연결하기] → 검은 창에서 <code>/mcp</code> → Authenticate 로 따로 연결합니다)</span></p>
            <div class="row wrap">
              <button class="btn ${a.loggedIn ? "btn-primary" : ""}" data-su="mcp" type="button" ${a.loggedIn && !mcpBusy ? "" : "disabled"}>${mcpBusy ? "처리 중…" : "연결하기"}</button>
              <button class="btn btn-sm" data-su="recheck" type="button">다시 확인</button>
            </div>`}
        </div>`}
        <div class="row dlg-actions">
          ${offerBridge && !a.loggedIn ? `<button class="btn" data-su="bridge" type="button">이번엔 claude.ai 로 진행</button>` : ""}
          <button class="btn ${a.loggedIn && offerBridge ? "btn-primary" : "btn-ghost"}" data-su="close" type="button">${a.loggedIn && offerBridge ? "계속 진행" : "닫기"}</button>
        </div>`;
    };

    const finish = (v) => { clearInterval(poll); dlg.close(); dlg.remove(); resolve(v); };

    const startPoll = () => {
      clearInterval(poll);
      poll = setInterval(async () => {
        await clRefreshStatus(false);
        if (CL.auth?.loggedIn) {
          clearInterval(poll);
          toast("✅ Claude 구독 로그인 완료", "ok");
          if (offerBridge) { finish("ok"); return; }
          draw();
          clRefreshStatus(true, true).then(draw);
        }
      }, 2500);
    };

    dlg.addEventListener("click", async (e) => {
      const b = e.target.closest("[data-su]");
      if (!b) return;
      const act = b.dataset.su;
      if (act === "close") return finish(CL.auth?.loggedIn ? "ok" : null);
      if (act === "bridge") return finish("bridge");
      if (act === "login") {
        b.disabled = true;
        try {
          const j = await (await fetch("/api/login/start", { method: "POST" })).json();
          if (!j.ok) throw new Error(j.error);
          loginUrl = j.url; loginStarted = true;
          draw(); startPoll();
        } catch (ex) { toast("❌ 로그인 시작 실패: " + ex.message, "warn"); b.disabled = false; }
      }
      if (act === "code") {
        const code = dlg.querySelector("[data-su-code]").value.trim();
        if (!code) return;
        await fetch("/api/login/code", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ code }) });
        const w = dlg.querySelector("[data-su-wait]");
        if (w) w.textContent = "코드를 보냈습니다. 확인 중…";
      }
      if (act === "mcp") {
        mcpBusy = true; draw();
        try {
          const j = await (await fetch("/api/mcp/setup", { method: "POST" })).json();
          if (!j.ok) throw new Error(j.error);
          CL.mcp = j.mcp;
          if (j.openedTerminal) toast("터미널 창에서 /mcp → 카카오 인증을 마친 뒤 [다시 확인]을 누르세요", "ok");
        } catch (ex) { toast("❌ " + ex.message, "warn"); }
        mcpBusy = false; draw();
      }
      if (act === "recheck") {
        b.textContent = "확인 중…"; b.disabled = true;
        await clRefreshStatus(true, true);
        draw();
      }
    });
    dlg.addEventListener("cancel", (e) => { e.preventDefault(); finish(CL.auth?.loggedIn ? "ok" : null); });
    draw();
    document.body.appendChild(dlg);
    dlg.showModal();
    if (CL.mode === "local" && !CL.mcp) clRefreshStatus(true).then(() => { if (dlg.open) draw(); });
  });
}

/* ---------- 상단 상태 표시 ---------- */
function clStatusHTML() {
  const n = CL.jobs.size;
  const jobs = n ? `<span class="pill busy" title="${esc([...CL.jobs.values()].map((j) => j.title).join("\n"))}"><i class="spin"></i> 작업 ${n}개 진행 중</span>` : "";
  if (CL.mode !== "local") {
    return `${jobs}<button class="pill ${CL.noCli ? "warn" : ""}" data-act="setup" type="button" title="${CL.noCli ? "Claude Code 가 설치되어 있지 않아 자동 처리를 쓸 수 없습니다" : "이 컴퓨터에서 start.command 로 열면 자동으로 처리됩니다"}">🔗 복사해서 쓰기${CL.noCli ? " (설치 필요)" : ""}</button>`;
  }
  if (!CL.auth) return `${jobs}<span class="pill">연결 확인 중…</span>`;
  if (!CL.auth.loggedIn) return `${jobs}<button class="pill warn" data-act="setup" type="button">⚠ 로그인 필요</button>`;
  const m = CL.mcp;
  return `${jobs}<button class="pill ok" data-act="setup" type="button">⚡ 자동 처리 켜짐${m ? (m.authed ? " · 사람인 연결됨" : " · 사람인 연결 전") : ""}</button>`;
}

function clRenderStatus() {
  const el = document.getElementById("ai-status");
  if (el) el.innerHTML = clStatusHTML();
}

/* 사람인·네이버 검색 사용 규칙 — 공고·면접 프롬프트 공통 */
function clSaraminRule() {
  return "사람인 공고·회사 정보는 연결된 사람인 도구(search_saramin_jobs · search_company_info)가 있으면 그것을 먼저 쓰고, 없으면 웹 조회로 대신합니다.";
}
function clNaverRule() {
  return "회사 기사·평판은 네이버 검색 도구(NaverSearch-search_news · search_webkr · search_blog)가 있으면 그것으로 찾고, 없으면 웹 검색으로 대신합니다. 어느 쪽이든 실제로 열어 읽은 것만 씁니다.";
}

/* 공통 알림 */
function toast(text, kind = "", action) {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = `<span></span>${action ? `<button class="toast-btn" type="button">${esc(action.label)}</button>` : ""}`;
  el.firstChild.textContent = text;
  if (action) el.querySelector("button").onclick = () => { action.run(); el.remove(); };
  let stack = document.getElementById("toasts");
  if (!stack) { stack = document.createElement("div"); stack.id = "toasts"; document.body.appendChild(stack); }
  stack.appendChild(el);
  setTimeout(() => el.remove(), action ? 9000 : kind === "warn" ? 7000 : 4000);
}
