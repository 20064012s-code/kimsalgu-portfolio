(function () {
  "use strict";
  var DATA = window.SALGU_WORKS || { works: [] };
  var WORKS = (DATA.works || []).filter(function (w) { return w && w.id && w.pages > 0; });
  var $ = function (id) { return document.getElementById(id); };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }
  function src(w, page) { return "assets/works/" + w.id + "-" + String(page).padStart(2, "0") + ".webp"; }
  function byId(id) { for (var i = 0; i < WORKS.length; i++) if (WORKS[i].id === id) return WORKS[i]; return null; }
  function tagList(tags) {
    return (tags || []).map(function (t) { return '<li class="tag">' + esc(t) + "</li>"; }).join("");
  }

  // 모든 분야 키워드 (작업 수 많은 순)
  var tagCount = {};
  WORKS.forEach(function (w) { (w.tags || []).forEach(function (t) { tagCount[t] = (tagCount[t] || 0) + 1; }); });
  var allTags = Object.keys(tagCount).sort(function (a, b) { return tagCount[b] - tagCount[a]; });

  /* ---------- hero ---------- */
  var fanIds = ["w4", "w1", "w3"].map(byId).filter(Boolean);
  if (fanIds.length < 3) fanIds = WORKS.slice(0, 3);
  $("fan").innerHTML = '<span class="fan__disc"></span>' + fanIds.map(function (w) {
    return '<span class="fan__card"><img src="' + src(w, 1) + '" alt="" /></span>';
  }).join("");

  /* ---------- 10컷 설득 구조 ---------- */
  var st = DATA.structure;
  var stWork = st && byId(st.workId);
  if (stWork && st.steps && st.steps.length) {
    $("steps").innerHTML = st.steps.map(function (s) {
      return '<li class="step"><p class="step__cut">' + esc(s.cut) + '</p><h3 class="step__title">' + esc(s.title) + "</h3>" +
        '<button type="button" class="step__thumb" data-work="' + esc(stWork.id) + '" data-page="' + s.page + '" aria-label="' + esc(s.cut + " 크게 보기") + '">' +
        '<img src="' + src(stWork, s.page) + '" alt="' + esc(stWork.title + " " + s.page + "번째 컷") + '" loading="lazy" /></button>' +
        '<p class="step__text">' + esc(s.text) + "</p></li>";
    }).join("");
    $("steps").insertAdjacentHTML("afterend", '<p class="steps__src">예시: ' + esc(stWork.client ? stWork.client + " — " : "") + esc(stWork.title) + "</p>");
  } else {
    $("structure").hidden = true;
  }

  /* ---------- 작업물 ---------- */
  $("work-cards").innerHTML = WORKS.map(function (w) {
    return '<article class="card work" data-tags="' + esc((w.tags || []).join("|")) + '">' +
      '<button type="button" class="card__cover" data-work="' + esc(w.id) + '" data-page="1" aria-label="' + esc(w.title + " 전체 컷 보기") + '">' +
      '<img src="' + src(w, 1) + '" alt="' + esc(w.title + " 표지") + '" loading="lazy" />' +
      '<span class="work__count">' + w.pages + "컷</span></button>" +
      '<div class="card__body">' +
      '<ul class="tags" aria-label="광고 분야">' + tagList(w.tags) + "</ul>" +
      '<h3 class="card__title">' + esc(w.title) + "</h3>" +
      (w.client ? '<p class="work__client">' + esc(w.client) + (w.product ? " <span>· " + esc(w.product) + "</span>" : "") + "</p>" : "") +
      (w.summary ? '<p class="card__summary">' + esc(w.summary) + "</p>" : "") +
      '<div class="card__foot"><span>' + esc(w.format || "") + '</span><button type="button" class="work__open" data-work="' + esc(w.id) + '" data-page="1">전체 컷 보기 →</button></div>' +
      "</div></article>";
  }).join("");

  var filters = ["전체"].concat(allTags);
  $("filters").innerHTML = filters.map(function (t, i) {
    return '<button type="button" class="filter" data-tag="' + esc(i === 0 ? "" : t) + '" aria-pressed="' + (i === 0) + '">' + esc(t) + "</button>";
  }).join("");
  if (allTags.length < 2) $("filters").hidden = true;
  $("filters").addEventListener("click", function (e) {
    var b = e.target.closest(".filter");
    if (!b) return;
    var tag = b.getAttribute("data-tag");
    Array.prototype.forEach.call(this.children, function (x) { x.setAttribute("aria-pressed", String(x === b)); });
    Array.prototype.forEach.call(document.querySelectorAll(".work"), function (card) {
      card.hidden = !!tag && card.getAttribute("data-tags").split("|").indexOf(tag) < 0;
    });
  });

  /* ---------- 컷 뷰어 ---------- */
  var viewer = $("viewer"), track = $("viewer-track"), dots = $("viewer-dots");
  var cur = { w: null, i: 0 };

  function slideTo(i, smooth) {
    if (!cur.w) return;
    i = Math.max(0, Math.min(cur.w.pages - 1, i));
    track.scrollTo({ left: i * track.clientWidth, behavior: smooth ? "smooth" : "auto" });
    mark(i);
  }
  function mark(i) {
    cur.i = i;
    $("viewer-count").textContent = (i + 1) + " / " + cur.w.pages;
    $("viewer-prev").disabled = i === 0;
    $("viewer-next").disabled = i === cur.w.pages - 1;
    Array.prototype.forEach.call(dots.children, function (d, k) { d.setAttribute("aria-current", String(k === i)); });
  }
  function open(id, page) {
    var w = byId(id);
    if (!w) return;
    cur.w = w;
    $("viewer-title").textContent = (w.client ? w.client + " · " : "") + w.title;
    var html = "", dh = "";
    for (var p = 1; p <= w.pages; p++) {
      html += '<div class="viewer__slide"><img src="' + src(w, p) + '" alt="' + esc(w.title + " " + p + "번째 컷") + '"' + (Math.abs(p - page) > 1 ? ' loading="lazy"' : "") + " /></div>";
      dh += '<button type="button" aria-label="' + p + '번째 컷"></button>';
    }
    track.innerHTML = html;
    dots.innerHTML = dh;
    if (typeof viewer.showModal === "function") viewer.showModal(); else viewer.setAttribute("open", "");
    document.documentElement.style.overflow = "hidden";
    requestAnimationFrame(function () { slideTo(page - 1, false); track.focus({ preventScroll: true }); });
  }

  document.addEventListener("click", function (e) {
    var t = e.target.closest("[data-work]");
    if (t) open(t.getAttribute("data-work"), parseInt(t.getAttribute("data-page"), 10) || 1);
  });
  $("viewer-prev").addEventListener("click", function () { slideTo(cur.i - 1, true); });
  $("viewer-next").addEventListener("click", function () { slideTo(cur.i + 1, true); });
  dots.addEventListener("click", function (e) {
    var k = Array.prototype.indexOf.call(dots.children, e.target);
    if (k >= 0) slideTo(k, true);
  });
  var raf = 0;
  track.addEventListener("scroll", function () {
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(function () {
      if (!cur.w || !track.clientWidth) return;
      var i = Math.round(track.scrollLeft / track.clientWidth);
      if (i !== cur.i) mark(i);
    });
  });
  viewer.addEventListener("keydown", function (e) {
    if (e.key === "ArrowRight") { e.preventDefault(); slideTo(cur.i + 1, true); }
    if (e.key === "ArrowLeft") { e.preventDefault(); slideTo(cur.i - 1, true); }
  });
  viewer.addEventListener("click", function (e) {
    if (e.target === viewer || e.target.classList.contains("viewer__slide")) viewer.close();
  });
  viewer.addEventListener("close", function () { document.documentElement.style.overflow = ""; });
  window.addEventListener("resize", function () { if (viewer.open) slideTo(cur.i, false); });

  /* ---------- 메일 복사 ---------- */
  var copy = $("copy-mail");
  if (copy) copy.addEventListener("click", function () {
    var mail = copy.getAttribute("data-mail");
    var done = function () { copy.textContent = "복사됨"; setTimeout(function () { copy.textContent = "주소 복사"; }, 1600); };
    if (navigator.clipboard) navigator.clipboard.writeText(mail).then(done, function () {});
  });
})();
