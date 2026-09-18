/* ============================================================
   commute.js — 통근 (집 기준 거리·경로)
   ------------------------------------------------------------
   집 주소는 설정값입니다. 코드에 박지 않습니다 — 이사하면 코드를 고쳐야
   하는 설계는 그 자체로 결함입니다. 여기 적은 내용은 브라우저에만 남고
   내보내는 파일에도 들어가지 않습니다.

   ▶ 통근 시간을 어떻게 아는가
   사람인의 지하철 도구는 "N분 안에 갈 수 있는 역 목록"만 주고 역마다
   몇 분인지는 알려주지 않습니다. 그래서 15·30·45분으로 세 번 물어
   차집합을 냅니다. 15분 목록에 있으면 15분 이내, 30분에는 있는데
   15분에 없으면 15~30분 — 이렇게 역마다 구간이 나옵니다.

   ▶ 경로는 왜 링크인가
   카카오맵의 대중교통 길찾기 도구는 현재 "추천 경로가 없습니다"만
   돌려줍니다(고장). 대신 도보 길찾기가 좌표가 박힌 링크를 주므로,
   그 링크의 by=FOOT 을 by=PUBLICTRANSIT 로 바꾸면 버스·지하철 경로가
   전부 나옵니다. 주소를 다시 입력할 필요가 없습니다.
   ============================================================ */

const CM_SCHEMA = "pf-commute-v1";
/* 구간 경계. 바꾸고 싶으면 여기만 고치면 배지·색·설명이 전부 따라갑니다. */
const CM_BANDS = [15, 30, 45];

function cmHome() {
  S.commute = S.commute || { address: "", station: "", lat: null, lng: null, bands: null, checkedAt: "" };
  return S.commute;
}

/* 역 이름 → 구간 번호(0~3). 모르는 역은 3(범위 밖)으로 봅니다. */
function cmBandOf(stationName) {
  const h = cmHome();
  if (!h.bands || !stationName) return null;
  const name = String(stationName).replace(/역$/, "");
  for (let i = 0; i < CM_BANDS.length; i++) {
    if ((h.bands[i] || []).some((s) => String(s).replace(/역$/, "") === name)) return i;
  }
  return 3;
}

function cmBandLabel(i) {
  if (i === null) return "";
  if (i === 0) return `${CM_BANDS[0]}분 이내`;
  if (i === 3) return `${CM_BANDS[2]}분 초과`;
  return `${CM_BANDS[i - 1]}~${CM_BANDS[i]}분`;
}

/* 공고 카드 등에 붙일 배지 한 조각 */
function cmBadgeHTML(stationName) {
  const i = cmBandOf(stationName);
  if (i === null) return "";
  return `<span class="cm-badge cm-b${i}" title="집에서 ${esc(cmBandLabel(i))}">🚇 ${esc(cmBandLabel(i))}</span>`;
}

/* 카카오맵 대중교통 경로 링크. 좌표가 있으면 정확하게, 없으면 이름만으로 엽니다. */
function cmRouteUrl(destName, destLat, destLng) {
  const h = cmHome();
  const q = (k, v) => `${k}=${encodeURIComponent(v)}`;
  const parts = [q("sn", h.address || h.station || "집"), q("en", destName || "회사")];
  if (h.lat && h.lng) parts.push(q("sp", `${h.lat},${h.lng}`));
  if (destLat && destLng) parts.push(q("ep", `${destLat},${destLng}`));
  parts.push("by=PUBLICTRANSIT");
  return `https://m.map.kakao.com/scheme/route?${parts.join("&")}`;
}

/* 공고 검색 프롬프트에 끼워 넣을 통근 조건.
   통근 기능과 공고 검색이 따로 놀지 않게 하는 연결 고리입니다 —
   검색 단계에서 이미 걸러 오면, 화면에서 거르는 것보다 결과가 훨씬 낫습니다.
   집 설정이 없으면 빈 문자열을 돌려주어 프롬프트가 그대로 동작합니다. */
