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

/* 통근 기준이 잡혀 있는가 — 잡히기 전에는 통근 관련 UI 를 아예 내보이지
   않습니다. 쓸 수 없는 버튼을 보여 주는 것이 없는 것보다 나쁩니다. */
function cmReady() {
  const h = cmHome();
  return !!(h.station && h.bands);
}

/* 공고가 통근 범위(마지막 구간) 안에 있는가 */
function cmWithin(p) {
  const i = cmBandOf(p.station || p.location);
  return i !== null && i < 3;
}

/* 정렬용 — 작을수록 가깝습니다. 모르는 곳은 맨 뒤로 보냅니다. */
function cmSortKey(p) {
  const i = cmBandOf(p.station || p.location);
  return i === null ? 9 : i;
}

/* 공고 화면 맨 위에 붙는 통근 기준 줄.
   통근을 별도 메뉴로 떼어 두니 공고와 따로 노는 느낌이 났습니다.
   집 기준은 공고를 볼 때 쓰는 것이므로 공고 화면에서 바로 고칩니다. */
function cmStripHTML() {
  const h = cmHome();
  if (!cmReady()) {
    return `
      <section class="card cm-strip">
        <div class="row wrap">
          <span class="cm-badge cm-b3">🚇</span>
          <strong>통근 기준을 정하면 공고마다 집에서 얼마나 걸리는지 표시됩니다</strong>
          <input type="text" data-bind="commute.address" value="${esc(h.address)}" placeholder="집 주소 — 예: 서울 성북구 동소문로" style="flex:1;min-width:200px" />
          <button class="btn btn-primary btn-sm" type="button" data-act="cm-detect" ${cmBusy ? "disabled" : ""}>
            ${cmBusy ? "확인 중…" : "통근 범위 계산"}
          </button>
        </div>
        <p class="muted small" style="margin-top:8px">🔒 브라우저에만 저장됩니다. 한 번만 하면 되고 이사할 때만 다시 합니다.</p>
      </section>`;
  }
  const counts = h.bands.map((b) => b.length);
  return `
    <details class="card cm-strip">
      <summary class="row wrap" style="cursor:pointer">
        <span class="cm-badge cm-b0">🚇 ${esc(h.station)}</span>
        <span class="muted small">기준 · ${CM_BANDS[0]}분 ${counts[0]}곳 · ${CM_BANDS[1]}분 ${counts[1]}곳 · ${CM_BANDS[2]}분 ${counts[2]}곳</span>
        <span class="muted small" style="margin-left:auto">고치기 ▾</span>
      </summary>
      <div class="row wrap" style="margin-top:12px">
        <input type="text" data-bind="commute.address" value="${esc(h.address)}" placeholder="집 주소" style="flex:1;min-width:200px" />
        <button class="btn btn-sm" type="button" data-act="cm-detect" ${cmBusy ? "disabled" : ""}>
          ${cmBusy ? "확인 중…" : "다시 계산"}
        </button>
      </div>
      ${h.bands.map((list, i) => list.length ? `
        <details class="cm-list">
          <summary><span class="cm-dot cm-b${i}"></span>${esc(cmBandLabel(i))} — ${list.length}곳</summary>
          <p class="muted small">${list.map((s) => esc(s)).join(" · ")}</p>
        </details>` : "").join("")}
    </details>`;
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

/* 화면은 공고 쪽(cmStripHTML)에 있습니다. 통근만 따로 보는 화면은 두지 않습니다 —
   집 기준은 공고를 볼 때 쓰는 값이지 그 자체로 들여다볼 것이 아닙니다. */

function commuteAction(act, btn) {
  if (act === "cm-detect") { cmDetect(); return true; }
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
