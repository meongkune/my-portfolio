/* ============================================================
   ingest.js — 가지고 있는 파일로 자동 채우기 · 이력서 첨부로 재구성
   ------------------------------------------------------------
   흐름: 파일 선택 → 브라우저에서 글자 추출(PDF·DOCX·HWPX·TXT) → Claude 가 항목별 JSON 으로 정리
        → [변경 미리보기] 에서 항목마다 교체/합치기/유지 선택 → 반영

   두 가지 모드
   - fill   : 문서로 빈칸 채우기. 기존 내용은 두고 없는 것만 더하고, 같은 항목은 최신 값으로 갱신
   - resume : 특정 이력서 기준으로 재구성. 이력서에 있는 항목은 이력서 내용으로 교체하고,
              이력서의 섹션 구성(순서·추가 섹션·표시 여부)까지 맞춥니다.
   내 정보(me)가 🔒 잠겨 있으면 어느 모드든 내 정보는 바꾸지 않습니다.
   ============================================================ */

const ING_SCHEMA = "pf-extract-v1";
const ING_ACCEPT = ".pdf,.docx,.hwpx,.txt,.md,.json,.csv,.html,.png,.jpg,.jpeg,.webp,.hwp";

/* ---------- ZIP (docx · hwpx) — 외부 라이브러리 없이 ---------- */
async function ingUnzip(buf, wanted) {
  const dv = new DataView(buf);
  let eocd = -1;
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 66000); i--) {
    if (dv.getUint32(i, true) === 0x06054b50) { eocd = i; break; }
  }
  if (eocd < 0) throw new Error("ZIP 형식이 아닙니다.");
  const count = dv.getUint16(eocd + 10, true);
  let p = dv.getUint32(eocd + 16, true);
  const out = {};
  const dec = new TextDecoder();
  for (let n = 0; n < count; n++) {
    if (dv.getUint32(p, true) !== 0x02014b50) break;
    const method = dv.getUint16(p + 10, true);
    const csize = dv.getUint32(p + 20, true);
    const nlen = dv.getUint16(p + 28, true), xlen = dv.getUint16(p + 30, true), clen = dv.getUint16(p + 32, true);
    const local = dv.getUint32(p + 42, true);
    const name = dec.decode(new Uint8Array(buf, p + 46, nlen));
    p += 46 + nlen + xlen + clen;
    if (!wanted(name)) continue;
    const lnlen = dv.getUint16(local + 26, true), lxlen = dv.getUint16(local + 28, true);
    const data = new Uint8Array(buf, local + 30 + lnlen + lxlen, csize);
    if (method === 0) out[name] = dec.decode(data);
    else if (method === 8) {
      const stream = new Blob([data]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
      out[name] = await new Response(stream).text();
    }
  }
  return out;
}

const ingXmlText = (xml, paraTag, textTag) => xml
  .split(new RegExp(`</${paraTag}>`))
  .map((para) => (para.match(new RegExp(`<${textTag}[^>]*>([^<]*)</${textTag}>`, "g")) || [])
    .map((t) => t.replace(/<[^>]+>/g, "")).join(""))
  .map((s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'").replace(/&amp;/g, "&").trim())
  .filter(Boolean).join("\n");

/* ---------- PDF — pdf.js 를 필요할 때만 불러옵니다 ---------- */
const PDFJS = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/";
let pdfjsLoading = null;
function ingLoadPdfjs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  pdfjsLoading = pdfjsLoading || new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = PDFJS + "pdf.min.js";
    s.onload = () => { window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS + "pdf.worker.min.js"; resolve(window.pdfjsLib); };
    s.onerror = () => reject(new Error("PDF 읽기 도구를 불러오지 못했습니다 (인터넷 연결 확인)."));
    document.head.appendChild(s);
  });
  return pdfjsLoading;
}