function cmSearchHint() {
  const h = cmHome();
  if (!h.station) return "";
  const lines = [`- 집에서 가까운 역: ${h.station} (통근 시간이 이 사람에게 가장 중요한 조건입니다)`];
  lines.push(`- search_subway_info 를 stationName="${h.station}", maxTimeMinutes=${CM_BANDS[1]}, maxTransfers=1 로 호출해 통근 범위 안의 역 코드를 얻고, search_saramin_jobs 의 subwayCodes 에 넣어 그 범위 안의 공고를 우선 찾아 주세요.`);
  lines.push(`- 범위 안에서 충분히 못 찾으면 maxTimeMinutes=${CM_BANDS[2]} 로 넓혀서 다시 찾습니다.`);
  return lines.join("\n");
}

/* ---------- 집 위치·통근 범위 알아내기 ---------- */
function cmHomePrompt(address) {
  return `아래 주소를 기준으로 통근 정보를 알아봐 주세요.

집 주소: ${address}

1. 카카오맵 SearchPlaceByKeywordOpen 으로 이 주소를 찾아 정확한 지번/도로명 주소를 확인하세요.
2. 카카오맵 GetWalkDirections 로 이 주소에서 가장 가까운 지하철역까지의 도보 경로를 구하고,
   결과 링크에 들어 있는 출발 좌표(sp=위도,경도)를 그대로 읽어 주세요.
3. 가장 가까운 지하철역 이름을 정하세요.
4. 사람인 search_subway_info 를 그 역 이름으로 ${CM_BANDS.map((m) => `maxTimeMinutes=${m}`).join(", ")} 각각 호출하세요
   (maxTransfers 는 1). 각 호출에서 받은 items 의 subwayName 을 전부 모으세요.

아래 형식의 JSON 만 출력하세요. 설명이나 코드블록 표시는 붙이지 마세요.

{
  "schema": "${CM_SCHEMA}",
  "address": "확인된 정확한 주소",
  "station": "가장 가까운 역 이름",
  "lat": 37.123456,
  "lng": 127.123456,
  "within": {
${CM_BANDS.map((m) => `    "${m}": ["역이름", "..."]`).join(",\n")}
  }
}`;
}

async function cmDetect() {
  const h = cmHome();
  const addr = (h.address || "").trim();
  if (!addr) { toast("집 주소를 먼저 입력하세요.", "warn"); return; }
  cmBusy = true; render();
  try {
    const data = await clRun({
      title: "집 위치·통근 범위 확인",
      prompt: cmHomePrompt(addr),
      saramin: true,
      expect: CM_SCHEMA,
    });
    if (!data) return;                        /* 사용자가 취소 */
    const w = data.within || {};
    /* 안쪽 구간에 이미 있는 역은 바깥 구간에서 빼서 겹치지 않게 합니다 */
    const seen = new Set();
    h.bands = CM_BANDS.map((m) => {
      const list = (w[String(m)] || w[m] || []).filter((s) => {
        const k = String(s).replace(/역$/, "");
        if (seen.has(k)) return false;
        seen.add(k); return true;
      });
      return list;
    });
    if (data.address) h.address = data.address;
    h.station = data.station || h.station;
    h.lat = data.lat ?? h.lat;
    h.lng = data.lng ?? h.lng;
    h.checkedAt = todayStr();
    save();
    toast(`통근 범위를 새로 계산했습니다 — ${h.station} 기준`, "ok");
  } catch (e) {
    toast(`통근 범위 계산에 실패했습니다: ${e.message}`, "warn");
  } finally {
    cmBusy = false; render();
  }
}

let cmBusy = false;

