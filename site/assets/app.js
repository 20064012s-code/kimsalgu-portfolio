(function () {
  "use strict";

  var P = window.SALGU_PROFILE || {};
  var S = window.SALGU_STATS || null;
  var MAX_FEATURED = 3;

  var METRIC_LABELS = {
    views: "조회수",
    reach: "도달",
    likes: "좋아요",
    comments: "댓글",
    saves: "저장",
    shares: "공유",
    follows: "팔로우 유입",
  };
  var METRIC_ORDER = ["views", "reach", "shares", "saves", "likes", "comments", "follows"];
  var NICE = [1, 2, 5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000];

  /* ---------- helpers ---------- */
  function $(id) { return document.getElementById(id); }
  function isNum(v) { return typeof v === "number" && isFinite(v); }
  function has(v) { return v !== null && v !== undefined && v !== ""; }
  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function fmt(n) { return Math.round(n).toLocaleString("ko-KR"); }
  // 내림 처리: 성과를 부풀려 보이지 않게
  function floor1(x) { return (Math.floor(x * 10) / 10).toString(); }
  function compact(n) {
    var abs = Math.abs(n);
    if (abs >= 1e8) return floor1(n / 1e8) + "억";
    if (abs >= 1e4) return floor1(n / 1e4) + "만";
    return fmt(n);
  }
  function signed(n) { return (n > 0 ? "+" : "") + fmt(n); }
  function dateParts(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || "");
    return m ? { y: m[1], m: m[2], d: m[3] } : null;
  }
  function fmtDate(s) {
    var p = dateParts(s);
    return p ? p.y + "." + p.m + "." + p.d : "";
  }
  function fmtPeriod(a, b) {
    var pa = dateParts(a), pb = dateParts(b);
    if (!pa || !pb) return "";
    return fmtDate(a) + " – " + (pa.y === pb.y ? pb.m + "." + pb.d : fmtDate(b));
  }
  function fmtDateTime(iso) {
    var d = new Date(iso);
    if (isNaN(d)) return "";
    var parts = {};
    new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Seoul", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d).forEach(function (p) { parts[p.type] = p.value; });
    return parts.year + "." + parts.month + "." + parts.day + " " + parts.hour + ":" + parts.minute + " (KST)";
  }
  function niceUnit(max, base, maxBlocks) {
    for (var i = 0; i < NICE.length; i++) if (max / (base * NICE[i]) <= maxBlocks) return base * NICE[i];
    return base * NICE[NICE.length - 1];
  }
  // value 를 unit 크기의 칸으로 표시 (마지막 칸은 비율만큼)
  function blocks(value, unit, cls) {
    var n = value / unit, full = Math.floor(n), part = n - full, out = "";
    for (var i = 0; i < full; i++) out += '<i class="blk ' + cls + '"></i>';
    if (part > 0.02 || full === 0) out += '<i class="blk blk--part ' + cls + '" style="--p:' + Math.max(part, 0.06).toFixed(3) + '"></i>';
    return out;
  }

  /* ---------- data resolution: API 값 우선, 없으면 직접 입력값 ---------- */
  function resolveFollowers() {
    var a = S && S.followers;
    if (a && isNum(a.value)) return { value: a.value, asOf: a.asOf, source: "api" };
    var m = P.stats && P.stats.followers;
    if (m && isNum(m.value)) return { value: m.value, asOf: m.asOf, source: "manual" };
    return null;
  }
  function resolveReach() {
    // API 값은 기간 전체의 중복 제거 값일 때만 사용 (일별 합산 값은 쓰지 않음)
    var a = S && S.reach30d;
    if (a && isNum(a.value) && a.deduplicated === true) return { value: a.value, periodStart: a.periodStart, periodEnd: a.periodEnd, source: "api" };
    var m = P.stats && P.stats.reach30d;
    if (m && isNum(m.value)) return { value: m.value, periodStart: m.periodStart, periodEnd: m.periodEnd, source: "manual" };
    return null;
  }

  var MR = P.monthlyReport || {};
  function resolveViews() {
    var a = S && S.views30d;
    if (a && isNum(a.value)) return { value: a.value, periodStart: a.periodStart, periodEnd: a.periodEnd, source: "api" };
    if (isNum(MR.views)) return { value: MR.views, periodStart: MR.periodStart, periodEnd: MR.periodEnd, source: "manual" };
    return null;
  }
  function resolveAudience() {
    var a = S && S.audience;
    if (a && ((a.age || []).length || (a.gender || []).length)) return a;
    return P.audience || null;
  }

  var F = resolveFollowers();
  var R = resolveReach();
  var V = resolveViews();
  var A = resolveAudience();

  /* ---------- text bindings ---------- */
  document.querySelectorAll("[data-bind]").forEach(function (el) {
    var v = P[el.getAttribute("data-bind")];
    if (!has(v)) { el.hidden = true; return; }
    el.innerHTML = String(v).split("\n").map(esc).join("<br />");
  });
  if (P.instagramUrl) $("ig-link").href = P.instagramUrl;
  if (P.dmUrl) $("dm-link").href = P.dmUrl;

  /* ---------- 1. hero ---------- */
  (function hero() {
    var title = $("hero-title");
    var name = esc(P.name || "김살구툰");
    if (V) title.innerHTML = name + "은<br />30일 동안 <em>" + esc(fmt(V.value)) + "회</em><br />조회되었습니다";
    else if (R) title.innerHTML = name + "은<br />30일 동안 <em>" + esc(fmt(R.value)) + "명</em>에게<br />닿았습니다";
    else title.innerHTML = name;

    var basis = V || R;
    $("hero-sub").textContent = basis
      ? "최근 30일 · 전체 콘텐츠 · 인스타그램 인사이트 기준입니다. (" + fmtPeriod(basis.periodStart, basis.periodEnd) + ")"
      : "일상 공감 인스타툰";

    var items = [];
    if (F) items.push({ label: "현재 팔로워", value: fmt(F.value), note: F.asOf ? fmtDate(F.asOf) + " 기준" : "" });
    if (R) items.push({ label: "최근 30일 도달 계정", value: fmt(R.value), note: fmtPeriod(R.periodStart, R.periodEnd) + " 집계" });
    $("hero-stats").innerHTML = items.map(function (it) {
      return '<div class="stat"><dt>' + esc(it.label) + '</dt><dd><span class="stat__big">' + esc(it.value) + "</span>" +
        (it.note ? '<span class="stat__note">' + esc(it.note) + "</span>" : "") + "</dd></div>";
    }).join("");
    if (!items.length) $("hero-stats").hidden = true;

    // 자동 갱신 값이 쓰일 때만 마지막 업데이트 시각 표시
    var apiUsed = [F, R, V].some(function (x) { return x && x.source === "api"; });
    var srcEl = $("hero-source");
    if (apiUsed && S.updatedAt) srcEl.textContent = "Instagram API 자동 갱신 · 마지막 업데이트 " + fmtDateTime(S.updatedAt);
    else srcEl.hidden = true;

    // 캐릭터 이미지는 첫 화면에만 사용
    var c = P.character || {};
    var cover = P.heroCover || {};
    var html = "";
    if (cover.src) {
      var img = '<img class="hero__cover" src="' + esc(cover.src) + '" alt="' + esc(cover.alt || "대표 인스타툰") + '" />';
      html = '<div class="hero__frame">' + (cover.url ? '<a href="' + esc(cover.url) + '" target="_blank" rel="noopener">' + img + "</a>" : img) + "</div>" +
        (c.src ? '<img class="hero__peek" src="' + esc(c.src) + '" alt="' + esc(c.alt || "") + '" />' : "");
    } else if (c.src) {
      html = '<div class="hero__disc" aria-hidden="true"></div><img class="hero__char" src="' + esc(c.src) + '" alt="' + esc(c.alt || "") + '" />';
    }
    if (html) $("hero-visual").innerHTML = html;
    else $("hero-visual").hidden = true;
  })();

  /* ---------- 2. 30일 성과 스토리 ---------- */
  function story(o) {
    return '<article class="story' + (o.viz ? "" : " story--solo") + '">' +
      '<div class="story__text">' +
      '<h3 class="story__label">' + esc(o.label) + "</h3>" +
      (o.lead ? '<p class="story__lead">' + o.lead + "</p>" : "") +
      (o.big ? '<p class="story__big' + (o.small ? " story__big--sm" : "") + '">' + o.big + "</p>" : "") +
      (o.bigLabel ? '<p class="story__biglabel">' + esc(o.bigLabel) + "</p>" : "") +
      (o.caption ? '<p class="story__caption">' + o.caption + "</p>" : "") +
      "</div>" +
      (o.viz ? '<div class="story__viz">' + o.viz + "</div>" : "") +
      "</article>";
  }
  function blockRows(rows, legend) {
    return '<div class="brows">' + rows.map(function (r) {
      return '<div class="brow"><p class="brow__label">' + esc(r.label) + (r.value ? ' <span>' + esc(r.value) + "</span>" : "") + "</p>" +
        '<div class="brow__blocks">' + r.html + "</div></div>";
    }).join("") + (legend ? '<p class="brow__legend"><i class="blk blk--key"></i> ' + esc(legend) + "</p>" : "") + "</div>";
  }

  // 구매력이 높은 핵심 연령대(25–44세)와 여성 비중
  var CORE_AGES = ["25-34", "35-44"];
  function audienceFacts() {
    if (!A) return null;
    var gender = (A.gender || []).filter(function (x) { return isNum(x.pct); });
    var age = (A.age || []).filter(function (x) { return isNum(x.pct); });
    if (!gender.length && !age.length) return null;
    var women = null;
    gender.forEach(function (x) { if (x.label === "여성") women = x; });
    if (women) gender = [women].concat(gender.filter(function (x) { return x !== women; }));
    var coreShare = 0, coreFound = 0;
    age.forEach(function (x) { if (CORE_AGES.indexOf(x.label) >= 0) { coreShare += x.pct; coreFound++; } });
    return {
      gender: gender,
      age: age,
      women: women,
      core: CORE_AGES,
      coreShare: coreFound === CORE_AGES.length ? coreShare : null,
      maxAge: Math.max.apply(null, age.map(function (x) { return x.pct; }).concat([1])),
    };
  }

  (function results() {
    var period = fmtPeriod(MR.periodStart, MR.periodEnd);
    if (MR.title) $("results-title").textContent = MR.title;
    $("results-lead").textContent = (period ? "집계 기간 " + period + " · " : "") + "전체 콘텐츠 · 인스타그램 인사이트 기준입니다.";

    var out = [];
    var reach = R ? R.value : MR.viewers;

    // 조회수 vs 도달 계정
    if (isNum(MR.views)) {
      var perHead = isNum(MR.viewers) && MR.viewers > 0 ? MR.views / MR.viewers : null;
      out.push(story({
        label: "조회수",
        big: "<em>" + esc(fmt(MR.views)) + "</em>",
        bigLabel: "30일 조회수",
        caption: perHead ? "도달 " + esc(fmt(MR.viewers)) + "명이 평균 <b>" + floor1(perHead) + "번</b>씩 봤습니다." : "",
        viz: perHead ? blockRows([
          { label: "도달 계정", value: fmt(MR.viewers), html: blocks(MR.viewers, MR.viewers, "blk--muted") },
          { label: "조회수", value: fmt(MR.views), html: blocks(MR.views, MR.viewers, "blk--accent") },
        ], "1칸 = 도달 계정 수") : "",
      }));
    }

    // 팔로워 수 vs 도달
    if (F && isNum(reach) && F.value > 0) {
      var ratio = reach / F.value;
      var unit = niceUnit(reach, F.value, 40);
      var k = unit / F.value;
      out.push(story({
        label: "팔로워 수 vs 30일 동안 닿은 사람 수",
        lead: "팔로워 수로 예상한 도달의",
        big: "<em>" + esc(ratio >= 10 ? fmt(Math.floor(ratio)) : floor1(ratio)) + "배</em>",
        caption: "팔로워 " + esc(fmt(F.value)) + "명보다 훨씬 많은 " + esc(fmt(reach)) + "명에게 닿았습니다." +
          (F.asOf ? " (팔로워 " + esc(fmtDate(F.asOf)) + " 기준)" : ""),
        viz: blockRows([
          { label: "팔로워", value: fmt(F.value), html: blocks(F.value, unit, "blk--muted") },
          { label: "30일 도달", value: fmt(reach), html: blocks(reach, unit, "blk--accent") },
        ], "1칸 = 팔로워 수" + (k > 1 ? " × " + k : "")),
      }));
    }

    // 비팔로워 비중
    if (isNum(MR.nonFollowerViewShare)) {
      var fShare = isNum(MR.followerViewShare) ? MR.followerViewShare : 100 - MR.nonFollowerViewShare;
      var cells = "";
      for (var i = 0; i < 100; i++) {
        var f = Math.max(0, Math.min(1, fShare - i));
        cells += '<i class="cell" style="--f:' + f.toFixed(2) + '"></i>';
      }
      out.push(story({
        label: "팔로워 밖까지 닿는 조회",
        big: "<em>" + esc(MR.nonFollowerViewShare) + "%</em>",
        bigLabel: "비팔로워 조회 비중",
        caption: "조회수 중 " + esc(MR.nonFollowerViewShare) + "%가 아직 팔로우하지 않은 사람에게서 나왔습니다. 브랜드 메시지가 새로운 소비자에게 닿습니다.",
        viz: '<div class="waffle" role="img" aria-label="팔로워 ' + esc(fShare) + "%, 비팔로워 " + esc(MR.nonFollowerViewShare) + '%">' + cells + "</div>" +
          '<p class="brow__legend"><i class="blk blk--key blk--muted"></i> 팔로워 ' + esc(fShare) + '% &nbsp; <i class="blk blk--key"></i> 비팔로워 ' + esc(MR.nonFollowerViewShare) + "% · 1칸 = 1%</p>",
      }));
    }

    // 팔로워 성별·연령
    var aud = audienceFacts();
    if (aud) {
      var g = aud.gender.map(function (x, i) {
        return '<span class="split__seg' + (i === 0 ? "" : " split__seg--muted") + '" style="width:' + x.pct + '%"></span>';
      }).join("");
      var ages = aud.age.map(function (x) {
        var hot = aud.core.indexOf(x.label) >= 0;
        return '<li class="' + (hot ? "is-hot" : "") + '"><span class="bars__label">' + esc(x.label) + '</span><span class="bars__track"><span class="bars__fill" style="width:' +
          Math.min(100, x.pct / aud.maxAge * 100).toFixed(1) + '%"></span></span><span class="bars__val">' + esc(x.pct.toFixed(1)) + "%</span></li>";
      }).join("");
      out.push(story({
        label: "팔로워 성별 · 연령" + (A.asOf ? " (" + fmtDate(A.asOf) + " 기준)" : ""),
        big: aud.women ? "<em>" + esc(aud.women.pct.toFixed(1)) + "%</em>" : "",
        bigLabel: aud.women ? "여성 팔로워" : "",
        caption: (aud.women ? "팔로워 10명 중 " + Math.round(aud.women.pct / 10) + "명이 여성이고, " : "") +
          (aud.coreShare ? "구매력이 높은 25–44세가 <b>" + aud.coreShare.toFixed(1) + "%</b>입니다. " : "") +
          "생활·뷰티·식품처럼 여성이 구매를 결정하는 제품을 소개하기 좋은 독자층입니다.",
        viz: (aud.gender.length ? '<div class="viz"><p class="brow__label">성별</p><div class="split">' + g + '</div><p class="split__legend">' +
            aud.gender.map(function (x, i) {
              return '<span><i class="blk blk--key' + (i === 0 ? "" : " blk--muted") + '"></i> ' + esc(x.label) + " " + esc(x.pct.toFixed(1)) + "%</span>";
            }).join("") + "</p></div>" : "") +
          (aud.age.length ? '<div class="viz"><p class="brow__label">연령대</p><ul class="bars">' + ages + "</ul></div>" : ""),
      }));
    }

    // 콘텐츠 형식별
    var types = (MR.byType || []).filter(function (t) { return isNum(t.views); });
    if (types.length) {
      var max = Math.max.apply(null, types.map(function (t) { return t.views; }));
      var u = niceUnit(max, 1e4, 12);
      out.push(story({
        label: "콘텐츠 형식별 조회수",
        big: types.map(function (t) { return "<span>" + esc(t.label) + " <em>" + esc(t.display || compact(t.views)) + "</em></span>"; }).join(""),
        small: true,
        caption: "릴스와 캐러셀 모두에서 조회가 나오는 계정입니다. 브랜드 목표에 맞춰 형식을 고를 수 있습니다.",
        viz: blockRows(types.map(function (t) {
          return { label: t.label, value: t.display || compact(t.views), html: blocks(t.views, u, "blk--accent") };
        }), "1칸 = " + compact(u) + "회"),
      }));
    }

    // 순증 팔로워 · 상호작용
    if (isNum(MR.netFollowers)) out.push(story({
      label: "순증 팔로워",
      big: "<em>" + esc(signed(MR.netFollowers)) + "</em>",
      caption: "30일 동안 팔로워가 순증 " + esc(fmt(MR.netFollowers)) + "명 늘었습니다.",
    }));
    if (isNum(MR.interactions)) out.push(story({
      label: "상호작용",
      big: "<em>" + esc(fmt(MR.interactions)) + "</em>",
      caption: "좋아요·댓글·저장·공유를 합한 30일 상호작용 수입니다.",
    }));

    // 원본 캡처
    if (MR.screenshot && MR.screenshot.src) out.push(story({
      label: "인사이트 원본 화면",
      big: "",
      caption: "위 수치는 인스타그램 앱 인사이트 화면 그대로입니다. 이미지를 누르면 크게 볼 수 있습니다.",
      viz: '<button type="button" class="proof" data-lightbox="' + esc(MR.screenshot.src) + '" data-alt="' + esc(MR.screenshot.alt || "") + '">' +
        '<img src="' + esc(MR.screenshot.src) + '" alt="' + esc(MR.screenshot.alt || "인사이트 캡처") + '" loading="lazy" /></button>',
    }));

    if (!out.length) { $("results").hidden = true; return; }
    $("stories").innerHTML = out.join("");
  })();

  /* ---------- 대표 콘텐츠 ---------- */
  function bestMetric(item) {
    var m = item.metrics || {};
    if (item.highlight && isNum(m[item.highlight])) return item.highlight;
    if (isNum(m.reach)) return "reach";
    if (isNum(m.views)) return "views";
    for (var i = 0; i < METRIC_ORDER.length; i++) if (isNum(m[METRIC_ORDER[i]])) return METRIC_ORDER[i];
    return null;
  }

  (function featured() {
    var api = (S && S.topCarousels) || [];
    var list = api.map(function (c) {
      return {
        type: "캐러셀", badge: "성과 상위 캐러셀", title: c.title, url: c.permalink, cover: c.cover,
        postedAt: c.timestamp, summary: c.summary, metrics: c.metrics, asOf: (S.updatedAt || "").slice(0, 10), source: "api",
      };
    });
    var seen = {};
    list.forEach(function (x) { if (x.url) seen[x.url] = true; });
    (P.featured || []).forEach(function (x) {
      if (!x || !(x.title || x.url)) return;
      if (x.url && seen[x.url]) return;
      list.push(x);
    });
    list = list.slice(0, MAX_FEATURED);
    if (!list.length) return;

    $("featured-section").hidden = false;
    if (api.length) $("featured-title").textContent = "성과 좋은 캐러셀 · 대표 콘텐츠";
    $("featured").innerHTML = list.map(function (it) {
      var m = it.metrics || {};
      var best = bestMetric(it);
      var others = METRIC_ORDER.filter(function (k) { return k !== best && isNum(m[k]); });
      var bestLabel = best === "reach" ? "이 게시물이 닿은 사람 수" : best === "views" ? "이 게시물 조회수" : METRIC_LABELS[best];
      var vsF = best === "reach" && F && F.value > 0 ? "팔로워 수의 <em>" + floor1(m.reach / F.value) + "배</em>에게 닿았습니다" : "";
      var foot = [];
      if (it.postedAt) foot.push(fmtDate(it.postedAt) + " 게시");
      if (it.asOf) foot.push((it.source === "api" ? "API 집계 " : "") + fmtDate(it.asOf) + " 기준");
      return '<article class="card">' +
        (it.cover ? '<a class="card__cover" href="' + esc(it.url || "#") + '" target="_blank" rel="noopener"><img src="' + esc(it.cover) + '" alt="' + esc((it.title || "게시물") + " 표지") + '" loading="lazy" /></a>' : "") +
        '<div class="card__body">' +
        '<p class="card__type">' + esc(it.badge || it.type || "인스타툰") + "</p>" +
        (it.title ? '<h3 class="card__title">' + esc(it.title) + "</h3>" : "") +
        (it.summary ? '<p class="card__summary">' + esc(it.summary) + "</p>" : "") +
        (best ? '<p class="card__bestlabel">' + esc(bestLabel) + '</p><p class="card__best">' + esc(fmt(m[best])) + "</p>" : "") +
        (vsF ? '<p class="card__vs">' + vsF + "</p>" : "") +
        (others.length ? '<dl class="card__metrics">' + others.map(function (k) {
          return "<div><dt>" + esc(METRIC_LABELS[k]) + "</dt><dd>" + esc(fmt(m[k])) + "</dd></div>";
        }).join("") + "</dl>" : "") +
        '<div class="card__foot"><span>' + esc(foot.join(" · ")) + "</span>" +
        (it.url ? '<a href="' + esc(it.url) + '" target="_blank" rel="noopener">게시물 보기 ↗</a>' : "") +
        "</div></div></article>";
    }).join("");
  })();

  /* ---------- 3. 강점 ---------- */
  (function why() {
    var items = [];
    if (isNum(MR.nonFollowerViewShare)) items.push({
      t: "팔로워 밖까지 닿습니다",
      d: "조회의 " + MR.nonFollowerViewShare + "%가 비팔로워에게서 나옵니다. 아직 브랜드를 모르는 소비자에게 닿습니다.",
    });
    var aud = audienceFacts();
    if (aud && aud.women) items.push({
      t: "구매력 높은 여성 독자",
      d: "팔로워의 " + aud.women.pct.toFixed(1) + "%가 여성" + (aud.coreShare ? ", " + aud.coreShare.toFixed(1) + "%가 25–44세" : "") + "입니다. 직접 사고, 추천하고, 가족의 구매까지 결정하는 독자에게 제품을 보여 줍니다.",
    });
    items.push({
      t: "광고처럼 보이지 않습니다",
      d: "제품을 설명하는 대신 살구의 하루 속 한 장면으로 보여 줍니다. 독자는 이야기를 따라가다 제품을 기억합니다.",
    });
    if (isNum(MR.views) && isNum(MR.viewers) && MR.viewers > 0) items.push({
      t: "다시 보고, 저장하고, 공유합니다",
      d: "한 사람이 평균 " + floor1(MR.views / MR.viewers) + "번 봅니다. 캐러셀은 넘겨 보고 저장하고 친구에게 공유하며 반복 노출됩니다.",
    });
    $("why-list").innerHTML = items.map(function (it, i) {
      return '<li><span class="why__n">' + String(i + 1).padStart(2, "0") + "</span><h3>" + esc(it.t) + "</h3><p>" + esc(it.d) + "</p></li>";
    }).join("");
  })();

  /* ---------- 4. 문의 ---------- */
  (function contact() {
    var email = P.email || "kimsalgutoon@gmail.com";
    var subject = "[광고 협업 문의] 브랜드명 / 제품명";
    var body = "안녕하세요, 김살구툰 작가님.\n\n- 브랜드 / 제품:\n- 희망 일정:\n- 희망 콘텐츠 형태 (캐러셀·릴스 등):\n- 담당자 연락처:\n";
    $("mail-link").href = "mailto:" + email + "?subject=" + encodeURIComponent(subject) + "&body=" + encodeURIComponent(body);
    $("mail-text").textContent = email;
    $("copy-mail").addEventListener("click", function () {
      var btn = this;
      function done() { btn.textContent = "복사됨"; setTimeout(function () { btn.textContent = "주소 복사"; }, 1600); }
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(email).then(done, done);
      else {
        var t = document.createElement("textarea");
        t.value = email; document.body.appendChild(t); t.select();
        try { document.execCommand("copy"); } catch (e) {}
        document.body.removeChild(t); done();
      }
    });

    var formats = (P.formats || []).filter(function (f) { return f && f.name; });
    if (formats.length) {
      $("formats").hidden = false;
      $("format-list").innerHTML = formats.map(function (f) {
        return "<li><h4>" + esc(f.name) + "</h4>" + (f.detail ? "<p>" + esc(f.detail) + "</p>" : "") + (f.note ? '<p class="formats__note">' + esc(f.note) + "</p>" : "") + "</li>";
      }).join("");
    }
  })();

  /* ---------- lightbox ---------- */
  var lb = $("lightbox");
  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-lightbox]");
    if (t) {
      $("lightbox-img").src = t.getAttribute("data-lightbox");
      $("lightbox-img").alt = t.getAttribute("data-alt") || "";
      if (lb.showModal) lb.showModal(); else window.open(t.getAttribute("data-lightbox"));
    } else if (e.target === lb) lb.close();
  });
})();