async function ingPdfText(buf) {
  const lib = await ingLoadPdfjs();
  const doc = await lib.getDocument({ data: buf }).promise;
  const pages = [];
  for (let i = 1; i <= doc.numPages; i++) {
    const tc = await (await doc.getPage(i)).getTextContent();
    let line = "", lastY = null;
    const rows = [];
    tc.items.forEach((it) => {
      const y = Math.round(it.transform[5]);
      if (lastY !== null && Math.abs(y - lastY) > 3) { rows.push(line); line = ""; }
      line += (line && !line.endsWith(" ") ? " " : "") + it.str;
      lastY = y;
    });
    rows.push(line);
    pages.push(rows.map((r) => r.trim()).filter(Boolean).join("\n"));
  }
  return pages.join("\n\n");
}

/* 파일 하나 → { file, name, kind, text, attachHint, warn } */
async function ingRead(file) {
  const name = file.name;
  const ext = (name.split(".").pop() || "").toLowerCase();
  const r = { file, name, kind: ext, text: "", attachHint: false, warn: "" };
  try {
    if (["txt", "md", "json", "csv"].includes(ext)) r.text = await file.text();
    else if (ext === "html") r.text = new DOMParser().parseFromString(await file.text(), "text/html").body.innerText;
    else if (ext === "docx") {
      const z = await ingUnzip(await file.arrayBuffer(), (n) => n === "word/document.xml");
      r.text = ingXmlText(z["word/document.xml"] || "", "w:p", "w:t");
    } else if (ext === "hwpx") {
      const z = await ingUnzip(await file.arrayBuffer(), (n) => /^Contents\/section\d+\.xml$/.test(n));
      r.text = Object.keys(z).sort().map((k) => ingXmlText(z[k], "hp:p", "hp:t")).join("\n");
    } else if (ext === "pdf") {
      r.text = await ingPdfText(await file.arrayBuffer());
      if (r.text.replace(/\s/g, "").length < 80) { r.attachHint = true; r.warn = "글자를 거의 못 읽었습니다(스캔본일 수 있음) — Claude 가 원본을 직접 봅니다."; }
    } else if (["png", "jpg", "jpeg", "webp"].includes(ext)) {
      r.attachHint = true;
    } else if (ext === "hwp") {
      r.warn = "HWP(구버전)는 읽을 수 없습니다. 한글에서 PDF 또는 HWPX 로 저장해 다시 첨부하세요.";
    } else {
      r.warn = "지원하지 않는 형식입니다.";
    }
  } catch (e) {
    r.attachHint = ext === "pdf";
    r.warn = `읽기 실패: ${e.message}`;
  }
  return r;
}