/* ---------- 화면 ---------- */
function renderCommute() {
  const h = cmHome();
  const total = h.bands ? h.bands.reduce((n, b) => n + b.length, 0) : 0;

  return `
    <div class="view-head">
      <h2>통근</h2>
      <p class="muted">집에서 얼마나 걸리는지를 공고 판단의 1급 기준으로 씁니다.</p>
    </div>

    <section class="card">
      <div class="card-head"><h3>집 위치</h3>
        ${h.checkedAt ? `<span class="chip">${esc(h.checkedAt)} 확인</span>` : ""}</div>
      <label class="field">
        <span>집 주소 — 동까지만 적어도 됩니다</span>
        <input type="text" data-bind="commute.address" value="${esc(h.address)}"
          placeholder="예: 서울 성북구 동소문로" />
      </label>
      <p class="muted small" style="margin:-6px 0 12px">
        🔒 이 주소는 브라우저에만 저장됩니다. 내보내는 파일과 공개 저장소에는 들어가지 않습니다.
        이사하면 여기만 고치면 됩니다.
      </p>
      <div class="row wrap">
        <button class="btn btn-primary" type="button" data-act="cm-detect" ${cmBusy ? "disabled" : ""}>
          ${cmBusy ? "확인 중…" : h.bands ? "통근 범위 다시 계산" : "통근 범위 계산"}
        </button>
        ${h.station ? `<span class="chip accent">가장 가까운 역 · ${esc(h.station)}</span>` : ""}
        ${h.lat ? `<span class="chip">좌표 확인됨</span>` : ""}
      </div>
    </section>

    ${h.bands ? `
    <section class="card">
      <div class="card-head"><h3>통근 범위</h3>
        <span class="muted small">환승 1회 이하 · 역 ${total}곳</span></div>
      <div class="cm-legend">
        ${CM_BANDS.map((m, i) => `
          <div class="cm-band">
            <span class="cm-badge cm-b${i}">🚇 ${esc(cmBandLabel(i))}</span>
            <strong class="cm-band-n">${h.bands[i].length}</strong>
            <span class="muted small">곳</span>
          </div>`).join("")}
      </div>
      ${h.bands.map((list, i) => list.length ? `
        <details class="cm-list">
          <summary><span class="cm-dot cm-b${i}"></span>${esc(cmBandLabel(i))} — ${list.length}곳</summary>
          <p class="muted small">${list.map((s) => esc(s)).join(" · ")}</p>
        </details>` : "").join("")}
      <p class="muted small" style="margin-top:12px">
        채용공고의 근무지가 이 역들 안에 있으면 공고 목록에 배지가 붙습니다.
      </p>
    </section>` : `
    <section class="card">
      <p class="empty">아직 통근 범위를 계산하지 않았습니다. 주소를 넣고 [통근 범위 계산]을 누르세요.</p>
    </section>`}

    <section class="card">
      <div class="card-head"><h3>경로 열어 보기</h3></div>
      <p class="muted small" style="margin-bottom:10px">
        회사 이름이나 주소를 넣으면 집에서 거기까지 가는 버스·지하철 경로가 카카오맵에서 바로 열립니다.
        출발지를 다시 칠 필요가 없습니다.
      </p>
      <div class="row wrap">
        <input type="text" id="cm-dest" placeholder="예: 카카오 판교 아지트 / 서울 강남구 테헤란로 152" />
        <button class="btn" type="button" data-act="cm-open">경로 보기 ↗</button>
      </div>
    </section>`;
}

function commuteAction(act, btn) {
  if (act === "cm-detect") { cmDetect(); return true; }
  if (act === "cm-open") {
    const dest = ($("#cm-dest") || {}).value || "";
    if (!dest.trim()) { toast("도착지를 입력하세요.", "warn"); return true; }
    window.open(cmRouteUrl(dest.trim()), "_blank", "noopener");
    return true;
  }
  return false;
}

/* 공고 상세에 붙는 통근 한 줄. 배지 + 실제 경로로 가는 링크.
   링크는 집 좌표를 이미 들고 있으므로 출발지를 다시 칠 필요가 없습니다 —
   원래 네이버지도에 출발·도착을 매번 입력하던 일을 없애는 것이 목적입니다. */
function cmCommuteRowHTML(p) {
  const h = cmHome();
  if (!h.address && !h.station) return "";
  const where = p.station || p.location || p.company;
  if (!where) return "";
  const band = cmBandOf(p.station || p.location);
  return `
    <div class="cm-row">
      ${band !== null ? cmBadgeHTML(p.station || p.location) : `<span class="cm-badge cm-b3">🚇 범위 밖</span>`}
      <span class="muted small">집(${esc(h.station || h.address)}) 기준</span>
      <a class="btn btn-sm" href="${esc(cmRouteUrl(where))}" target="_blank" rel="noopener noreferrer">경로 보기 ↗</a>
    </div>`;
}
