/* ============================================================
   calendar.js — ③ 일정
   ------------------------------------------------------------
   공고의 서류 마감일 + 공고마다 추가한 일정(지원 완료·서류 발표·코테·면접·최종 발표)을 달력으로 모읍니다.
   - ★ 관심 공고만 보기
   - 다가오는 14일 목록 (D-day)
   - .ics 로 내보내 구글·애플 캘린더에 넣기
   ============================================================ */

let calMonth = null;          /* "YYYY-MM" */
let calStarOnly = false;
let calDay = null;            /* 휴대폰에서 누른 날 */

const calPad = (n) => String(n).padStart(2, "0");
const calKey = (d) => `${d.getFullYear()}-${calPad(d.getMonth() + 1)}-${calPad(d.getDate())}`;

function calEvents() {
  const out = [];
  S.postings.forEach((p) => {
    if (calStarOnly && !p.star) return;
    const name = p.company || p.title || "공고";
    if (p.deadline && !PO_DONE.includes(p.stage)) out.push({ p, type: "마감", date: p.deadline, time: "", memo: p.title, name });
    p.events.forEach((e) => out.push({ p, ...e, name }));
  });
  return out.sort((a, b) => (a.date + (a.time || "99")).localeCompare(b.date + (b.time || "99")));
}

function calendarAction(act, btn) {
  if (!String(act).startsWith("cal-")) return false;
  if (act === "cal-prev" || act === "cal-next") {
    const [y, m] = calMonth.split("-").map(Number);
    const d = new Date(y, m - 1 + (act === "cal-next" ? 1 : -1), 1);
    calMonth = `${d.getFullYear()}-${calPad(d.getMonth() + 1)}`;
  }
  if (act === "cal-today") calMonth = todayStr().slice(0, 7);
  if (act === "cal-star") calStarOnly = !calStarOnly;
  if (act === "cal-day") calDay = calDay === btn.dataset.day ? null : btn.dataset.day;
  if (act === "cal-ics") { calExportIcs(); return true; }
  if (act === "cal-add") {
    const box = btn.closest(".ev-add");
    const p = poGet(box.querySelector("[name=posting]").value);
    const date = box.querySelector("[name=date]").value;
    if (!p || !date) { toast("공고와 날짜를 고르세요.", "warn"); return true; }
    p.events.push({ id: uid("ev"), type: box.querySelector("[name=type]").value, date, time: box.querySelector("[name=time]").value, memo: box.querySelector("[name=memo]").value.trim() });
    save();
    toast(`📅 ${p.company} 일정을 추가했습니다`, "ok");
  }
  render();
  return true;
}