/* ---------- 프롬프트 ---------- */
function ingPrompt(docs, mode) {
  const opt = (k, f) => RESUME_SECTIONS.find((s) => s.key === k).fields.find((x) => x.k === f).options.join("|");
  const body = docs.map((d, i) => `--- 문서 ${i + 1}: ${d.name} ---\n${d.text.trim() || (d.attachHint ? "(글자 추출 불가 — 첨부된 원본 파일을 직접 읽으세요)" : "(내용 없음)")}`).join("\n\n");
  return `아래 ${mode === "resume" ? "이력서" : "문서"}에서 취업 준비용 정보를 항목별로 뽑아 JSON 으로 정리해 주세요.

[규칙]
- 문서에 적힌 사실만 옮깁니다. 추측·과장·새로 지어낸 내용은 절대 넣지 않습니다. 없는 값은 "" 또는 빈 배열.
- 문장은 원문 표현을 최대한 유지하되, 한 줄에 하나씩 짧게 나눕니다. 숫자·성과는 빠뜨리지 않습니다.
- 날짜는 YYYY.MM 형식(기간은 "YYYY.MM – YYYY.MM", 재직/재학 중이면 "YYYY.MM – 현재").
- education.status 는 ${opt("education", "status")} 중 하나, career.type 은 ${opt("career", "type")} 중 하나.
- 표준 섹션: education(학력) · career(경력: 담당 업무·성과를 duties 에 한 줄씩) · projects(프로젝트·수업·공모전·대외활동·동아리: 한 일·성과를 content 에 한 줄씩) · skills(보유 기술) · certificates · languages · awards · strengths(핵심 역량/자기소개의 강점과 근거) · extra(그 외).
- 표준 섹션에 안 맞고 이력서에 제목이 따로 있는 섹션만 custom 에 섹션 제목 그대로 넣습니다.
- sectionOrder 에는 문서에 나온 섹션 순서를 적습니다 (표준은 키 이름, 추가 섹션은 "custom:섹션 제목").
- prefs 에는 문서에 적힌 희망 근무지·고용형태·연봉 등이 있을 때만 넣습니다.
- me 에는 지원자 본인의 인적사항만 넣습니다 (다른 사람·회사 연락처 제외). 포트폴리오·GitHub 주소는 me.links.

[출력] 설명 없이 아래 JSON 만 출력하세요.
${JSON.stringify({
    schema: ING_SCHEMA,
    docKind: "이력서|자기소개서|경력기술서|포트폴리오|기타",
    me: { name: "", nameEn: "", birth: "", phone: "", email: "", address: "", desiredJob: "", headline: "", links: [{ label: "", url: "" }] },
    resume: {
      education: [{ period: "", school: "", major: "", status: "", gpa: "" }],
      career: [{ period: "", company: "", role: "", type: "", duties: [""] }],
      certificates: [{ date: "", name: "", issuer: "" }],
      languages: [{ test: "", score: "", date: "" }],
      awards: [{ date: "", title: "", org: "", desc: "" }],
      projects: [{ period: "", title: "", org: "구분·소속", role: "", skills: "", content: ["한 일·성과"] }],
      skills: [{ category: "", items: "" }],
      strengths: [{ title: "", content: ["근거"] }],
      extra: [{ category: "", period: "", title: "", content: [""] }],
    },
    prefs: { level: "신입|경력|", years: "", regions: "", employment: "", salary: "", industries: "", avoid: "" },
    custom: [{ title: "섹션 제목", rows: [{ period: "", title: "", content: [""] }] }],
    sectionOrder: ["education", "career", "projects"],
    notes: ["읽기 어려웠던 부분이나 확인이 필요한 점"],
  }, null, 2)}

[문서]
${body}`;
}

/* ---------- 받은 값 다듬기 ---------- */
const ingNorm = (s) => String(s || "").toLowerCase().replace(/\(주\)|㈜|주식회사|\s|[·.,\-–()]/g, "");

function ingCoerce(sec, row) {
  const out = rsBlankRow(sec);
  sec.fields.forEach((f) => {
    const v = rsStr(row?.[f.k]);
    if (f.type !== "select") { out[f.k] = v; return; }
    if (f.options.includes(v)) { out[f.k] = v; return; }
    const guess = sec.key === "education"
      ? (/예정/.test(v) ? "졸업예정" : /휴학/.test(v) ? "휴학" : /재학|현재/.test(v) ? "재학" : /수료/.test(v) ? "수료" : /중퇴/.test(v) ? "중퇴" : "졸업")
      : (/인턴/.test(v) ? "인턴" : /실습/.test(v) ? "현장실습" : /알바|아르바이트/.test(v) ? "아르바이트" : /계약/.test(v) ? "계약직" : /프리/.test(v) ? "프리랜서" : "정규직");
    out[f.k] = guess;
  });
  if (sec.sub) out[sec.sub.k] = sec.sub.single ? rsStr(row?.[sec.sub.k]) : rsArr(row?.[sec.sub.k]);
  return out;
}

const ING_KEY = {
  education: (r) => ingNorm(r.school) + "|" + ingNorm(r.major),
  career: (r) => ingNorm(r.company) + "|" + ingNorm(r.period).slice(0, 6),
  certificates: (r) => ingNorm(r.name),
  languages: (r) => ingNorm(r.test),
  awards: (r) => ingNorm(r.title),
  extra: (r) => ingNorm(r.title),
  custom: (r) => ingNorm(r.title) + "|" + ingNorm(r.period).slice(0, 6),
  projects: (r) => ingNorm(r.title).slice(0, 24),
  skills: (r) => ingNorm(r.category) + "|" + ingNorm(r.items).slice(0, 12),
  strengths: (r) => ingNorm(r.title).slice(0, 24),
};
const ingLabel = {
  education: (r) => [r.school, r.major].filter(Boolean).join(" "),
  career: (r) => [r.company, r.role].filter(Boolean).join(" "),
  certificates: (r) => r.name, languages: (r) => `${r.test} ${r.score}`, awards: (r) => r.title,
  extra: (r) => r.title, custom: (r) => r.title, projects: (r) => r.title, skills: (r) => `${r.category} ${r.items}`, strengths: (r) => r.title,
};
const ingSame = (a, b, skip = ["id"]) => {
  const pick = (o) => JSON.stringify(Object.keys(o).filter((k) => !skip.includes(k)).sort().map((k) => [k, o[k]]));
  return pick(a) === pick(b);
};

