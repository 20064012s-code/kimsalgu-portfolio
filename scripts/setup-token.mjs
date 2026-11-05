#!/usr/bin/env node
/**
 * 한 번만 실행하는 토큰 설정 도우미 (내 컴퓨터 터미널에서 실행)
 *
 *   node scripts/setup-token.mjs
 *
 * 1. Meta 대시보드에서 받은 토큰(EAA… 또는 IG…)을 숨김 입력으로 받습니다.
 * 2. EAA… 토큰이면 App ID / App secret 으로 장기 토큰으로 바꾼 뒤,
 *    Instagram 계정이 연결된 Facebook 페이지의 ‘만료 없는 페이지 토큰’을 찾습니다.
 * 3. 팔로워 수·30일 도달로 실제 호출을 확인하고, GitHub Secrets
 *    (IG_ACCESS_TOKEN, IG_USER_ID)에 저장합니다.
 *
 * 토큰·App secret 은 화면과 파일 어디에도 남기지 않습니다. (App secret 은 저장하지 않음)
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import readline from "node:readline";

const VERSION = process.env.IG_API_VERSION || "v27.0";
const HANDLE = process.env.IG_HANDLE || "kimsalgu_toon";
const GH = existsSync("C:\\Program Files\\GitHub CLI\\gh.exe") ? "C:\\Program Files\\GitHub CLI\\gh.exe" : "gh";
const DAY = 86400;

// 입력창 하나를 계속 사용 (Windows에서 여러 번 열고 닫으면 붙여 넣은 글자가 셸로 새어 나감)
const DEFAULT_APP_ID = process.env.META_APP_ID || "998439419986518";
const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
let muted = false;
rl._writeToOutput = (s) => { if (!muted) rl.output.write(s); };
function ask(question, hidden = false) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      muted = false;
      if (hidden) rl.output.write("\n");
      resolve(answer.replace(/\s+/g, ""));
    });
    muted = hidden; // 질문 문구는 이미 출력됐고, 이후 입력만 숨김
  });
}
function finish(code) {
  rl.close();
  process.exitCode = code;
}

async function call(host, endpoint, params) {
  const url = new URL(`https://${host}/${VERSION}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error || {};
    throw new Error(`[${res.status}] ${e.code || ""} ${e.message || "요청 실패"}`.trim());
  }
  return body;
}
const fb = (endpoint, params) => call("graph.facebook.com", endpoint, params);

function fmtExpiry(unix) {
  if (!unix) return "만료 없음";
  return new Date(unix * 1000).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" }) + " 만료";
}

function saveSecret(name, value) {
  const r = spawnSync(GH, ["secret", "set", name], { input: value, encoding: "utf8" });
  if (r.status !== 0) throw new Error(`${name} 저장 실패: ${(r.stderr || "").trim()}`);
  console.log(`✓ GitHub Secret ${name} 저장`);
}

async function verify(host, igId, token) {
  const until = Math.floor((Date.now() / 1000 + 9 * 3600) / DAY) * DAY - 9 * 3600;
  const prof = await call(host, igId, {
    fields: host.includes("facebook") ? "id,username,followers_count" : "user_id,username,followers_count",
    access_token: token,
  });
  console.log(`✓ 계정 @${prof.username} · 팔로워 ${prof.followers_count}`);
  const reach = await call(host, `${igId}/insights`, {
    metric: "reach", period: "day", metric_type: "total_value", since: until - 30 * DAY, until, access_token: token,
  }).catch((e) => ({ error: e.message }));
  if (reach.error) console.warn(`! 30일 도달 확인 실패: ${reach.error}`);
  else console.log(`✓ 30일 도달 계정 ${reach?.data?.[0]?.total_value?.value}`);
}

async function main() {
  const token = await ask("Meta에서 복사한 토큰을 붙여 넣고 Enter (화면에 표시되지 않음): ", true);
  if (!token) { console.error("토큰이 비어 있습니다."); return 1; }

  if (!token.startsWith("EAA")) {
    // Instagram 로그인 토큰: 그대로 사용
    await verify("graph.instagram.com", "me", token);
    saveSecret("IG_ACCESS_TOKEN", token);
    console.log("완료. (IG… 토큰은 60일마다 연장 필요 — GH_PAT 를 등록하면 자동 연장)");
    return 0;
  }

  console.log("\nFacebook 로그인 토큰(EAA…)입니다. 만료 없는 토큰으로 바꾸려면 앱 정보가 필요합니다.");
  console.log("Meta 앱 대시보드 → ⚙ App settings → Basic 에서 확인하세요.\n");
  const appId = (await ask(`App ID (그냥 Enter = ${DEFAULT_APP_ID}): `)) || DEFAULT_APP_ID;
  if (!/^\d+$/.test(appId)) { console.error("App ID 는 숫자만 입력합니다."); return 1; }
  if (appId.startsWith("1784")) console.warn("! 1784…로 시작하는 번호는 보통 Instagram 계정 ID 입니다. App settings → Basic 의 App ID 를 확인하세요.");
  const appSecret = await ask("App secret (화면에 표시되지 않음): ", true);
  if (!/^[0-9a-f]{32}$/i.test(appSecret)) console.warn("! App secret 은 보통 32자리 영문·숫자입니다. 복사가 덜 됐는지 확인하세요.");
  const appToken = `${appId}|${appSecret}`;

  const app = await fb(appId, { fields: "name", access_token: appToken }).catch(() => null);
  if (!app) throw new Error("App ID 또는 App secret 이 맞지 않습니다. App settings → Basic 의 값을 다시 확인해 주세요.");
  console.log(`✓ 앱 확인: ${app.name}`);

  const dbg = (await fb("debug_token", { input_token: token, access_token: appToken })).data || {};
  if (!dbg.is_valid) throw new Error("토큰이 유효하지 않습니다. Meta 대시보드에서 Generate token 으로 다시 생성해 주세요.");
  console.log(`· 토큰 종류 ${dbg.type} · ${fmtExpiry(dbg.expires_at)}`);
  console.log(`· 권한 ${(dbg.scopes || []).join(", ") || "(없음)"}`);

  let pageToken = null;
  let ig = null;

  if (dbg.type === "PAGE") {
    const me = await fb("me", { fields: "name,instagram_business_account{id,username}", access_token: token });
    ig = me.instagram_business_account;
    pageToken = token;
  } else {
    const ll = await fb("oauth/access_token", {
      grant_type: "fb_exchange_token", client_id: appId, client_secret: appSecret, fb_exchange_token: token,
    });
    console.log("✓ 장기 토큰으로 교환");
    const pages = (await fb("me/accounts", {
      fields: "name,access_token,instagram_business_account{id,username}", limit: 100, access_token: ll.access_token,
    })).data || [];
    console.log(`· 연결된 Facebook 페이지 ${pages.length}개: ${pages.map((p) => p.name + (p.instagram_business_account ? ` (@${p.instagram_business_account.username})` : "")).join(", ") || "없음"}`);
    const hit = pages.find((p) => p.instagram_business_account?.username === HANDLE) || pages.find((p) => p.instagram_business_account);
    if (hit) {
      ig = hit.instagram_business_account;
      pageToken = hit.access_token;
    }
  }

  if (!ig || !pageToken) {
    console.error(`\n✗ @${HANDLE} 와 연결된 Facebook 페이지를 찾지 못했습니다.`);
    console.error("  Instagram 계정에 Facebook 페이지를 연결한 뒤, Meta 대시보드에서 토큰을 새로 생성해 다시 실행해 주세요.");
    return 1;
  }

  const pdbg = (await fb("debug_token", { input_token: pageToken, access_token: appToken })).data || {};
  console.log(`✓ 페이지 토큰 · ${fmtExpiry(pdbg.expires_at)} · Instagram 계정 ID ${ig.id}`);

  await verify("graph.facebook.com", ig.id, pageToken);
  saveSecret("IG_ACCESS_TOKEN", pageToken);
  saveSecret("IG_USER_ID", ig.id);
  console.log("\n완료! GitHub Actions 가 매일 09:00(KST)에 이 토큰으로 지표를 갱신합니다.");
  return 0;
}

main().then(finish, (err) => {
  console.error(`\n✗ ${err.message}`);
  finish(1);
});
