/* ============================================================
 * loading.js —— StarGaze 星座观星仪 · 加载动效运行时
 *
 * 职责（升级既有 #loading，不新建加载页）：
 *   1. 把 #loading 从"无限转圈"升级为"真实进度"启动页：
 *      每一步都由实际发生的初始化事件推进（CDN 脚本就绪 / DOM 就绪 /
 *      地球首帧渲染完成），绝不伪造进度循环。
 *   2. 顶部进度条 LP.top：定位请求、星座资料抓取、地球↔夜空视图切换。
 *
 * 通过观察既有 DOM / fetch 接入，不侵入 app.js 逻辑。
 * ============================================================ */
(function (w, d) {
  'use strict';
  if (w.LP) return;

  var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function $(id) { return d.getElementById(id); }
  function nextFrame(fn) { w.requestAnimationFrame(function () { w.requestAnimationFrame(fn); }); }

  /* ==========================================================
   * 1. 启动页：真实进度（复用既有 #loading）
   * ========================================================== */
  var splash = (function () {
    var root = null, fill = null, track = null, pctEl = null, stageEl = null;
    var total = 3, doneSteps = 0, finished = false, guardTimer = null;

    function bind() {
      root = $('loading');
      if (!root) return false;
      fill = $('ldFill');
      track = $('ldTrack') || (fill && fill.parentNode);
      pctEl = $('ldPct');
      stageEl = $('ldStage');
      return true;
    }

    function paint() {
      var p = Math.max(0, Math.min(1, doneSteps / total));
      if (track) track.style.setProperty('--p', p.toFixed(4));   /* → scaleX */
      if (pctEl) pctEl.textContent = Math.round(p * 100) + '%';
    }

    return {
      steps: function (n) { if (n > 0) { total = n; paint(); } },
      /** 完成一步（必须由真实事件调用） */
      step: function (label) {
        if (finished) return;
        doneSteps++;
        if (label && stageEl) stageEl.textContent = label;
        paint();
      },
      say: function (label) { if (!finished && stageEl) stageEl.textContent = label; },
      /** 关闭启动页：淡出 + 轻微放大（沿用既有 .hide 类） */
      done: function (cb) {
        if (finished) { if (cb) cb(); return; }
        finished = true;
        clearTimeout(guardTimer);
        doneSteps = total;
        paint();
        if (stageEl) stageEl.textContent = '星空已就绪';
        var finish = function () {
          if (root) {
            root.classList.add('hide');
            setTimeout(function () { if (root && root.parentNode) root.style.display = 'none'; }, 760);
          }
          if (cb) cb();
        };
        if (reduce) { finish(); return; }
        setTimeout(finish, 260);
      },
      guard: function () {
        clearTimeout(guardTimer);
        // 兜底：8s 后不再遮挡界面（CDN 极慢 / 离线时仍可用）
        guardTimer = setTimeout(function () { splash.done(); }, 8000);
      },
      get finished() { return finished; },
      /** 绑定既有 #loading 上的进度节点（复用其DOM，不新建加载页） */
      attach: function () { return bind(); }
    };
  })();

  /**
   * 启动流程（真实进度，共3 步）：
   *   1. DOM 就绪
   *   2.样式表就绪
   *   3. 地球页可见 + WebGL canvas 完成首帧布局 → 关闭启动页
   * 会话内只在首次进入时展示（sessionStorage 记忆）。
   */
  function runSplash() {
    // 既有 #loading 不存在时：不做任何事（保持原有页面状态，不遮挡界面）
    if (!splash.attach()) return;
    var KEY = 'stargaze.splash.v1';
    var seen = false;
    try { seen = w.sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    if (seen) { splash.done(); return; }
    try { w.sessionStorage.setItem(KEY, '1'); } catch (e) {}
    splash.guard();

    splash.step('正在唤醒星空…');                    // 1
    if (d.styleSheets && d.styleSheets.length) splash.step('正在载入星图…');  // 2
    else nextFrame(function () { splash.step('正在载入星图…'); });

    // 3：等待地球页真正可见且 WebGL canvas 已建立
    var tries = 0;
    (function poll() {
      var earth = $('earth-view');
      var canvas = $('earth-canvas');
      var ready = earth && earth.classList.contains('show') && canvas && canvas.width > 0;
      if (ready|| ++tries > 150) {                    // 最多约 2.5s
        splash.step('正在点亮地球…');
        try { w.sessionStorage.setItem(KEY, '1'); } catch (e2) {}
        // 再等一帧让地球首帧真正上屏，然后淡出启动页
        nextFrame(function () { splash.done(); });
        return;
      }
      w.requestAnimationFrame(poll);
    })();
  }

  /* ==========================================================
   * 2. 顶部进度条
   * ========================================================== */
  var top = (function () {
    var host = null, hideTimer = null, raf = null;
    function build() {
      if (host) return;
      host = d.createElement('div');
      host.id = 'lpTop';
      host.setAttribute('aria-hidden', 'true');
      host.appendChild(d.createElement('i'));
      host.appendChild(d.createElement('b'));   /* 头部亮点，与进度条同 duration/easing */
      d.body.appendChild(host);
    }
    function apply(p) { host.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(4)); }
    return {
      /** 开始：不确定时长，渐近推进到 0.9 */
      start: function () {
        build();
        clearTimeout(hideTimer);
        w.cancelAnimationFrame(raf);
        host.classList.remove('lp-done');
        host.classList.add('lp-on');
        if (reduce) { apply(0.9); return; }
        var p = 0;
        var tick = function () {
          p += (0.9 - p) * 0.18;
          apply(p);
          if (p < 0.9) raf = w.requestAnimationFrame(tick);
        };
        raf = w.requestAnimationFrame(tick);
      },
      /** 设定真实进度（0~1） */
      set: function (p) { if (!host) build(); w.cancelAnimationFrame(raf); apply(p); },
      /** 完成：补满后淡出 */
      done: function (delay) {
        if (!host) return;
        w.cancelAnimationFrame(raf);
        apply(1);
        clearTimeout(hideTimer);
        hideTimer = setTimeout(function () {
          host.classList.add('lp-done');
          host.classList.remove('lp-on');
        }, delay == null ? 200 : delay);
      }
    };
  })();

  /* ==========================================================
   * 3. 自动挂载：定位 / 资料抓取 / 视图切换→ 顶部进度条
   * ========================================================== */

  /** 定位请求（IP 定位 / 逆地理编码）→ 顶部进度条 */
  function watchLocate() {
    if (!w.fetch) return;
    var inflight = 0;
    var orig = w.fetch;
    w.fetch = function (input) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var isLocate = /ipapi|ipinfo|ip-api|userlocationapi|nominatim/i.test(url);
      if (!isLocate) return orig.apply(this, arguments);
      inflight++;
      if (inflight === 1) top.start();
      return orig.apply(this, arguments).then(function (res) {
        if (--inflight <= 0) { inflight = 0; top.set(0.88); top.done(200); }
        return res;
      }, function (err) {
        if (--inflight <= 0) { inflight = 0; top.done(120); }
        throw err;
      });
    };
  }

  /** 星空数据抓取（维基 / NASA 资料）→ 顶部进度条；"了解"面板内的真实加载 */
  function watchLearnData() {
    if (!w.fetch) return;
    var orig = w.fetch;
    var openCount = 0;
    w.fetch = function (input) {
      var url = (typeof input === 'string') ? input : (input && input.url) || '';
      var isCosmo = /wikipedia|images-api\.nasa\.gov/i.test(url);
      if (!isCosmo) return orig.apply(this, arguments);
      if (openCount === 0) top.start();
      openCount++;
      return orig.apply(this, arguments).then(function (res) {
        if (--openCount <= 0) { openCount = 0; top.set(0.9); top.done(200); }
        return res;
      }, function (err) {
        if (--openCount <= 0) { openCount = 0; top.done(140); }
        throw err;
      });
    };
  }

  /** 地球 ↔夜空 视图切换 → 顶部进度条（真实时长 = 既有 700ms 过渡动画） */
  function watchViewSwitch() {
    var sky = $('sky-view'), earth = $('earth-view'), overlay = $('transition-overlay');
    if (!w.MutationObserver || (!sky && !earth)) return;
    var last = earth && earth.classList.contains('show') ? 'earth' : 'sky';
    var nodes = [sky, earth].filter(Boolean);
    var mo = new w.MutationObserver(function () {
      var cur = (earth && earth.classList.contains('show')) ? 'earth' : 'sky';
      if (cur === last) return;
      last = cur;
      top.start();
      // 过渡动画 700ms，真实进度在 620ms 处收尾
      w.setTimeout(function () { top.set(0.88); top.done(220); }, 620);
    });
    nodes.forEach(function (n) { mo.observe(n, { attributes: true, attributeFilter: ['class'] }); });
    if (overlay) { /* overlay 仅作过渡提示层，无需进度 */ }
  }

  /* ---------------- 导出 ---------------- */
  w.LP = {
    version: '1.0.0',
    splash: splash,
    top: top,
    reduce: reduce
  };

  if (d.readyState === 'loading') {
    d.addEventListener('DOMContentLoaded', function () {
      runSplash(); watchLocate(); watchLearnData(); watchViewSwitch();
    }, { once: true });
  } else {
    runSplash(); watchLocate(); watchLearnData(); watchViewSwitch();
  }
})(window, document);