/* 같은 항목인지 알아보는 열쇠. 열쇠가 비면(예: 분야 없는 기술) 절대 다른 줄과 겹치지 않게 고유값을 줍니다 */
function ingKeyer(kind) {
  const f = ING_KEY[kind];
  const uniq = new WeakMap();
  return (r) => {
    const k = f(r);
    if (k.replace(/\|/g, "")) return k;
    if (!uniq.has(r)) uniq.set(r, `__${rsId()}`);
    return uniq.get(r);
  };
}

const ingNonEmpty = (o) => Object.fromEntries(Object.entries(o).filter(([k, v]) => k !== "id" && (Array.isArray(v) ? v.length : String(v ?? "").trim())));

/* 새 줄마다 짝이 되는 기존 줄(한 번씩만)을 찾습니다 */
function ingPair(kind, cur, inc) {
  const key = ingKeyer(kind);
  const used = new Set();
  const pairs = inc.map((r) => {
    const k = key(r);
    const old = cur.find((c) => !used.has(c) && key(c) === k);
    if (old) used.add(old);
    return [r, old];
  });
  return { pairs, used };
}

/* 현재 목록과 새 목록 비교 → { added, changed, removed(교체할 때 없어지는 줄) } */
function ingDiff(kind, cur, inc) {
  const { pairs, used } = ingPair(kind, cur, inc);
  return {
    added: pairs.filter(([, old]) => !old).map(([r]) => r),
    changed: pairs.filter(([r, old]) => old && !ingSame({ ...old, ...ingNonEmpty(r) }, old)).map(([r]) => r),
    removed: cur.filter((c) => !used.has(c)),
  };
}

/* action: replace | merge | keep */
function ingMerge(kind, cur, inc, action) {
  if (action === "keep" || (!inc.length && action !== "replace")) return cur;
  const { pairs, used } = ingPair(kind, cur, inc);
  const merged = pairs.map(([r, old]) => (old ? { ...old, ...ingNonEmpty(r), id: old.id } : r));
  if (action === "replace") return merged;
  const out = cur.map((c) => { const hit = pairs.find(([, old]) => old === c); return hit ? { ...c, ...ingNonEmpty(hit[0]), id: c.id } : c; });
  return out.concat(pairs.filter(([, old]) => !old).map(([r]) => r));   /* 합치기: 기존은 제자리에서 갱신, 새 줄은 뒤에 */
}

/* ---------- 실행 ---------- */
function ingOpen(mode) {
  const input = document.createElement("input");
  input.type = "file";
  input.multiple = true;   /* 이력서도 여러 장(이력서+경력기술서 등)을 한 번에 받습니다 */
  input.accept = ING_ACCEPT;
  input.addEventListener("change", () => { if (input.files.length) ingRun([...input.files], mode); });
  input.click();
}

