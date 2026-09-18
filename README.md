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
