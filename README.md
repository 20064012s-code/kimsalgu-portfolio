# 김살구툰 브랜드 협업 포트폴리오

브랜드에 DM·이메일로 보낼 때 첨부하는 포트폴리오 사이트입니다.

```
site/                 ← 공개되는 사이트 (이 폴더만 배포됨)
  index.html
  assets/             ← 스타일, 스크립트, 캐릭터(배경 제거), 인사이트 캡처
  data/profile.js     ← ✏️ 직접 입력하는 수치·콘텐츠 (여기만 고치면 됨)
  data/stats.js       ← 🤖 Instagram API 자동 갱신 값 (직접 수정 X)
  data/media/         ← 🤖 자동으로 받아 온 캐러셀 표지
config/publish.json   ← 공개할 지표 on/off
scripts/sync-instagram.mjs
.github/workflows/sync-and-deploy.yml
```

## 1. API 없이 쓰기 (지금 바로)

- `site/index.html` 을 더블클릭하면 그대로 열립니다 (서버 불필요).
- 수치·대표 콘텐츠·협업 포맷은 `site/data/profile.js` 에서 수정합니다.
- 값이 `null` 이거나 빈 칸이면 공개 화면에서 숨겨집니다.
- 대표 콘텐츠 표지 이미지는 `site/assets/covers/` 에 넣고 경로를 적으면 됩니다.

## 2. Instagram 자동 연동 (하루 한 번)

토큰은 GitHub Secrets에만 저장되고 GitHub Actions(서버)에서만 사용됩니다.
방문자에게는 `config/publish.json` 에서 `true` 로 둔 지표만 `stats.js` 로 공개됩니다.

### 필요한 것
1. **Instagram 프로페셔널 계정** (크리에이터 또는 비즈니스)
2. **Meta 개발자 앱** — developers.facebook.com → 앱 만들기 → 제품 *Instagram* → **Instagram 로그인을 통한 API 설정**
   - 권한: `instagram_business_basic`, `instagram_business_manage_insights`
   - 본인 계정만 쓰므로 앱 검수 없이 개발 모드로 충분합니다 (본인 계정을 Instagram 테스터로 추가).
   - 앱 대시보드에서 계정 연결 → **장기 액세스 토큰(60일)** 발급
3. **GitHub 저장소** (무료 Pages는 공개 저장소 필요 — 토큰은 Secret이라 공개되지 않음)
   - Settings → Pages → Source: **GitHub Actions**
   - Settings → Secrets and variables → Actions
     - `IG_ACCESS_TOKEN` : 위에서 받은 장기 토큰
     - `GH_PAT` (권장) : Fine-grained token, 이 저장소의 *Secrets: Read and write* 권한 → 매일 토큰을 자동 연장해 60일 만료를 막습니다

### 동작
- 매일 09:00(KST) + 수동 실행(Actions 탭 → Run workflow) + `main` 푸시 시 배포
- 팔로워 수, 30일 조회수, 30일 도달 계정 수, 팔로워 성별·연령, 성과 상위 캐러셀(최대 3개)을 가져옵니다.
- **30일 도달 계정 수**: 일별 값을 더하지 않습니다. 30일 기간의 `total_value` 를 받고, 그 값이 일별 합계보다 작아 *중복 제거된 값으로 확인될 때만* 공개합니다. 확인이 안 되면 `profile.js` 의 직접 입력값이 표시됩니다.
- API가 실패하면 기존 값/직접 입력값으로 그대로 배포됩니다.

### 로컬에서 테스트
```bash
IG_ACCESS_TOKEN=발급받은토큰 node scripts/sync-instagram.mjs
```