async function ingRun(files, mode) {
  const docs = [];
  for (const f of files) docs.push(await ingRead(f));
  const usable = docs.filter((d) => d.text.trim() || d.attachHint);
  docs.filter((d) => d.warn).forEach((d) => toast(`${d.name}: ${d.warn}`, "warn"));
  if (!usable.length) return;
  if (CL.mode === "local" && CL.auth?.loggedIn) toast(`📄 ${usable.length}개 파일을 읽는 중입니다. 끝나면 변경 미리보기가 열립니다 — 다른 작업을 계속하세요.`);

  let data;
  try {
    data = await clRun({
      title: mode === "resume" ? `이력서 읽기 — ${usable[0].name}` : `문서 ${usable.length}개 읽기`,
      prompt: ingPrompt(usable, mode),
      files: usable.filter((d) => d.attachHint || d.kind === "pdf").map((d) => ({ file: d.file, name: d.name, attachHint: d.attachHint })),
      expect: ING_SCHEMA,
    });
  } catch (e) {
    toast("❌ " + e.message, "warn");
    return;
  }
  if (data) {
    if (document.querySelector("dialog[open]")) toast("📄 문서 읽기 완료", "ok", { label: "변경 미리보기 열기", run: () => ingReview(data, mode, usable.map((d) => d.name)) });
    else ingReview(data, mode, usable.map((d) => d.name));
  }
}

/* 받은 JSON → 섹션별 새 목록 */
function ingIncoming(data) {
  const res = data.resume || {};
  const inc = {};
  RESUME_SECTIONS.forEach((sec) => {
    inc[sec.key] = (Array.isArray(res[sec.key]) ? res[sec.key] : []).map((r) => ingCoerce(sec, r)).filter((r) => rsHasContent(sec, r));
  });
  inc.custom = (Array.isArray(data.custom) ? data.custom : []).filter((c) => rsStr(c?.title)).map((c) => ({
    title: rsStr(c.title),
    rows: (Array.isArray(c.rows) ? c.rows : []).map((r) => ({ id: rsId(), period: rsStr(r.period), title: rsStr(r.title), content: rsArr(r.content) }))
      .filter((r) => r.title || r.content.length),
  }));
  return inc;
}

