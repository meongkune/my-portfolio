# 내 취업 포트폴리오

JD 기반 취업 준비 웹앱. 이력서 작성 → 채용공고 적합도 → 자소서 → 일정 → 면접 준비까지 한 곳에서.

빌드 도구 없는 정적 앱입니다. `index.html` 을 그대로 열어도 되고, 로컬 서버로 띄워도 됩니다.

```bash
python -m http.server 4173
```

## 구성

| 파일 | 역할 |
| --- | --- |
| `app.js` | 코어 — 상태·저장·화면 전환·이벤트·백업 |
| `data.js` | 처음 열었을 때의 빈 데이터 틀 |
| `me.js` | 내 정보 |
| `resume.js` | ① 이력서 편집·미리보기·docx 내보내기 |
| `ingest.js` | 이력서/자소서 파일 읽어서 자동 채우기 |
| `postings.js` | ② 채용공고·적합도 (사람인) |
| `cover.js` | ③ 자소서 |
| `calendar.js` | ④ 일정 |
| `interview.js` | ⑤ 면접 준비 |
| `claude.js` | Claude 연동 |
| `app.css` | 전체 스타일 |

## 주의

데이터는 브라우저(localStorage)에만 저장됩니다. `data.js` 에 실명·연락처를 적어 배포하지 마세요.

## 서버 함수 설정 (복사-붙여넣기 없애기)

`api/` 안의 함수는 Vercel 이 서버에서 실행합니다. 키는 저장소에 넣지 않고
Vercel 환경변수에만 둡니다.

**Vercel → 프로젝트 → Settings → Environment Variables** 에서 추가하세요.

| 이름 | 어디서 받나 | 비용 |
| --- | --- | --- |
| `SARAMIN_KEY` | [oapi.saramin.co.kr](https://oapi.saramin.co.kr) 앱 등록 후 발급 | 무료 |
| `KAKAO_REST_KEY` | [developers.kakao.com](https://developers.kakao.com) 앱 만들기 → REST API 키 | 무료 |

추가한 뒤에는 한 번 재배포해야 반영됩니다.

| 엔드포인트 | 하는 일 |
| --- | --- |
| `GET /api/jobs?keywords=백엔드` | 사람인 공고 검색 |
| `GET /api/place?q=서울 강남구&homeLat=&homeLng=` | 주소·장소 → 좌표, 집에서의 직선거리 |

키를 넣지 않아도 앱은 동작합니다 — 해당 기능만 "키가 없다"고 안내합니다.

### 왜 유료 API 는 두지 않았나

이 사이트는 공개 상태입니다. 서버에 요금이 나가는 키를 두면 주소를 아는
누구나 요금을 태울 수 있습니다. 사람인·카카오는 무료 할당량제라 악용당해도
잃는 것은 돈이 아니라 그날치 할당량입니다. 출처 검사와 호출 제한(`api/_guard.js`)
으로 그 할당량도 지킵니다.

Claude API 처럼 과금되는 키를 넣게 되면 Vercel Authentication 을 켜야 합니다.
