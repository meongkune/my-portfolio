/* ============================================================
   me.js — 내 정보 (고정)
   ------------------------------------------------------------
   - 이름·연락처·희망 직무 같은 "나"에 대한 값은 여기 한 곳에만 있습니다.
     이력서(00)·프로필·프롬프트는 모두 이 값을 읽어 씁니다.
   - 모든 메뉴 상단에 고정 표시됩니다.
   - 🔒 잠금 상태에서는 문서 자동 채우기·이력서 첨부가 절대 바꾸지 못합니다.
     직접 [잠금 해제]한 뒤에만 고칠 수 있습니다.
   ============================================================ */

const ME_FIELDS = [
  { k: "name", label: "이름", ph: "홍길동", req: true },
  { k: "nameEn", label: "영문 이름", ph: "Gildong Hong" },
  { k: "birth", label: "생년월일", ph: "1999.01.01" },
  { k: "phone", label: "연락처", ph: "010-1234-5678", req: true },
  { k: "email", label: "이메일", ph: "name@example.com", req: true },
  { k: "address", label: "주소", ph: "서울시 노원구" },
  { k: "desiredJob", label: "희망 직무", ph: "서비스기획", req: true },
  { k: "headline", label: "한 줄 소개", ph: "데이터로 문제를 찾아 개선하는 기획자", wide: true },
];

/* 자주 쓰는 추가 항목 보기 — 눌러서 바로 넣습니다 */
const ME_EXTRA_PRESETS = ["병역", "보훈 대상", "장애 여부", "희망 연봉", "취업 가능 시기", "운전면허", "비자·국적"];

const meBlank = () => {
  const o = { locked: false, links: [], extra: [] };
  ME_FIELDS.forEach((f) => { o[f.k] = ""; });
  return o;
};

const meHas = (me) => ME_FIELDS.some((f) => String(me?.[f.k] || "").trim());

/* 저장본에 me 가 없으면 예전 이력서·프로필 값에서 옮깁니다. */
function meNormalize(s) {
  const me = Object.assign(meBlank(), s.me || {});
  if (!s.me) {
    const b = s.resume?.basic || {};
    const p = s.profile || {};
    me.name = b.name || p.name || "";
    me.phone = b.phone || "";
    me.email = b.email || "";
    me.desiredJob = b.desiredJob || "";
    me.headline = p.headline || "";
    me.links = Array.isArray(p.links) ? p.links : [];
    me.locked = meHas(me);
  }
  me.links = (Array.isArray(me.links) ? me.links : []).filter((l) => l && typeof l === "object");
  /* 내가 만든 추가 항목 — 한 번 넣으면 직접 지우기 전까지 그대로 남습니다 */
  me.extra = (Array.isArray(me.extra) ? me.extra : []).filter((x) => x && typeof x === "object")
    .map((x) => ({ id: x.id || uid("mx"), label: String(x.label || "").trim(), value: String(x.value || "").trim() }))
    .filter((x) => x.label);
  s.me = me;
  meSync(s);
  return s;
}

/* 다른 곳에서 읽는 사본을 맞춥니다 (이력서 basic · 프로필). */
function meSync(s = S) {
  const me = s.me;
  s.resume = s.resume || {};
  s.resume.basic = { name: me.name, desiredJob: me.desiredJob, phone: me.phone, email: me.email };
  s.profile = Object.assign(s.profile || {}, {
    name: me.name, headline: me.headline, contact: [me.phone, me.email].filter(Boolean).join(" · "), links: me.links,
  });
}

/* ---------- 상단 고정 바 ---------- */
function meBarHTML() {
  const me = S.me;
  if (!meHas(me)) {
    return `<div class="me-bar empty">
      <span>👤 <strong>내 정보</strong>가 비어 있습니다. 직접 입력하거나 ① 내 이력서에서 이력서를 첨부하면 채워집니다.</span>
      <button class="btn btn-sm btn-primary" data-act="me-edit" type="button">내 정보 입력</button>
    </div>`;
  }
  const bits = [me.desiredJob && `🎯 ${me.desiredJob}`, me.phone, me.email].filter(Boolean);
  return `<div class="me-bar">
    <span class="me-name">👤 ${esc(me.name || "(이름 없음)")}</span>
    <span class="me-bits">${bits.map((b) => `<span>${esc(b)}</span>`).join("")}</span>
    <span class="chip ${me.locked ? "ok" : "warn"}">${me.locked ? "🔒 고정됨" : "🔓 편집 가능"}</span>
    <button class="btn btn-sm" data-act="me-edit" type="button">${me.locked ? "보기" : "편집"}</button>
  </div>`;
}

function renderMeBar() {
  const el = document.getElementById("me-bar");
  if (el) el.innerHTML = meBarHTML();
}

