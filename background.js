function getTikTokContext() {
  try {
    var w = window.__$UNIVERSAL_DATA$__;
    if (!w || !w.__DEFAULT_SCOPE__) return null;
    var ctx = w.__DEFAULT_SCOPE__["webapp.app-context"];
    if (!ctx || !ctx.user) return null;
    var secUid = ctx.user.secUid || null;
    var csrfToken = ctx.csrfToken || null;
    var userAgent = ctx.userAgent || (typeof navigator !== "undefined" ? navigator.userAgent : "");
    var odinId = ctx.odinId || "";
    return { secUid: secUid, csrfToken: csrfToken, userAgent: userAgent, odinId: odinId };
  } catch (e) {
    return null;
  }
}

/** Se ejecuta en el contexto de la página (world: MAIN) para escuchar tlr-remove-like y hacer el POST
 * de eliminación de los like como en la consola, sin ser bloqueado por el CSP de la página. */
function setupPageRemoveListener() {
  if (window.__tlrPageRemoveReady) return;
  window.__tlrPageRemoveReady = true;
  window.addEventListener("tlr-remove-like", function (e) {
    var awemeId = e.detail && e.detail.awemeId;
    if (!awemeId) {
      window.dispatchEvent(new CustomEvent("tlr-remove-like-result", { detail: { awemeId: "", success: false, error: "falta awemeId" } }));
      return;
    }

    var ctx, csrfToken, userAgent, odinId;
    try {
      ctx = window.__$UNIVERSAL_DATA$__ && window.__$UNIVERSAL_DATA$__.__DEFAULT_SCOPE__ && window.__$UNIVERSAL_DATA$__.__DEFAULT_SCOPE__["webapp.app-context"];
      userAgent = (ctx && ctx.userAgent) || (typeof navigator !== "undefined" ? navigator.userAgent : "");
      odinId = (ctx && ctx.odinId) || "";
      // 1. Intentar token del contexto global
      csrfToken = ctx && ctx.csrfToken;
      // 2. Fallback a cookies (tt_csrf_token / tt-csrf-token)
      if (!csrfToken) {
        var cookieStr = (typeof document !== "undefined" && document.cookie) || "";
        var cookieMatch = cookieStr.match(/(?:^|;\s*)tt[_-]csrf[_-]token=([^;]+)/i);
        if (cookieMatch) csrfToken = decodeURIComponent(cookieMatch[1]);
      }
    } catch (err) {
      window.dispatchEvent(new CustomEvent("tlr-remove-like-result", { detail: { awemeId: awemeId, success: false, error: String(err && err.message) } }));
      return;
    }

    if (!csrfToken) {
      window.dispatchEvent(new CustomEvent("tlr-remove-like-result", { detail: { awemeId: awemeId, success: false, error: "csrfToken no encontrado (ni en contexto ni en cookies)" } }));
      return;
    }

    var params = new URLSearchParams({
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
      priority_region: "",
      referer: "",
      region: "ES",
      screen_height: String(window.screen && window.screen.height || 864),
      screen_width: String(window.screen && window.screen.width || 1536),
      type: "0",
      tz_name: typeof Intl !== "undefined" && Intl.DateTimeFormat && Intl.DateTimeFormat().resolvedOptions ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC",
      user_is_login: "true",
      webcast_language: "es",
    });

    var url = "https://www.tiktok.com/api/commit/item/digg/?" + params.toString();
    fetch(url, {
      method: "POST",
      headers: { accept: "*/*", "accept-language": "es,es-ES;q=0.9", "content-type": "application/x-www-form-urlencoded", "tt-csrf-token": csrfToken },
      body: "",
    })
      .then(function (res) { return res.text(); })
      .then(function (raw) {
        if (!raw || !raw.trim()) {
          window.dispatchEvent(new CustomEvent("tlr-remove-like-result", { detail: { awemeId: awemeId, success: true } }));
          return;
        }
        var json;
        try { json = JSON.parse(raw); } catch (e) {
          window.dispatchEvent(new CustomEvent("tlr-remove-like-result", { detail: { awemeId: awemeId, success: false, error: "JSON inválido" } }));
          return;
        }
        if (json.status_code !== 0) {
          window.dispatchEvent(new CustomEvent("tlr-remove-like-result", { detail: { awemeId: awemeId, success: false, error: JSON.stringify(json) } }));
          return;
        }
        window.dispatchEvent(new CustomEvent("tlr-remove-like-result", { detail: { awemeId: awemeId, success: true } }));
      })
      .catch(function (err) {
        window.dispatchEvent(new CustomEvent("tlr-remove-like-result", { detail: { awemeId: awemeId, success: false, error: String(err && err.message) } }));
      });
  });
}

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getSecUid" || request.action === "getLikeContext") {
    var tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse(request.action === "getLikeContext" ? { secUid: null, csrfToken: null, userAgent: "", odinId: "" } : { secUid: null });
      return true;
    }

    chrome.scripting.executeScript(
      { target: { tabId }, world: "MAIN", func: getTikTokContext },
      function (results) {
        var ctx = (results && results[0] && results[0].result) || null;
        if (request.action === "getLikeContext") {
          sendResponse({
            secUid: ctx ? ctx.secUid : null,
            csrfToken: ctx ? ctx.csrfToken : null,
            userAgent: ctx ? ctx.userAgent : "",
            odinId: ctx ? ctx.odinId : "",
          });
        } else {
          sendResponse({ secUid: ctx && ctx.secUid ? ctx.secUid : null });
        }
      }
    );
    return true;
  }

  if (request.action === "injectPageRemoveListener") {
    var tabId = sender.tab && sender.tab.id;
    if (!tabId) {
      sendResponse({ ok: false, error: "sin pestaña" });
      return true;
    }

    chrome.scripting.executeScript(
      { target: { tabId }, world: "MAIN", func: setupPageRemoveListener },
      function () {
        sendResponse(chrome.runtime.lastError ? { ok: false, error: String(chrome.runtime.lastError) } : { ok: true });
      }
    );
    return true;
  }

  if (request.action === "startRemovingLikes") {
    const config = request.config || request.payload?.config || {};
    chrome.tabs.create({ url: "https://www.tiktok.com/profile", active: true }, (tab) => {
      const tabId = tab.id;
      const listener = (id, info) => {
        if (id === tabId && info.status === "complete") {
          chrome.tabs.onUpdated.removeListener(listener);
          setTimeout(() => {
            chrome.tabs.get(tabId, (tabInfo) => {
              const url = (tabInfo && tabInfo.url) || "";
              const isForyou = /\/foryou(\?|$)/i.test(url);
              const isLogin = /\/login(\?|$|\/)/i.test(url);
              const notLoggedInRedirect = isForyou || isLogin;
              const payload = { ...config, notLoggedInRedirect };
              
              function sendConfig(attempt) {
                chrome.tabs.sendMessage(tabId, { action: "startRemovingLikes", config: payload })
                  .catch((e) => {
                    if (attempt < 3) setTimeout(() => sendConfig(attempt + 1), 800);
                  });
              }
              
              sendConfig(0);
            });
          }, 4000);
        }
      };
      chrome.tabs.onUpdated.addListener(listener);
    });
    sendResponse({ ok: true });
    return true;
  }
});