function renderCalendar() {
  if (!calMonth) calMonth = todayStr().slice(0, 7);
  const [y, m] = calMonth.split("-").map(Number);
  const first = new Date(y, m - 1, 1);
  const start = new Date(first); start.setDate(1 - first.getDay());
  const today = todayStr();
  const events = calEvents();
  const byDay = {};
  events.forEach((e) => { (byDay[e.date] = byDay[e.date] || []).push(e); });

  const cells = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start); d.setDate(start.getDate() + i);
    const k = calKey(d);
    const list = byDay[k] || [];
    cells.push(`
      <div class="cal-cell${d.getMonth() !== m - 1 ? " out" : ""}${k === today ? " today" : ""}">
        <button class="cal-day" data-act="cal-day" data-day="${k}" type="button" aria-label="${k} 일정 ${list.length}개">${d.getDate()}</button>
        ${list.slice(0, 3).map((e) => `<a class="cal-ev ev-${PO_EVENT_TYPES.indexOf(e.type)}" href="#/postings/${esc(e.p.id)}" title="${esc(`${e.type} · ${e.name}${e.time ? " " + e.time : ""}${e.memo ? " · " + e.memo : ""}`)}">${e.p.star ? "★" : ""}${esc(e.type === "마감" ? "마감" : e.type)} ${esc(e.name)}</a>`).join("")}
        ${list.length > 3 ? `<span class="muted small">+${list.length - 3}</span>` : ""}
      </div>`);
    if (i >= 34 && d.getMonth() !== m - 1 && i % 7 === 6) break;
  }

  const until = new Date(); until.setDate(until.getDate() + 14);
  const upcoming = events.filter((e) => e.date >= today && e.date <= calKey(until));
  const overdue = S.postings.filter((p) => p.deadline && p.deadline < today && ["검토 중", "지원 예정"].includes(p.stage));
  const postings = S.postings.filter((p) => !PO_DONE.includes(p.stage));

  return `
  <div class="view-head">
    <h2>④ 일정</h2>
    <p class="muted">공고 마감일과 전형 일정을 한눈에 봅니다. 일정은 공고 상세나 아래에서 추가합니다.</p>
  </div>

  <div class="cal-layout">
    <section class="card cal-card">
      <div class="cal-bar">
        <div class="row">
          <button class="btn btn-sm" data-act="cal-prev" type="button" aria-label="이전 달">‹</button>
          <strong class="cal-title">${y}년 ${m}월</strong>
          <button class="btn btn-sm" data-act="cal-next" type="button" aria-label="다음 달">›</button>
          <button class="btn btn-sm btn-ghost" data-act="cal-today" type="button">오늘</button>
        </div>
        <div class="row">
          <button class="chip ${calStarOnly ? "accent" : ""}" data-act="cal-star" type="button">★ 관심 공고만</button>
          <button class="btn btn-sm" data-act="cal-ics" type="button" title="구글·애플 캘린더로 가져오기">.ics 내보내기</button>
        </div>
      </div>
      <div class="cal-grid" role="grid">
        ${["일", "월", "화", "수", "목", "금", "토"].map((w, i) => `<div class="cal-wd${i === 0 ? " sun" : i === 6 ? " sat" : ""}">${w}</div>`).join("")}
        ${cells.join("")}
      </div>
      ${calDay ? `<div class="cal-daylist"><strong>${esc(calDay)}</strong>${(byDay[calDay] || []).map((e) => `
        <a href="#/postings/${esc(e.p.id)}"><span class="cal-ev ev-${PO_EVENT_TYPES.indexOf(e.type)}">${esc(e.type)}</span> ${e.p.star ? "★ " : ""}${esc(e.name)} <span class="muted small">${esc(e.time)} ${esc(e.memo)}</span></a>`).join("") || `<span class="muted small">일정 없음</span>`}</div>` : ""}
      <div class="chips cal-legend">${PO_EVENT_TYPES.map((t, i) => `<span class="cal-ev ev-${i}">${t}</span>`).join("")}</div>
    </section>

    <aside>
      <section class="card">
        <h3>다가오는 2주</h3>
        ${upcoming.length ? `<ul class="agenda">${upcoming.map((e) => {
          const d = dday(e.date);
          return `<li><span class="chip ${d.kind}">${esc(d.text)}</span>
            <a href="#/postings/${esc(e.p.id)}"><span class="cal-ev ev-${PO_EVENT_TYPES.indexOf(e.type)}">${esc(e.type)}</span> ${e.p.star ? "★ " : ""}<strong>${esc(e.name)}</strong></a>
            <div class="muted small">${esc(e.date)} ${esc(e.time)} ${esc(e.type === "마감" ? e.p.stage : e.memo)}</div></li>`;
        }).join("")}</ul>` : `<p class="muted">2주 안에 일정이 없습니다.</p>`}
        ${overdue.length ? `<p class="notice warn small">마감이 지났는데 아직 「${esc(overdue[0].stage)}」인 공고 ${overdue.length}개 — 지원했다면 단계를 바꾸고, 아니면 「보류」로 정리하세요.</p>` : ""}
      </section>

      <section class="card">
        <h3>일정 추가</h3>
        ${postings.length ? `<div class="ev-add stack">
          <select name="posting" aria-label="공고">${postings.map((p) => `<option value="${esc(p.id)}">${p.star ? "★ " : ""}${esc(p.company || p.title)}</option>`).join("")}</select>
          <div class="row"><select name="type" aria-label="종류">${PO_EVENT_TYPES.filter((t) => t !== "마감").map((t) => `<option>${t}</option>`).join("")}</select>
            <input type="date" name="date" aria-label="날짜"><input type="time" name="time" aria-label="시간"></div>
          <input type="text" name="memo" placeholder="메모 (장소·준비물)">
          <button class="btn btn-primary btn-sm" data-act="cal-add" type="button">추가</button>
        </div>` : `<p class="muted">먼저 ② 채용공고에 공고를 넣으세요.</p>`}
      </section>
    </aside>
  </div>`;
}

function calExportIcs() {
  const events = calEvents();
  if (!events.length) { toast("내보낼 일정이 없습니다.", "warn"); return; }
  const escIcs = (s) => String(s || "").replace(/\\/g, "\\\\").replace(/\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
  const stamp = new Date().toISOString().replace(/[-:]/g, "").slice(0, 15) + "Z";
  const lines = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//my-job-portfolio//KO", "CALSCALE:GREGORIAN"];
  events.forEach((e, i) => {
    const d = e.date.replace(/-/g, "");
    lines.push("BEGIN:VEVENT", `UID:${e.p.id}-${e.id || "deadline"}@job-portfolio`, `DTSTAMP:${stamp}`);   /* 다시 가져와도 중복되지 않게 고정 */
    if (e.time) {
      const [hh, mm] = e.time.split(":");
      lines.push(`DTSTART;TZID=Asia/Seoul:${d}T${hh}${mm}00`, `DURATION:PT1H`);
    } else {
      const next = new Date(`${e.date}T00:00:00`); next.setDate(next.getDate() + 1);
      lines.push(`DTSTART;VALUE=DATE:${d}`, `DTEND;VALUE=DATE:${calKey(next).replace(/-/g, "")}`);
    }
    lines.push(`SUMMARY:${escIcs(`[${e.type}] ${e.name}`)}`, `DESCRIPTION:${escIcs([e.p.title, e.memo, e.p.url].filter(Boolean).join("\n"))}`, "END:VEVENT");
  });
  lines.push("END:VCALENDAR");
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([lines.join("\r\n")], { type: "text/calendar;charset=utf-8" }));
  a.download = `취업일정_${todayStr()}.ics`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
  toast(`📅 일정 ${events.length}개를 .ics 로 받았습니다`, "ok");
}