/* ---------- 편집 창 ---------- */
function meDialog() {
  const dlg = document.createElement("dialog");
  dlg.className = "dlg me-dialog";
  const draw = () => {
    const me = S.me;
    const ro = me.locked ? "readonly" : "";
    dlg.innerHTML = `
      <div class="card-head"><h3>👤 내 정보 ${me.locked ? '<span class="chip ok">🔒 고정됨</span>' : '<span class="chip warn">🔓 편집 중</span>'}</h3></div>
      <p class="muted">${me.locked
        ? "잠겨 있어 안전합니다. 파일을 첨부해 자동으로 채울 때도 이 값은 바뀌지 않습니다. 고치려면 [잠금 해제]를 누르세요."
        : "여기 적은 값은 이력서와 모든 화면에 그대로 쓰입니다. 다 적었으면 [저장하고 잠그기]를 눌러 두세요."}</p>
      <div class="rs-fields" style="margin-top:12px">
        ${ME_FIELDS.map((f) => `
          <label class="field${f.wide ? " me-wide" : ""}"><span>${esc(f.label)}${f.req ? " *" : ""}</span>
            <input type="text" data-me="${f.k}" value="${esc(me[f.k])}" placeholder="${esc(f.ph)}" ${ro}></label>`).join("")}
      </div>
      <div class="card-head" style="margin-top:14px"><h3 style="font-size:13px">그 외 항목 <span class="muted small">— 병역·희망 연봉처럼 내가 쓰는 항목을 직접 추가</span></h3></div>
      ${(me.extra || []).map((x, i) => `
        <div class="row" style="margin-bottom:6px">
          <input type="text" style="flex:0 0 34%" data-me-extra="${i}" data-k="label" value="${esc(x.label)}" placeholder="항목 이름" ${ro}>
          <input type="text" data-me-extra="${i}" data-k="value" value="${esc(x.value)}" placeholder="내용" ${ro}>
          ${me.locked ? "" : `<button class="btn btn-sm btn-danger" data-me-act="del-extra" data-i="${i}" type="button">삭제</button>`}
        </div>`).join("") || `<p class="muted small">추가한 항목이 없습니다.</p>`}
      ${me.locked ? "" : `<div class="chips" style="margin-top:6px">
        ${ME_EXTRA_PRESETS.filter((t) => !(me.extra || []).some((x) => x.label === t)).map((t) => `<button class="chip" data-me-act="add-extra" data-label="${esc(t)}" type="button">+ ${esc(t)}</button>`).join("")}
        <button class="chip accent" data-me-act="add-extra" type="button">+ 직접 입력</button>
      </div>`}

      <div class="card-head" style="margin-top:14px"><h3 style="font-size:13px">링크 (포트폴리오·깃허브 등)</h3>
        ${me.locked ? "" : `<button class="btn btn-sm" data-me-act="add-link" type="button">+ 추가</button>`}</div>
      ${(me.links || []).map((l, i) => `
        <div class="row" style="margin-bottom:6px">
          <input type="text" style="flex:0 0 30%" data-me-link="${i}" data-k="label" value="${esc(l.label)}" placeholder="이름" ${ro}>
          <input type="text" data-me-link="${i}" data-k="url" value="${esc(l.url)}" placeholder="https://" ${ro}>
          ${me.locked ? "" : `<button class="btn btn-sm btn-danger" data-me-act="del-link" data-i="${i}" type="button">삭제</button>`}
        </div>`).join("") || `<p class="muted">링크가 없습니다.</p>`}
      <div class="row dlg-actions">
        ${me.locked
          ? `<button class="btn" data-me-act="unlock" type="button">🔓 잠금 해제</button>`
          : `<button class="btn btn-primary" data-me-act="lock" type="button">저장하고 잠그기 🔒</button>`}
        <button class="btn btn-ghost" data-me-act="close" type="button">닫기</button>
      </div>`;
  };

  dlg.addEventListener("input", (e) => {
    if (S.me.locked) return;
    const t = e.target;
    if (t.dataset.me) S.me[t.dataset.me] = t.value;
    if (t.dataset.meLink != null) S.me.links[Number(t.dataset.meLink)][t.dataset.k] = t.value;
    if (t.dataset.meExtra != null) S.me.extra[Number(t.dataset.meExtra)][t.dataset.k] = t.value;
    meSync(); save(); renderMeBar();
  });
  dlg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-me-act]");
    if (!b) return;
    const act = b.dataset.meAct;
    if (act === "unlock") {
      if (!confirm("내 정보 잠금을 풀까요? 푼 동안에는 직접 편집할 수 있습니다.")) return;
      S.me.locked = false;
    }
    if (act === "lock") {
      const miss = ME_FIELDS.filter((f) => f.req && !String(S.me[f.k] || "").trim()).map((f) => f.label);
      if (miss.length && !confirm(`비어 있는 필수 항목: ${miss.join(", ")}\n그래도 잠글까요?`)) return;
      S.me.locked = true;
    }
    if (act === "add-link") S.me.links.push({ label: "", url: "" });
    if (act === "add-extra") S.me.extra.push({ id: uid("mx"), label: b.dataset.label || "", value: "" });
    if (act === "del-extra") S.me.extra.splice(Number(b.dataset.i), 1);
    if (act === "del-link") S.me.links.splice(Number(b.dataset.i), 1);
    if (act === "close") { dlg.close(); return; }
    meSync(); save(); draw(); renderMeBar();
  });
  dlg.addEventListener("close", () => { dlg.remove(); render(); });
  draw();
  document.body.appendChild(dlg);
  dlg.showModal();
}

/* 문서에서 읽은 내 정보 후보를 반영합니다. 잠겨 있으면 아무것도 바꾸지 않습니다. */
function meApplyCandidate(cand, pickKeys) {
  if (S.me.locked) return 0;
  let n = 0;
  pickKeys.forEach((k) => {
    if (k === "links") {
      const have = new Set(S.me.links.map((l) => l.url));
      (cand.links || []).forEach((l) => { if (l.url && !have.has(l.url)) { S.me.links.push({ label: l.label || "링크", url: l.url }); n++; } });
      return;
    }
    const v = String(cand[k] || "").trim();
    if (v && v !== S.me[k]) { S.me[k] = v; n++; }
  });
  meSync();
  return n;
}

/* 프롬프트에 넣는 내 정보 요약 (연락처는 넣지 않습니다) */
function meBrief() {
  const me = S.me;
  return [me.name && `이름: ${me.name}`, me.desiredJob && `희망 직무: ${me.desiredJob}`, me.headline && `한 줄 소개: ${me.headline}`]
    .filter(Boolean).join("\n");
}
