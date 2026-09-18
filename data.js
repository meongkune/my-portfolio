/* data.js — 처음 열었을 때의 빈 틀. 실제 내용은 자동 저장됩니다 (브라우저 + 로컬 모드면 data/state.json).
   ⚠ 이 파일에 실명·연락처를 적어 배포하지 마세요. */
const SEED_DATA = {
  meta: { version: "2", updatedAt: "" },
  me: { locked: false, name: "", nameEn: "", birth: "", phone: "", email: "", address: "", desiredJob: "", headline: "", links: [] },
  resume: {
    education: [], career: [], projects: [], skills: [], certificates: [], languages: [], awards: [], strengths: [], extra: [],
    custom: [], layout: { order: [], hidden: [] },
    prefs: { level: "신입", years: "", regions: "", employment: "", salary: "", industries: "", avoid: "" }
  },
  postings: [],
  writingRules: null,
  coverLibrary: []
};