function ingReview(data, mode, names) {
  const inc = ingIncoming(data);
  const me = data.me || {};
  const locked = S.me.locked;
  const meRows = ME_FIELDS.map((f) => ({ k: f.k, label: f.label, cur: rsStr(S.me[f.k]), val: rsStr(me[f.k]) }))
    .filter((r) => r.val && r.val !== r.cur);
  const newLinks = (Array.isArray(me.links) ? me.links : []).filter((l) => l?.url && !S.me.links.some((x) => x.url === l.url));

  /* 비교할 묶음들 */
  const groups = RESUME_SECTIONS.map((sec) => ({ kind: sec.key, id: sec.key, title: sec.title, cur: S.resume[sec.key], inc: inc[sec.key] }));
  inc.custom.forEach((c) => {
    const old = S.resume.custom.find((x) => ingNorm(x.title) === ingNorm(c.title));
    groups.push({ kind: "custom", id: `custom:${c.title}`, title: `${c.title} (추가 섹션)`, cur: old ? old.rows : [], inc: c.rows, customTitle: c.title });
  });
  const prefIn = data.prefs && typeof data.prefs === "object" ? data.prefs : {};
  const prefRows = RS_PREFS.map((f) => ({ k: f.k, label: f.label, cur: rsStr(S.resume.prefs[f.k]), val: rsStr(prefIn[f.k]) }))
    .filter((r) => r.val && r.val !== r.cur && (f => f.type !== "select" || f.options.includes(r.val))(RS_PREFS.find((x) => x.k === r.k)));

  const defAction = (g) => {
    if (!g.inc.length) return "keep";
    if (mode === "resume") return "replace";
    return "merge";
  };

  const dlg = document.createElement("dialog");
  dlg.className = "dlg ing-dialog";
  const list = (arr, fn) => arr.slice(0, 4).map((r) => esc(fn(r) || "(이름 없음)")).join(", ") + (arr.length > 4 ? ` 외 ${arr.length - 4}` : "");

  dlg.innerHTML = `
    <h3>${mode === "resume" ? "📄 첨부한 이력서에 맞추기" : "📂 문서에서 내용 가져오기"} — 변경 미리보기</h3>
    <p class="muted">${esc(names.join(", "))} · ${esc(data.docKind || "")}. 항목마다 어떻게 할지 고른 뒤 [반영]을 누르세요. 반영한 뒤에도 되돌릴 수 있습니다.</p>

    <h4>👤 내 정보</h4>
    ${locked
      ? `<p class="chip ok" style="display:block;border-radius:8px;padding:8px 10px">🔒 내 정보는 고정되어 있어 바꾸지 않습니다.${meRows.length ? ` (문서와 다른 값 ${meRows.length}개: ${meRows.map((r) => esc(r.label)).join(", ")})` : ""}</p>`
      : meRows.length || newLinks.length
        ? `<table class="ing-table"><tr><th></th><th>항목</th><th>지금</th><th>문서</th></tr>
            ${meRows.map((r) => `<tr><td><input type="checkbox" data-me-pick="${r.k}" checked></td><td>${esc(r.label)}</td>
              <td class="muted">${esc(r.cur || "—")}</td><td>${esc(r.val)}</td></tr>`).join("")}
            ${newLinks.length ? `<tr><td><input type="checkbox" data-me-pick="links" checked></td><td>링크</td><td class="muted">—</td><td>${newLinks.map((l) => esc(l.url)).join("<br>")}</td></tr>` : ""}
          </table>`
        : `<p class="muted">바뀌는 값이 없습니다.</p>`}

    ${prefRows.length ? `<h4>🎯 희망 조건</h4><table class="ing-table"><tr><th></th><th>항목</th><th>지금</th><th>문서</th></tr>
      ${prefRows.map((r) => `<tr><td><input type="checkbox" data-pref-pick="${r.k}" checked></td><td>${esc(r.label)}</td><td class="muted">${esc(r.cur || "—")}</td><td>${esc(r.val)}</td></tr>`).join("")}</table>` : ""}

    <h4>📋 이력 항목</h4>
    <div class="ing-groups">
      ${groups.map((g, gi) => {
        const d = ingDiff(g.kind, g.cur, g.inc);
        const act = defAction(g);
        return `<div class="ing-group" data-gi="${gi}">
          <div class="ing-group-head">
            <strong>${esc(g.title)}</strong>
            <span class="muted">지금 ${g.cur.length} · 문서 ${g.inc.length}</span>
            <select data-gi="${gi}">
              <option value="replace"${act === "replace" ? " selected" : ""}>문서 내용으로 바꾸기</option>
              <option value="merge"${act === "merge" ? " selected" : ""}>둘 다 남기기</option>
              <option value="keep"${act === "keep" ? " selected" : ""}>지금 것 그대로</option>
            </select>
          </div>
          <div class="ing-diff">
            ${d.added.length ? `<span class="chip ok">+ 추가 ${d.added.length}: ${list(d.added, ingLabel[g.kind])}</span>` : ""}
            ${d.changed.length ? `<span class="chip accent">↻ 갱신 ${d.changed.length}: ${list(d.changed, ingLabel[g.kind])}</span>` : ""}
            <span class="chip warn ing-removed" ${act === "replace" && d.removed.length ? "" : "hidden"}>− 삭제 ${d.removed.length}: ${list(d.removed, ingLabel[g.kind])}</span>
            ${!d.added.length && !d.changed.length ? `<span class="muted">새로 바뀌는 내용 없음</span>` : ""}
          </div>
        </div>`;
      }).join("")}
    </div>
    ${mode === "resume" ? `<label class="check"><input type="checkbox" id="ing-layout" checked>
      이 이력서의 <strong>항목 구성</strong>(순서·추가 항목·빠진 항목)도 그대로 따라가고, 「양식」으로 저장해 두기</label>` : ""}
    ${rsArr(data.notes).length ? `<details class="sub-det"><summary>Claude 메모 ${rsArr(data.notes).length}건</summary><ul>${rsArr(data.notes).map((n) => `<li>${esc(n)}</li>`).join("")}</ul></details>` : ""}
    <p class="notice warn small ing-del-sum" hidden></p>
    <div class="row dlg-actions">
      <button class="btn btn-primary" data-ing="apply" type="button">반영</button>
      <button class="btn btn-ghost" data-ing="cancel" type="button">취소</button>
    </div>`;

  dlg.addEventListener("change", (e) => {
    const sel = e.target.closest("select[data-gi]");
    if (!sel) return;
    const g = groups[Number(sel.dataset.gi)];
    const d = ingDiff(g.kind, g.cur, g.inc);
    const rm = dlg.querySelector(`.ing-group[data-gi="${sel.dataset.gi}"] .ing-removed`);
    rm.hidden = !(sel.value === "replace" && d.removed.length);
    updDel();
  });
  /* 교체로 지워지는 줄 수를 반영 버튼 위에 항상 보여 줍니다 */
  const updDel = () => {
    const n = groups.reduce((sum, g, gi) => sum + (dlg.querySelector(`select[data-gi="${gi}"]`)?.value === "replace" ? ingDiff(g.kind, g.cur, g.inc).removed.length : 0), 0);
    const el = dlg.querySelector(".ing-del-sum");
    el.hidden = !n;
    el.textContent = `「문서 내용으로 바꾸기」를 고른 곳에서 지금 있는 내용 ${n}건이 삭제됩니다. 직접 쓴 내용을 지키려면 그 항목을 「둘 다 남기기」로 바꾸세요. (반영 후 [되돌리기] 가능)`;
  };

  dlg.addEventListener("click", (e) => {
    const b = e.target.closest("[data-ing]");
    if (!b) return;
    if (b.dataset.ing === "cancel") { dlg.close(); return; }

    const picks = [...dlg.querySelectorAll("[data-me-pick]:checked")].map((x) => x.dataset.mePick);
    const meN = locked ? 0 : meApplyCandidate({ ...me, links: newLinks }, picks);
    const before = JSON.stringify({ resume: S.resume, me: S.me });
    let rowsN = 0;
    groups.forEach((g, gi) => {
      const action = dlg.querySelector(`select[data-gi="${gi}"]`).value;
      if (action === "keep") return;
      const d = ingDiff(g.kind, g.cur, g.inc);
      rowsN += d.added.length + d.changed.length + (action === "replace" ? d.removed.length : 0);
      if (RESUME_SECTIONS.some((s) => s.key === g.kind)) {
        S.resume[g.kind] = ingMerge(g.kind, S.resume[g.kind], g.inc, action);
      } else if (g.kind === "custom") {
        let sec = S.resume.custom.find((x) => ingNorm(x.title) === ingNorm(g.customTitle));
        if (!sec) { sec = { id: rsId(), title: g.customTitle, rows: [] }; S.resume.custom.push(sec); }
        sec.rows = ingMerge("custom", sec.rows, g.inc, action);
      }
    });

    dlg.querySelectorAll("[data-pref-pick]:checked").forEach((x) => { const r = prefRows.find((p) => p.k === x.dataset.prefPick); if (r) S.resume.prefs[r.k] = r.val; });
    rsMergeStd(S.resume);
    if (mode === "resume" && dlg.querySelector("#ing-layout")?.checked) {
      rsApplyLayout(data.sectionOrder, inc.custom.map((c) => c.title));
      const base = (names[0] || "첨부 이력서").replace(/\.[^.]+$/, "").slice(0, 24);
      rsSaveLayout(`${base} 양식`);   /* 이 이력서의 항목 구성을 양식으로 저장해 두고 나중에 갈아 끼울 수 있게 */
    }
    S.resume = rsNormalize(S.resume);
    dlg.close();
    save(); render();
    const undoResume = before;
    toast(`✅ 반영했습니다 — 바뀐 항목 ${rowsN}건${locked ? " · 내 정보는 고정 유지" : meN ? ` · 내 정보 ${meN}개 갱신` : ""}`, "ok",
      { label: "되돌리기", run: () => { const u = JSON.parse(undoResume); S.resume = rsNormalize(u.resume); S.me = u.me; meSync(); save(); render(); } });
    if (!locked && meN && !S.me.locked) { S.me.locked = true; save(); render(); toast("🔒 내 정보를 고정했습니다 (상단 [보기]에서 잠금 해제 가능)", "ok"); }
    if (typeof poMarkStale === "function") poMarkStale();
  });
  dlg.addEventListener("close", () => dlg.remove());
  document.body.appendChild(dlg);
  dlg.showModal();
  updDel();
}
