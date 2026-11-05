#!/usr/bin/env node
/**
 * Instagram API(Instagram 로그인 방식)로 공개용 지표를 가져와 site/data/stats.js 를 만듭니다.
 *
 * 필요 환경 변수
 *   IG_ACCESS_TOKEN        장기 액세스 토큰 (instagram_business_basic, instagram_business_manage_insights)
 *   IG_API_VERSION         선택. 기본 v27.0
 *   IG_REFRESH_TOKEN_OUT   선택. 경로를 주면 토큰을 갱신해 새 토큰을 그 파일에 저장 (워크플로가 Secret 교체에 사용)
 *
 * 원칙
 *   - config/publish.json 에서 공개하기로 한 지표만 기록합니다.
 *   - 30일 도달 계정 수는 일별 값을 더하지 않습니다. 기간 total_value 를 받고,
 *     그 값이 일별 합계보다 작을 때(= 중복 제거된 값으로 확인될 때)만 deduplicated: true 로 표시합니다.
 *   - 일부 지표가 실패해도 나머지는 기록하고, 전부 실패하면 기존 stats.js 를 그대로 둡니다.
 *   - 토큰은 어떤 로그에도 출력하지 않습니다.
 */
import { mkdir, readdir, readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const STATS_FILE = path.join(ROOT, "site", "data", "stats.js");
const MEDIA_DIR = path.join(ROOT, "site", "data", "media");
const MEDIA_URL_PREFIX = "data/media/";

const TOKEN = process.env.IG_ACCESS_TOKEN;
const VERSION = process.env.IG_API_VERSION || "v27.0";
const BASE = `https://graph.instagram.com/${VERSION}`;
const DAY = 86400;

if (!TOKEN) {
  console.error("IG_ACCESS_TOKEN 이 없습니다. 직접 입력값(site/data/profile.js)만으로 사이트가 표시됩니다.");
  process.exit(1);
}

const publish = JSON.parse(await readFile(path.join(ROOT, "config", "publish.json"), "utf8"));

/* ---------- API ---------- */
async function getJson(url) {
  const res = await fetch(url);
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) {
    const e = body.error || {};
    throw new Error(`[${res.status}] ${e.type || ""} ${e.code || ""} ${e.message || "요청 실패"}`.trim());
  }
  return body;
}
function api(endpoint, params = {}) {
  const url = new URL(`${BASE}/${endpoint}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v));
  url.searchParams.set("access_token", TOKEN);
  return getJson(url);
}
async function attempt(label, fn) {
  try {
    return await fn();
  } catch (err) {
    console.warn(`✗ ${label}: ${err.message}`);
    return undefined;
  }
}

/* ---------- 기간: 오늘 0시(KST) 기준 직전 30일 ---------- */
function kstDate(unix) {
  return new Date(unix * 1000 + 9 * 3600 * 1000).toISOString().slice(0, 10);
}
const nowUnix = Math.floor(Date.now() / 1000);
const until = Math.floor((nowUnix + 9 * 3600) / DAY) * DAY - 9 * 3600;
const since = until - 30 * DAY;

/* ---------- 지표 ---------- */
async function fetchProfile() {
  return api("me", { fields: "user_id,username,followers_count" });
}

async function fetchReach30d() {
  const total = await api("me/insights", { metric: "reach", period: "day", metric_type: "total_value", since, until });
  const value = total?.data?.[0]?.total_value?.value;
  if (typeof value !== "number") throw new Error("total_value 응답에 값이 없습니다");

  // 일별 합계와 비교해 중복 제거 여부를 확인 (합계를 공개하지는 않음)
  const series = await attempt("reach 일별 값(검증용)", () =>
    api("me/insights", { metric: "reach", period: "day", metric_type: "time_series", since, until })
  );
  const daily = series?.data?.[0]?.values?.map((v) => v.value).filter((v) => typeof v === "number") || [];
  const dailySum = daily.reduce((a, b) => a + b, 0);
  const deduplicated = daily.length >= 2 && value < dailySum;
  if (!deduplicated) console.warn("! 30일 도달 값이 중복 제거된 값인지 확인되지 않아 공개하지 않습니다 (직접 입력값 사용).");

  return { value, periodStart: kstDate(since), periodEnd: kstDate(until - DAY), deduplicated };
}

// 조회수는 중복 제거 개념이 없는 횟수 지표라 기간 total_value 를 그대로 사용
async function fetchViews30d() {
  const res = await api("me/insights", { metric: "views", period: "day", metric_type: "total_value", since, until });
  const value = res?.data?.[0]?.total_value?.value;
  if (typeof value !== "number") throw new Error("views total_value 응답에 값이 없습니다");
  return { value, periodStart: kstDate(since), periodEnd: kstDate(until - DAY) };
}

const MEDIA_METRIC_API ={ views: "views", reach: "reach", saves: "saved", shares: "shares", likes: "likes", comments: "comments" };

function readInsightValue(item) {
  if (typeof item?.total_value?.value === "number") return item.total_value.value;
  const v = item?.values?.[0]?.value;
  return typeof v === "number" ? v : undefined;
}

async function fetchMediaInsights(id, wanted) {
  const names = wanted.map((k) => MEDIA_METRIC_API[k]).filter(Boolean);
  let res = await attempt(`insights ${id}`, () => api(`${id}/insights`, { metric: names.join(",") }));
  if (!res && names.includes("views")) {
    // 오래된 게시물은 views 를 지원하지 않을 수 있음
    res = await attempt(`insights ${id} (views 제외)`, () =>
      api(`${id}/insights`, { metric: names.filter((n) => n !== "views").join(",") })
    );
  }
  const out = {};
  for (const item of res?.data || []) {
    const key = Object.keys(MEDIA_METRIC_API).find((k) => MEDIA_METRIC_API[k] === item.name);
    const v = readInsightValue(item);
    if (key && wanted.includes(key) && typeof v === "number") out[key] = v;
  }
  return out;
}

function captionParts(caption = "") {
  const lines = caption
    .split("\n")
    .map((l) => l.replace(/#[^\s#]+/g, "").trim())
    .filter(Boolean);
  const cut = (s, n) => (s && s.length > n ? s.slice(0, n - 1) + "…" : s || "");
  return { title: cut(lines[0], 40), summary: cut(lines[1], 80) };
}

async function downloadCover(id, url) {
  if (!url) return null;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`이미지 다운로드 실패 ${res.status}`);
  const file = `${id}.jpg`;
  await writeFile(path.join(MEDIA_DIR, file), Buffer.from(await res.arrayBuffer()));
  return MEDIA_URL_PREFIX + file;
}

async function fetchTopCarousels(cfg) {
  const count = Math.min(3, Math.max(1, cfg.count || 3));
  const wanted = cfg.metrics || ["views", "reach"];
  const rankBy = cfg.rankBy || "views";
  const scanLimit = cfg.scanLimit || 100;

  const fields = "id,media_type,caption,permalink,timestamp,media_url,thumbnail_url,children{media_type,media_url,thumbnail_url}";
  let page = await api("me/media", { fields, limit: 50 });
  const carousels = [];
  let scanned = 0;
  while (page) {
    for (const m of page.data || []) {
      scanned++;
      if (m.media_type === "CAROUSEL_ALBUM") carousels.push(m);
    }
    if (scanned >= scanLimit || !page.paging?.next) break;
    page = await getJson(page.paging.next);
  }

  const withMetrics = [];
  for (const m of carousels) {
    const metrics = await fetchMediaInsights(m.id, Array.from(new Set([...wanted, rankBy, "reach"])));
    withMetrics.push({ m, metrics });
  }
  const score = (x) => x.metrics[rankBy] ?? x.metrics.reach ?? -1;
  withMetrics.sort((a, b) => score(b) - score(a));
  const top = withMetrics.filter((x) => score(x) >= 0).slice(0, count);

  await mkdir(MEDIA_DIR, { recursive: true });
  const keep = new Set();
  const result = [];
  for (const { m, metrics } of top) {
    const first = m.children?.data?.[0];
    const coverUrl = first ? (first.media_type === "VIDEO" ? first.thumbnail_url : first.media_url) : m.thumbnail_url || m.media_url;
    const cover = await attempt(`표지 ${m.id}`, () => downloadCover(m.id, coverUrl));
    if (cover) keep.add(path.basename(cover));
    const publicMetrics = Object.fromEntries(Object.entries(metrics).filter(([k]) => wanted.includes(k)));
    result.push({ id: m.id, permalink: m.permalink, timestamp: m.timestamp, cover: cover || null, ...captionParts(m.caption), metrics: publicMetrics });
  }
  for (const f of await readdir(MEDIA_DIR)) if (!keep.has(f) && f !== ".gitkeep") await unlink(path.join(MEDIA_DIR, f));
  return result;
}

const GENDER = { F: "여성", M: "남성", U: "미상" };
async function fetchDemographic(breakdown) {
  const res = await api("me/insights", {
    metric: "follower_demographics",
    period: "lifetime",
    metric_type: "total_value",
    breakdown,
    timeframe: "this_month",
  });
  const rows = res?.data?.[0]?.total_value?.breakdowns?.[0]?.results || [];
  const total = rows.reduce((a, r) => a + (r.value || 0), 0);
  if (!total) return [];
  return rows
    .map((r) => {
      const key = r.dimension_values?.[0];
      return { label: breakdown === "gender" ? GENDER[key] || key : key, pct: Math.round((r.value / total) * 1000) / 10 };
    })
    .sort((a, b) => (breakdown === "age" ? String(a.label).localeCompare(String(b.label)) : b.pct - a.pct));
}

async function refreshToken(outFile) {
  const url = new URL("https://graph.instagram.com/refresh_access_token");
  url.searchParams.set("grant_type", "ig_refresh_token");
  url.searchParams.set("access_token", TOKEN);
  const body = await getJson(url);
  if (!body.access_token) throw new Error("새 토큰이 응답에 없습니다");
  await writeFile(outFile, body.access_token, { mode: 0o600 });
  console.log(`✓ 토큰 갱신 (유효기간 약 ${Math.round((body.expires_in || 0) / DAY)}일)`);
}

/* ---------- 실행 ---------- */
const stats = { updatedAt: new Date().toISOString(), source: "instagram-api" };
let ok = 0;

const profile = await attempt("프로필", fetchProfile);
if (profile && publish.followers && typeof profile.followers_count === "number") {
  stats.followers = { value: profile.followers_count, asOf: kstDate(nowUnix) };
  ok++;
  console.log(`✓ 팔로워 ${profile.followers_count}`);
}

if (publish.views30d) {
  const views = await attempt("30일 조회수", fetchViews30d);
  if (views) {
    stats.views30d = views;
    ok++;
    console.log(`✓ 30일 조회수 ${views.value} (${views.periodStart} ~ ${views.periodEnd})`);
  }
}

if (publish.reach30d) {
  const reach = await attempt("30일 도달", fetchReach30d);
  if (reach?.deduplicated) {
    stats.reach30d = reach;
    ok++;
    console.log(`✓ 30일 도달 계정 ${reach.value} (${reach.periodStart} ~ ${reach.periodEnd})`);
  }
}

if (publish.topCarousels?.enabled) {
  const top = await attempt("성과 좋은 캐러셀", () => fetchTopCarousels(publish.topCarousels));
  if (top?.length) {
    stats.topCarousels = top;
    ok++;
    console.log(`✓ 캐러셀 ${top.length}개`);
  }
}

const audience = {};
if (publish.audience?.age) audience.age = (await attempt("연령대", () => fetchDemographic("age"))) || [];
if (publish.audience?.gender) audience.gender = (await attempt("성별", () => fetchDemographic("gender"))) || [];
if ((audience.age || []).length || (audience.gender || []).length) {
  stats.audience = { asOf: kstDate(nowUnix), ...audience };
  ok++;
}

if (process.env.IG_REFRESH_TOKEN_OUT) await attempt("토큰 갱신", () => refreshToken(process.env.IG_REFRESH_TOKEN_OUT));

if (!ok) {
  console.error("가져온 공개 지표가 없어 기존 stats.js 를 유지합니다.");
  process.exit(1);
}

const banner = "/* Instagram API 자동 갱신 데이터 — scripts/sync-instagram.mjs 가 덮어씁니다. 직접 수정하지 마세요. */\n";
await writeFile(STATS_FILE, `${banner}window.SALGU_STATS = ${JSON.stringify(stats, null, 2)};\n`);
console.log(`✓ ${path.relative(ROOT, STATS_FILE)} 저장`);
