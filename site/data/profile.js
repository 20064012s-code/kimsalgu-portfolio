/*
 * 김살구툰 포트폴리오 — 직접 입력 데이터
 * ------------------------------------------------------------
 * 이 파일만 고치면 사이트 내용이 바뀝니다. (서버·API 없이도 동작)
 * - 값이 없으면 null 또는 "" 로 두세요. 공개 화면에서 자동으로 숨겨집니다.
 * - 날짜는 "YYYY-MM-DD" 형식.
 * - Instagram API 자동 연동 값(data/stats.js)이 있으면 팔로워 수·30일 조회수·30일 도달 계정 수·
 *   팔로워 성별/연령은 자동 값이 우선 표시되고, 없으면 여기 값이 표시됩니다.
 */
window.SALGU_PROFILE = {
  name: "김살구툰",
  handle: "kimsalgu_toon",
  instagramUrl: "https://www.instagram.com/kimsalgu_toon/",
  dmUrl: "https://ig.me/m/kimsalgu_toon",
  email: "kimsalgutoon@gmail.com",

  // 첫 화면 소개 (자유롭게 수정). 큰 제목은 30일 조회수로 자동 생성됩니다.
  eyebrow: "일상 공감 인스타툰 김살구툰",
  intro: "평범한 하루 속 ‘이거 완전 내 얘기’ 싶은 순간을 캐러셀·릴스로 그립니다.",

  // 첫 화면 오른쪽 대표 이미지 (대표 인스타툰 표지나 첫 컷)
  // 예: { src: "assets/covers/hero.jpg", alt: "OO편 첫 컷", url: "https://www.instagram.com/p/..." }
  // 비워 두면 캐릭터 이미지만 보여 줍니다. (캐릭터 이미지는 첫 화면에만 사용)
  heroCover: { src: "", alt: "", url: "" },
  character: { src: "assets/character.png", alt: "김살구툰 캐릭터 살구가 손을 흔드는 모습" },

  // 첫 화면 핵심 수치 (직접 입력값)
  stats: {
    followers: { value: 7804, asOf: "2026-11-06" },
    // 최근 30일 도달 계정 수 — 인사이트의 ‘Viewers’ 값 = 중복 제거된 계정 수
    reach30d: { value: 1743060, periodStart: "2026-09-23", periodEnd: "2026-10-22" },
  },

  // 인사이트 30일 개요 화면
  monthlyReport: {
    title: "최근 30일 계정 성과",
    periodStart: "2026-09-23",
    periodEnd: "2026-10-22",
    views: 7299088, // 조회수 (같은 계정이 여러 번 본 것 포함)
    viewers: 1743060, // 도달 계정 (중복 제거)
    netFollowers: 5862,
    interactions: null, // 캡처에서 잘려 보이지 않음 → 값을 알려주면 입력
    followerViewShare: 1.6, // 조회수 중 팔로워 비중(%)
    nonFollowerViewShare: 98.4, // 조회수 중 비팔로워 비중(%)
    byType: [
      { label: "릴스", views: 4700000, display: "470만" },
      { label: "게시물", views: 2600000, display: "260만" },
    ],
    screenshot: { src: "assets/insight-30days.webp", alt: "인스타그램 인사이트 30일 개요 화면 캡처" },
  },

  // 팔로워 성별·연령 (인사이트 ‘오디언스’ 탭)
  audience: {
    asOf: "",
    gender: [
      { label: "여성", pct: 72.2 },
      { label: "남성", pct: 27.8 },
    ],
    age: [
      { label: "13-17", pct: 2.8 },
      { label: "18-24", pct: 19.5 },
      { label: "25-34", pct: 40.0 },
      { label: "35-44", pct: 28.5 },
      { label: "45-54", pct: 7.4 },
      { label: "55-64", pct: 1.4 },
      { label: "65+", pct: 0.3 },
    ],
  },

  // 대표 콘텐츠 (실제로 올린 인스타툰·릴스, 최대 3개 노출)
  // API로 가져온 ‘성과 좋은 캐러셀’이 있으면 그 카드가 앞에 오고, 남는 자리에 아래 카드가 들어갑니다.
  // metrics 키: views(조회수), reach(도달), likes, comments, saves, shares, follows(게시물로 늘어난 팔로워)
  // highlight: 강조할 지표 키. 비우면 도달 → 조회수 순으로 자동 선택.
  featured: [
    // {
    //   type: "캐러셀",            // 캐러셀 · 릴스
    //   title: "월요일 아침 알람 5개 끄는 법",
    //   url: "https://www.instagram.com/p/XXXXXXXX/",
    //   cover: "assets/covers/monday.jpg",
    //   postedAt: "2026-10-01",
    //   summary: "출근 전쟁을 과장 없이 그린 공감 에피소드",
    //   metrics: { views: 856000, reach: 410000, saves: 12000, shares: 8300 },
    //   highlight: "reach",
    //   asOf: "2026-11-06",
    // },
  ],

  // 제공 가능한 협업 포맷 (알려주시면 채워 넣을 자리, 비어 있으면 숨김)
  // 예: { name: "캐러셀 인스타툰", detail: "8~10컷 · 제품 자연 노출 · 2차 활용 협의", note: "" }
  formats: [],
};
