(function () {
  "use strict";

  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

  function getLikeContextAsync() {
    return new Promise(function (resolve) {
      chrome.runtime.sendMessage({ action: "getLikeContext" }, function (response) {
        resolve(response || {});
      });
    });
  }

  async function getLikedItems(cursor, secUid) {
    if (!secUid) return null;
    const params = new URLSearchParams({
      aid: "1988",
      count: "30",
      coverFormat: "2",
      cursor: String(cursor),
      needPinnedItemIds: "true",
      post_item_list_request_type: "0",
      secUid: secUid,
    });
    const url = `https://www.tiktok.com/api/favorite/item_list/?${params.toString()}`;
    const res = await fetch(url, {
      method: "GET",
      headers: { accept: "*/*" },
    });
    const raw = await res.text();
    let json;
    try {
      json = JSON.parse(raw);
    } catch (e) {
      console.error("La respuesta no es un JSON válido:", e, raw.slice(0, 200));
      return null;
    }
    if (json.status_code !== 0) {
      console.error("Error en getLikedItems:", json);
      return null;
    }
    const items = (json.itemList || []).map((e) => ({
      id: e.id,
      authorName: `@${e.author?.uniqueId ?? ""}`,
      desc: e.desc || "",
      url: `https://www.tiktok.com/@${e.author?.uniqueId ?? ""}/video/${e.id}`,
    }));
    return {
      hasMore: !!json.hasMore,
      nextCursor: json.cursor != null ? String(json.cursor) : null,
      items,
    };
  }

  function getCookie(name) {
    try {
      const parts = ("; " + (document.cookie || "")).split("; " + name + "=");
      if (parts.length === 2) return (parts[1].split(";")[0] || "").trim();
    } catch (e) {}
    return "";
  }

  /** Pide al background inyectar el listener de eliminación en el contexto de la página (vía executeScript MAIN),
   * evitando el CSP que bloquea los scripts en línea. */
  var pageRemoveScriptInjected = false;
  function ensurePageRemoveScript() {
    if (pageRemoveScriptInjected) return Promise.resolve();
    pageRemoveScriptInjected = true;
    return new Promise(function (resolve, reject) {
      chrome.runtime.sendMessage({ action: "injectPageRemoveListener" }, function (r) {
        if (r && r.ok) resolve();
        else {
          pageRemoveScriptInjected = false;
          reject(new Error((r && r.error) || "Error al inyectar script"));
        }
      });
    });
  }

  /** Elimina el "Like" ejecutando el fetch en el contexto de la página (como en la consola),
   * para que funcione igual que cuando el usuario lo ejecuta en DevTools. */
  function removeLikeItemInPage(awemeId) {
    return ensurePageRemoveScript().then(function () {
      return new Promise(function (resolve, reject) {
        var handler = function (e) {
          if (!e.detail || e.detail.awemeId !== awemeId) return;
          window.removeEventListener("tlr-remove-like-result", handler);
          if (e.detail.success) resolve(true);
          else reject(new Error(e.detail.error || "Error al eliminar"));
        };
        window.addEventListener("tlr-remove-like-result", handler);
        window.dispatchEvent(new CustomEvent("tlr-remove-like", { detail: { awemeId: awemeId } }));
      });
    });
  }

  function getRegionFromLocale() {
    try {
      const lang = (navigator.language || navigator.userLanguage || "").toLowerCase();
      if (lang.startsWith("pt")) return "BR";
      if (lang.startsWith("es")) return "ES";
      if (lang.startsWith("en")) return "US";
      if (lang.startsWith("fr")) return "FR";
      if (lang.startsWith("de")) return "DE";
    } catch (e) {}
    return "US";
  }

  async function removeLikeItem(awemeId, context, opts, retries = 2) {
    if (typeof opts !== "object" || opts === null) {
      retries = typeof opts === "number" ? opts : 2;
      opts = {};
    }
    retries = opts.retries ?? retries;
    if (!context || !context.csrfToken) {
      throw new Error("csrfToken no encontrado");
    }
    const userAgent = context.userAgent || navigator.userAgent || "";
    const odinId = context.odinId || "";
    const region = getRegionFromLocale();
    const verifyFp = getCookie("s_v_web_id");
    const msToken = getCookie("msToken");
    const screenW = typeof window.screen !== "undefined" ? window.screen.width : 1536;
    const screenH = typeof window.screen !== "undefined" ? window.screen.height : 864;
    const refererUrl = opts.videoUrl || window.location.href || "https://www.tiktok.com/";
    const params = new URLSearchParams({
      aid: "1988",
      app_language: "es",
      app_name: "tiktok_web",
      aweme_id: String(awemeId),
      browser_language: "es",
      browser_name: "Mozilla",
      browser_online: "true",
      browser_platform: "Win32",
      browser_version: userAgent,
      channel: "tiktok_web",
      cookie_enabled: "true",
      data_collection_enabled: "true",
      device_id: "7469968254971495954",
      device_platform: "web_pc",
      focus_state: "true",
      from_page: "video",
      history_len: "2",
      is_fullscreen: "false",
      is_page_visible: "true",
      odinId: odinId,
      os: "windows",
      priority_region: region,
      referer: "",
      region: region,
      screen_height: String(screenH),
      screen_width: String(screenW),
      type: "0",
      tz_name: Intl.DateTimeFormat().resolvedOptions().timeZone,
      user_is_login: "true",
      webcast_language: "es",
    });
    if (verifyFp) params.set("verifyFp", verifyFp);
    if (msToken) params.set("msToken", msToken);
    const url = `https://www.tiktok.com/api/commit/item/digg/?${params.toString()}`;
    let lastErr;
    for (let attempt = 1; attempt <= retries; attempt++) {
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            accept: "*/*",
            "accept-language": (navigator.language || "es") + ",es;q=0.9",
            "content-type": "application/x-www-form-urlencoded",
            origin: "https://www.tiktok.com",
            referer: refererUrl,
            "tt-csrf-token": context.csrfToken,
          },
          credentials: "same-origin",
          body: "",
        });
        const raw = await res.text();
        if (res.status === 403 || res.status === 401) {
          throw new Error("HTTP " + res.status + " (¿sesión/CSRF inválido?). Recarga la página de TikTok e inténtalo de nuevo.");
        }
        if (!res.ok) {
          const preview = raw.trim().slice(0, 80).replace(/\s+/g, " ");
          throw new Error("HTTP " + res.status + (preview ? ": " + preview : ""));
        }
        if (!raw || !raw.trim()) {
          return true;
        }
        let json;
        try {
          json = JSON.parse(raw);
        } catch (e) {
          const preview = raw.trim().slice(0, 80).replace(/\s+/g, " ");
          const hint = /^\s*</.test(raw) ? "(¿Página HTML?)" : "";
          throw new Error("La respuesta no es JSON. HTTP " + res.status + (hint ? " " + hint : "") + (preview ? ": " + preview : ""));
        }
        if (json.status_code !== 0) {
          throw new Error("Error en removeLikeItem: " + JSON.stringify(json));
        }
        return true;
      } catch (e) {
        lastErr = e;
        if (attempt < retries) {
          await sleep(2000);
        }
      }
    }
    throw lastErr;
  }

  function parseKeywords(str) {
    if (!str || !String(str).trim()) return [];
    return String(str)
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
      .map((s) => s.toLowerCase());
  }

  function matchesKeywords(desc, keywordList) {
    if (keywordList.length === 0) return true;
    const text = (desc || "").toLowerCase();
    return keywordList.some((k) => text.includes(k));
  }

  function randomDelayMs(config) {
    if (config.requestIntervalMode === "set") {
      const arr = config.requestIntervalSet || [1, 3, 5];
      const v = arr[Math.floor(Math.random() * arr.length)] ?? 1;
      return Math.max(0, v) * 1000;
    }
    const { min = 1, max = 3 } = config.requestIntervalRange || {};
    const a = Math.max(0, min);
    const b = Math.max(a, max);
    const sec = a + Math.random() * (b - a);
    return sec * 1000;
  }

  function createInPagePanel(i18n) {
    const t = i18n || {};
    const id = "tiktok-likes-remover-panel";
    if (document.getElementById(id)) return document.getElementById(id);
    const panel = document.createElement("div");
    panel.id = id;
    panel.innerHTML = `
      <div class="tlr-glow-top"></div>
      <div class="tlr-header">
        <div class="tlr-header-left">
          <div class="tlr-logo">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/><path d="M9 6V4a1 1 0 011-1h4a1 1 0 011 1v2"/>
            </svg>
          </div>
          <span class="tlr-title">${t.panelTitle || "Eliminador de likes"}</span>
        </div>
        <button type="button" class="tlr-close" aria-label="${t.panelClose || "Cerrar"}">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div class="tlr-body">
        <div class="tlr-status-row">
          <span class="tlr-pulse-dot" id="tlr-pulse-dot"></span>
          <div class="tlr-status" id="tlr-status">${t.statusPreparing || "Preparando..."}</div>
        </div>

        <div class="tlr-progress-wrap" id="tlr-progress-container" style="display:none">
          <div class="tlr-progress-track">
            <div class="tlr-progress-bar" id="tlr-progress-bar"></div>
          </div>
          <span class="tlr-progress-pct" id="tlr-progress-pct">0%</span>
        </div>

        <div class="tlr-stats-grid" id="tlr-stats"></div>
      </div>

      <div class="tlr-actions">
        <button type="button" class="tlr-btn tlr-pause" id="tlr-pause-btn">
          <svg class="tlr-btn-icon tlr-icon-pause" width="13" height="13" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>
          <svg class="tlr-btn-icon tlr-icon-resume" width="13" height="13" viewBox="0 0 24 24" fill="currentColor" style="display:none"><polygon points="5 3 19 12 5 21 5 3"/></svg>
          <span class="tlr-pause-label">${t.btnPause || "Pausar"}</span>
        </button>
        <button type="button" class="tlr-btn tlr-download" id="tlr-download-btn" disabled>
          <svg class="tlr-btn-icon" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
          <span>${t.btnDownloadReport || "Descargar informe"}</span>
        </button>
      </div>
    `;

    Object.assign(panel.style, {
      position: "fixed",
      top: "24px",
      right: "24px",
      width: "320px",
      maxWidth: "calc(100vw - 48px)",
      zIndex: "2147483647",
      fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, "Helvetica Neue", sans-serif',
      fontSize: "13px",
      color: "#f0f0f0",
      overflow: "hidden",
      borderRadius: "16px",
      background: "rgba(12, 12, 14, 0.96)",
      border: "1px solid rgba(255,255,255,0.08)",
      boxShadow: "0 24px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,0,80,0.15), inset 0 1px 0 rgba(255,255,255,0.06)",
      backdropFilter: "blur(24px)",
      WebkitBackdropFilter: "blur(24px)",
      animation: "tlr-in 0.35s cubic-bezier(0.34,1.56,0.64,1) both",
    });

    const sheet = document.createElement("style");
    sheet.textContent = `
      @keyframes tlr-in {
        from { opacity: 0; transform: translateY(-12px) scale(0.96); }
        to   { opacity: 1; transform: translateY(0)    scale(1); }
      }
      @keyframes tlr-pulse-ring {
        0%   { box-shadow: 0 0 0 0 rgba(0,242,234,0.5); }
        70%  { box-shadow: 0 0 0 6px rgba(0,242,234,0); }
        100% { box-shadow: 0 0 0 0 rgba(0,242,234,0); }
      }
      @keyframes tlr-bar-shine {
        from { background-position: -200% center; }
        to   { background-position: 200% center; }
      }
      @keyframes tlr-spin {
        to { transform: rotate(360deg); }
      }

      #tiktok-likes-remover-panel * { box-sizing: border-box; margin: 0; padding: 0; }

      .tlr-glow-top {
        position: absolute;
        top: 0; left: 50%;
        transform: translateX(-50%);
        width: 180px; height: 1px;
        background: linear-gradient(90deg, transparent, #ff0050 40%, #00f2ea 60%, transparent);
        opacity: 0.8;
      }

      .tlr-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding: 10px 12px 9px;
        cursor: grab;
        user-select: none;
        border-bottom: 1px solid rgba(255,255,255,0.06);
      }
      .tlr-header:active { cursor: grabbing; }
      .tlr-header-left { display: flex; align-items: center; gap: 10px; }

      .tlr-logo {
        width: 24px; height: 24px;
        border-radius: 7px;
        background: linear-gradient(135deg, #ff0050, #ff3366 50%, #00f2ea);
        display: flex; align-items: center; justify-content: center;
        color: #fff;
        flex-shrink: 0;
        box-shadow: 0 2px 8px rgba(255,0,80,0.4);
      }

      .tlr-title {
        font-size: 12.5px;
        font-weight: 600;
        letter-spacing: -0.01em;
        color: #f0f0f0;
      }

      .tlr-close {
        width: 26px; height: 26px;
        display: flex; align-items: center; justify-content: center;
        background: rgba(255,255,255,0.06);
        border: none;
        border-radius: 7px;
        color: #666;
        cursor: pointer;
        transition: background 0.2s, color 0.2s;
        flex-shrink: 0;
      }
      .tlr-close:hover { background: rgba(255,0,80,0.15); color: #ff0050; }

      .tlr-body { padding: 10px 12px 10px; display: flex; flex-direction: column; gap: 8px; }

      .tlr-status-row {
        display: flex;
        align-items: flex-start;
        gap: 9px;
      }
      .tlr-pulse-dot {
        width: 8px; height: 8px;
        border-radius: 50%;
        background: #00f2ea;
        flex-shrink: 0;
        margin-top: 4px;
        animation: tlr-pulse-ring 1.8s ease-out infinite;
      }
      .tlr-pulse-dot.paused { background: #ff0050; animation: none; }
      .tlr-pulse-dot.done   { background: #4ade80; animation: none; }

      .tlr-status {
        font-size: 12.5px;
        line-height: 1.5;
        color: #c8c8c8;
        word-break: break-word;
        font-weight: 400;
      }

      .tlr-progress-wrap {
        display: flex;
        align-items: center;
        gap: 10px;
      }
      .tlr-progress-track {
        flex: 1;
        height: 4px;
        background: rgba(255,255,255,0.08);
        border-radius: 99px;
        overflow: hidden;
      }
      .tlr-progress-bar {
        height: 100%;
        width: 0%;
        background: linear-gradient(90deg, #ff0050, #ff3366 40%, #00f2ea 80%, #ff0050);
        background-size: 200% 100%;
        border-radius: 99px;
        transition: width 0.4s ease;
        animation: tlr-bar-shine 2.5s linear infinite;
      }
      .tlr-progress-pct {
        font-size: 11px;
        font-weight: 600;
        color: #00f2ea;
        min-width: 32px;
        text-align: right;
        font-variant-numeric: tabular-nums;
        letter-spacing: -0.02em;
      }

      .tlr-stats-grid {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
        gap: 5px;
      }
      .tlr-stat-card {
        background: rgba(255,255,255,0.04);
        border: 1px solid rgba(255,255,255,0.07);
        border-radius: 8px;
        padding: 6px 8px;
        display: flex;
        flex-direction: column;
        gap: 1px;
      }
      .tlr-stat-label {
        font-size: 9px;
        text-transform: uppercase;
        letter-spacing: 0.05em;
        color: #555;
        font-weight: 500;
        white-space: nowrap;
      }
      .tlr-stat-value {
        font-size: 16px;
        font-weight: 700;
        color: #f0f0f0;
        letter-spacing: -0.03em;
        line-height: 1.1;
        font-variant-numeric: tabular-nums;
      }
      .tlr-stat-value.accent  { color: #00f2ea; }
      .tlr-stat-value.danger  { color: #ff6b6b; }
      .tlr-stat-value.success { color: #4ade80; }

      .tlr-actions {
        display: flex;
        gap: 6px;
        padding: 0 12px 10px;
      }
      .tlr-btn {
        flex: 1;
        display: flex;
        align-items: center;
        justify-content: center;
        gap: 5px;
        padding: 7px 10px;
        border: none;
        border-radius: 8px;
        cursor: pointer;
        font-size: 12px;
        font-weight: 600;
        letter-spacing: -0.01em;
        transition: transform 0.15s, opacity 0.15s, background 0.2s;
      }
      .tlr-btn:active:not(:disabled) { transform: scale(0.97); }
      .tlr-btn-icon { flex-shrink: 0; }

      .tlr-pause {
        background: rgba(255,255,255,0.08);
        color: #e0e0e0;
        border: 1px solid rgba(255,255,255,0.1);
      }
      .tlr-pause:hover:not(:disabled) { background: rgba(255,255,255,0.13); }
      .tlr-pause.resumed {
        background: rgba(255,0,80,0.18);
        color: #ff6b8a;
        border-color: rgba(255,0,80,0.3);
      }
      .tlr-pause.resumed:hover:not(:disabled) { background: rgba(255,0,80,0.26); }
      .tlr-pause:disabled { opacity: 0.35; cursor: not-allowed; }

      .tlr-download {
        background: linear-gradient(135deg, #ff0050, #ff3366 50%, #00f2ea);
        background-size: 200% 100%;
        color: #fff;
        border: none;
        transition: background-position 0.4s, transform 0.15s, opacity 0.15s;
      }
      .tlr-download:hover:not(:disabled) { background-position: 100% 0; }
      .tlr-download:disabled {
        background: rgba(255,255,255,0.05);
        color: #444;
        border: 1px solid rgba(255,255,255,0.07);
        cursor: not-allowed;
      }
    `;
    (document.head || document.documentElement).appendChild(sheet);
    var root = document.documentElement || document.body;
    if (root) root.appendChild(panel);

    // Lógica para arrastrar el panel (Mantenida intacta)
    const drag = (el) => {
      const header = el.querySelector(".tlr-header");
      if (!header) return;
      let startX = 0; let startY = 0; let startTop = 0; let startLeft = 0;
      header.onmousedown = (e) => {
        if (e.target.classList.contains('tlr-close')) return;
        e.preventDefault();
        const rect = el.getBoundingClientRect();
        startX = e.clientX; startY = e.clientY;
        startTop = rect.top + window.scrollY; startLeft = rect.left + window.scrollX;
        el.style.top = startTop + "px"; el.style.left = startLeft + "px"; el.style.right = "auto";
        const onMouseMove = (ev) => {
          ev.preventDefault();
          const nextTop = Math.max(0, startTop + (ev.clientY - startY));
          const nextLeft = Math.max(0, startLeft + (ev.clientX - startX));
          el.style.top = nextTop + "px"; el.style.left = nextLeft + "px";
        };
        const onMouseUp = () => {
          document.removeEventListener("mousemove", onMouseMove);
          document.removeEventListener("mouseup", onMouseUp);
        };
        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
      };
    };
    drag(panel);
    return panel;
  }

  function substitutePlaceholders(str, vals) {
    if (!str || !vals) return str;
    let s = str;
    vals.forEach((v, i) => {
      s = s.replace(new RegExp(`\\$${i + 1}\\$`, "g"), String(v));
    });
    return s;
  }

    function updatePanel(panel, state, i18n) {
    const t = i18n || {};
    const statusEl = panel.querySelector(".tlr-status");
    const statsEl = panel.querySelector(".tlr-stats-grid");
    const pauseBtn = panel.querySelector(".tlr-pause");
    const downloadBtn = panel.querySelector(".tlr-download");
    const progressContainer = panel.querySelector("#tlr-progress-container");
    const progressBar = panel.querySelector("#tlr-progress-bar");
    const progressPct = panel.querySelector("#tlr-progress-pct");
    const pulseDot = panel.querySelector("#tlr-pulse-dot");

    if (statusEl) statusEl.textContent = state.status;

    // Pulse dot state
    if (pulseDot) {
      pulseDot.className = "tlr-pulse-dot";
      if (state.paused) pulseDot.classList.add("paused");
      else if (state.reportReady && !state.paused) {
        const isDone = state.status && (state.status.includes("Listo") || state.status.includes("procesados") || state.status.includes("Likes"));
        if (isDone) pulseDot.classList.add("done");
      }
    }

    // Progress bar
    if (progressContainer && progressBar) {
      if (state.totalListed > 0) {
        progressContainer.style.display = "flex";
        const processed = (state.removed || 0) + (state.failed || 0);
        let pct = Math.min(100, (processed / state.totalListed) * 100);
        progressBar.style.width = `${pct}%`;
        if (progressPct) progressPct.textContent = Math.round(pct) + "%";
      } else {
        progressContainer.style.display = "none";
      }
    }

    // Stat cards
    if (statsEl) {
      const cards = [
        { label: t.statsRemoved || "Eliminados", value: state.removed ?? 0, cls: "success" },
        { label: t.statsListed  || "Listados",   value: state.totalListed ?? 0, cls: "accent" },
        { label: t.statsPages   || "Páginas",    value: state.pages ?? 0, cls: "" },
        { label: t.statsFailed  || "Fallidos",   value: state.failed ?? 0, cls: state.failed > 0 ? "danger" : "" },
      ];
      statsEl.innerHTML = cards.map(c => `
        <div class="tlr-stat-card">
          <span class="tlr-stat-label">${c.label}</span>
          <span class="tlr-stat-value ${c.cls}">${c.value}</span>
        </div>
      `).join("");
    }

    if (pauseBtn) {
      const isPaused = !!state.paused;
      const labelEl = pauseBtn.querySelector(".tlr-pause-label");
      const iconPause = pauseBtn.querySelector(".tlr-icon-pause");
      const iconResume = pauseBtn.querySelector(".tlr-icon-resume");
      if (labelEl) labelEl.textContent = isPaused ? (t.btnResume || "Reanudar") : (t.btnPause || "Pausar");
      if (iconPause)  iconPause.style.display  = isPaused ? "none" : "";
      if (iconResume) iconResume.style.display = isPaused ? "" : "none";
      pauseBtn.classList.toggle("resumed", isPaused);
      pauseBtn.disabled = !!state.disablePause;
    }

    if (downloadBtn) {
      downloadBtn.disabled = !state.reportReady;
      const baseLabel = t.btnDownloadReport || "Descargar informe";
      const hasData = state.removed > 0 || state.failed > 0;
      const suffix = state.reportReady && hasData ? (state.failed === 0 ? " ✓" : ` (${state.failed} err)`) : "";
      const spanEl = downloadBtn.querySelector("span:last-child");
      if (spanEl) spanEl.textContent = baseLabel + suffix;
    }
  }

  function buildReport(removedItems, failedItems, format) {
    const removed = removedItems && removedItems.length ? removedItems : [];
    const failed = failedItems && failedItems.length ? failedItems : [];
    if (format === "csv") {
      const headers = ["id", "authorName", "desc", "url", "status"];
      const row = (i, status) => [i.id, i.authorName, `"${(i.desc || "").replace(/"/g, '""').replace(/\n/g, " ")}"`, i.url, status];
      const rows = removed.map((i) => row(i, "eliminado")).concat(failed.map((i) => row(i, "fallido")));
      return [headers.join(",")].concat(rows.map((r) => r.join(","))).join("\n");
    }
    return JSON.stringify({ removed, failed }, null, 2);
  }

  function downloadReport(content, format) {
    const ext = format === "csv" ? "csv" : "json";
    const mime = format === "csv" ? "text/csv;charset=utf-8;" : "application/json;charset=utf-8;";
    const blob = new Blob([content], { type: mime });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `likes-eliminados-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  const MAX_CONSECUTIVE_FAILURES = 5;

  let panelState = {
    status: "Preparando...",
    pages: 0,
    removed: 0,
    failed: 0,
    totalListed: 0,
    paused: false,
    reportReady: false,
    reportItems: [],
    reportFailedItems: [],
    reportFormat: "json",
  };

  async function runRemoval(config) {
    config = config || {};
    var panel = createInPagePanel(config.i18n);
    if (!panel || !panel.parentNode) {
      console.error("Eliminador de likes TikTok: No se pudo crear el panel en la página.");
      return;
    }
    const keywordList = parseKeywords(config.keywordsFilter);
    panelState.reportFormat = config.exportFileType || "json";
    panelState.reportItems = [];
    panelState.reportFailedItems = [];
    panelState.removed = 0;
    panelState.failed = 0;
    panelState.disablePause = false;
    panelState.pages = 0;
    panelState.totalListed = 0;
    panelState.paused = false;
    panelState.reportReady = false;

    const pauseBtn = panel.querySelector("#tlr-pause-btn");
    const downloadBtn = panel.querySelector("#tlr-download-btn");
    const closeBtn = panel.querySelector(".tlr-close");
    const t0 = config.i18n || {};

    pauseBtn.onclick = () => {
      panelState.paused = !panelState.paused;
      panelState.status = panelState.paused ? t0.statusPaused || "En pausa" : t0.statusResuming || "Reanudando...";
      updatePanel(panel, panelState, t0);
    };
    downloadBtn.onclick = () => {
      const content = buildReport(panelState.reportItems, panelState.reportFailedItems, panelState.reportFormat);
      downloadReport(content, panelState.reportFormat);
    };
    closeBtn.onclick = () => panel.remove();

    const t = config.i18n || {};
    const setStatus = (s) => {
      panelState.status = s;
      updatePanel(panel, panelState, t);
    };

    try {
      if (config.notLoggedInRedirect) {
        panelState.paused = true;
        panelState.disablePause = true;
        setStatus(t.statusErrorRedirectedForyou || "Fuiste redirigido a 'Para ti' porque no has iniciado sesión. Inicia sesión, abre la extensión y pulsa Empezar de nuevo.");
        updatePanel(panel, panelState, t);
        return;
      }
      setStatus(t.statusWaiting || "Identificando tu cuenta...");
      var likeContext = await getLikeContextAsync();
      var secUid = likeContext.secUid || null;
      if (!secUid) {
        for (var i = 0; i < 12; i++) {
          await sleep(1500);
          likeContext = await getLikeContextAsync();
          secUid = likeContext.secUid || null;
          if (secUid) break;
        }
      }
      if (!secUid) {
        var onForyou = /\/foryou(\?|$)/i.test(window.location.href);
        var msg = onForyou
          ? t.statusErrorRedirectedForyou || "Fuiste redirigido a 'Para ti' porque no has iniciado sesión. Inicia sesión, abre la extensión y pulsa Empezar de nuevo."
          : t.statusErrorNoAccount || "No se pudo identificar tu cuenta.";
        panelState.paused = true;
        panelState.disablePause = true;
        setStatus(msg);
        updatePanel(panel, panelState, t);
        return;
      }
      if (!likeContext.csrfToken) {
        panelState.paused = true;
        panelState.disablePause = true;
        setStatus(t.statusErrorNoAccount || "No se pudo obtener el csrf de la sesión. Recarga TikTok e inténtalo de nuevo.");
        updatePanel(panel, panelState, t);
        return;
      }

      let cursor = 0;
      let page = 1;
      const pagePauseMs = Math.max(0, config.pagePauseSeconds ?? 5) * 1000;
      setStatus(t.statusListing || "Listando tus like...");

      while (true) {
        while (panelState.paused) await sleep(500);
        const result = await getLikedItems(cursor, secUid);
        if (!result || !result.items || result.items.length === 0) {
          setStatus(t.statusNone || "No se encontraron tus like.");
          panelState.reportReady = true;
          updatePanel(panel, panelState, t);
          break;
        }
        panelState.pages = page;
        panelState.totalListed = (panelState.totalListed || 0) + result.items.length;
        const candidates = result.items.filter((item) => matchesKeywords(item.desc, keywordList));
        const statusMsg = substitutePlaceholders(t.statusPageRemoving, [page, candidates.length, result.items.length]) || `Página ${page}: eliminando ${candidates.length} de ${result.items.length}...`;
        updatePanel(panel, { ...panelState, status: statusMsg }, t);

        let consecutiveFailures = 0;
        let stoppedDueToFailures = false;

        for (const item of candidates) {
          while (panelState.paused) await sleep(500);
          try {
            await removeLikeItemInPage(item.id);
            consecutiveFailures = 0;
            panelState.removed = (panelState.removed || 0) + 1;
            panelState.reportItems.push(item);
            panelState.reportReady = true;
            updatePanel(panel, { ...panelState, status: `${item.authorName} - ${item.desc}`.slice(0, 25) + "..." }, t);
          } catch (e) {
            console.error("Error al eliminar el like:", item.id, e);
            consecutiveFailures++;
            panelState.failed = (panelState.failed || 0) + 1;
            panelState.reportFailedItems = panelState.reportFailedItems || [];
            panelState.reportFailedItems.push(item);
            panelState.reportReady = true;
            setStatus(substitutePlaceholders(t.statusErrorRemove, [item.id]) || `Error al eliminar ${item.id}`);
            updatePanel(panel, panelState, t);
            if (consecutiveFailures >= MAX_CONSECUTIVE_FAILURES) {
              panelState.paused = true;
              panelState.disablePause = true;
              setStatus(substitutePlaceholders(t.statusStoppedFailures, [MAX_CONSECUTIVE_FAILURES]) || `Detenido: ${MAX_CONSECUTIVE_FAILURES} fallos consecutivos. Descarga el informe para ver cuáles fallaron.`);
              updatePanel(panel, panelState, t);
              stoppedDueToFailures = true;
              break;
            }
          }
          const delay = randomDelayMs(config);
          await sleep(delay);
        }
        if (stoppedDueToFailures) {
          panelState.paused = true;
          panelState.disablePause = true;
          updatePanel(panel, panelState, t);
          break;
        }
        if (!result.hasMore || !result.nextCursor) {
          setStatus(t.statusDone || "¡Listo! Todos los likes han sido procesados.");
          panelState.reportReady = true;
          updatePanel(panel, panelState, t);
          break;
        }
        cursor = result.nextCursor;
        page++;
        setStatus(t.statusBetweenPages || `Pausa antes de la siguiente página (${page})...`);
        await sleep(pagePauseMs);
      }
    } catch (err) {
      console.error("Eliminador de likes TikTok:", err);
      if (panel && panel.querySelector(".tlr-status")) {
        panel.querySelector(".tlr-status").textContent = "Error: " + (err.message || String(err));
      }
    }
  }

  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "startRemovingLikes") {
      try {
        runRemoval(msg.config);
        sendResponse({ ok: true });
      } catch (e) {
        console.error("Eliminador de likes TikTok:", e);
        sendResponse({ ok: false, error: String(e) });
      }
      return true;
    }
  });
})();