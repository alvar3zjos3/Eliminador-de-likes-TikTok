async function checkTiktokLogin() {
  try {
    const cookies = await chrome.cookies.getAll({ domain: "tiktok.com" });
    const hasMultiSids = cookies.some((c) => c.name === "multi_sids");
    const hasLivingUserId = cookies.some((c) => c.name === "living_user_id");
    return !!(hasMultiSids || hasLivingUserId);
  } catch (e) {
    return false;
  }
}

const I18N_KEYS_PANEL = [
  "panelTitle", "statusPreparing", "statusPaused", "statusResuming", "btnPause", "btnResume",
  "btnDownloadReport", "statusWaiting", "statusListing", "statusPageRemoving", "statusDone",
  "statusNone", "statusErrorNoAccount", "statusErrorRedirectedForyou", "statusErrorRemove", "panelClose", "statsPages",
  "statsRemoved", "statsListed", "statsFailed", "statusStoppedFailures", "statusBetweenPages"
];

function applyI18n() {
  const i18n = typeof chrome !== "undefined" && chrome.i18n ? chrome.i18n : null;
  const getMsg = (key) => (i18n ? i18n.getMessage(key) : "") || "";
  
  document.querySelectorAll("[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const msg = getMsg(key);
    if (msg) el.innerHTML = msg;
  });
  
  document.querySelectorAll("[data-i18n-title]").forEach((el) => {
    const key = el.getAttribute("data-i18n-title");
    const msg = getMsg(key);
    if (msg) el.title = msg;
  });
  
  document.querySelectorAll("[data-i18n-placeholder]").forEach((el) => {
    const key = el.getAttribute("data-i18n-placeholder");
    const msg = getMsg(key);
    if (msg) el.placeholder = msg;
  });
  
  document.querySelectorAll("option[data-i18n]").forEach((el) => {
    const key = el.getAttribute("data-i18n");
    const msg = getMsg(key);
    if (msg) el.textContent = msg;
  });
}

function getPanelI18n() {
  const i18n = typeof chrome !== "undefined" && chrome.i18n ? chrome.i18n : null;
  const o = {};
  I18N_KEYS_PANEL.forEach((key) => { 
    o[key] = (i18n && i18n.getMessage(key)) || key; 
  });
  return o;
}

function getConfig() {
  const useKeywords = document.getElementById("useKeywords").checked;
  const keywordsFilter = useKeywords ? (document.getElementById("keywordsInput").value || "").trim() : "";
  const intervalMode = document.getElementById("intervalMode").value;
  let intervalMin = Math.max(1, Math.min(10, parseInt(document.getElementById("intervalMin").value, 10) || 1));
  let intervalMax = Math.max(1, Math.min(10, parseInt(document.getElementById("intervalMax").value, 10) || 3));
  
  if (intervalMin > intervalMax) intervalMax = intervalMin;
  
  const intervalSetStr = (document.getElementById("intervalSet").value || "1,3,5")
    .split(",").map((s) => parseInt(s.trim(), 10)).filter((n) => !isNaN(n) && n >= 0);
  const requestIntervalSet = intervalSetStr.length ? intervalSetStr : [1, 3, 5];
  
  const reportFormat = document.getElementById("reportFormat").value;
  const pagePause = Math.max(0, Math.min(120, parseInt(document.getElementById("pagePause").value, 10) || 5));
  
  return {
    keywordsFilter,
    requestIntervalMode: intervalMode,
    requestIntervalRange: { min: intervalMin, max: intervalMax },
    requestIntervalSet,
    exportFileType: reportFormat,
    pagePauseSeconds: pagePause,
    i18n: getPanelI18n(),
  };
}

function getStorage() {
  return (typeof chrome !== "undefined" && chrome.storage && chrome.storage.local) ? chrome.storage.local : null;
}

function loadSavedConfig() {
  const storage = getStorage();
  if (!storage) return;
  storage.get("tlvrConfig", (data) => {
    const c = data && data.tlvrConfig;
    if (!c) return;
    try {
      if (c.useKeywords != null) document.getElementById("useKeywords").checked = !!c.useKeywords;
      const kw = document.getElementById("keywordsInput");
      if (kw) {
        if (c.keywordsFilter) kw.value = c.keywordsFilter;
        kw.disabled = !document.getElementById("useKeywords").checked;
      }
      
      if (c.requestIntervalMode) document.getElementById("intervalMode").value = c.requestIntervalMode;
      const isRange = document.getElementById("intervalMode").value === "range";
      const rangeGrp = document.getElementById("intervalRangeGroup");
      const setGrp = document.getElementById("intervalSetGroup");
      
      if (rangeGrp) rangeGrp.style.display = isRange ? "flex" : "none";
      if (setGrp) {
        setGrp.style.display = isRange ? "none" : "flex";
        if (isRange) setGrp.setAttribute("hidden", "");
        else setGrp.removeAttribute("hidden");
      }
      
      if (c.requestIntervalRange) {
        const minEl = document.getElementById("intervalMin");
        const maxEl = document.getElementById("intervalMax");
        const minVal = Math.max(1, Math.min(10, c.requestIntervalRange.min ?? 1));
        const maxVal = Math.max(1, Math.min(10, c.requestIntervalRange.max ?? 3));
        if (minEl) minEl.value = minVal;
        if (maxEl) maxEl.value = Math.max(minVal, maxVal);
        
        const fillEl = document.getElementById("intervalRangeFill");
        const displayEl = document.getElementById("intervalRangeDisplay");
        
        if (minEl && maxEl) {
          const min = parseInt(minEl.value, 10) || 1;
          const max = parseInt(maxEl.value, 10) || 3;
          const range = 10 - 1;
          const pctMin = ((min - 1) / range) * 100;
          const pctWidth = ((max - min) / range) * 100;
          if (fillEl) { fillEl.style.left = pctMin + "%"; fillEl.style.width = pctWidth + "%"; }
          if (displayEl) displayEl.textContent = min + "s – " + max + "s";
        }
      }
      
      if (c.requestIntervalSet && c.requestIntervalSet.length) {
        const setEl = document.getElementById("intervalSet");
        if (setEl) setEl.value = c.requestIntervalSet.join(", ");
      }
      
      if (c.exportFileType) document.getElementById("reportFormat").value = c.exportFileType;
      
      if (c.pagePauseSeconds != null) {
        const pp = document.getElementById("pagePause");
        if (pp) pp.value = Math.max(0, c.pagePauseSeconds);
      }
    } catch (err) {
      console.warn("Eliminador de likes TikTok: error al cargar configuración", err);
    }
  });
}

function saveConfig(config) {
  const storage = getStorage();
  if (!storage) return;
  try {
    storage.set({
      tlvrConfig: {
        useKeywords: !!config.keywordsFilter,
        keywordsFilter: config.keywordsFilter,
        requestIntervalMode: config.requestIntervalMode,
        requestIntervalRange: config.requestIntervalRange,
        requestIntervalSet: config.requestIntervalSet,
        exportFileType: config.exportFileType,
        pagePauseSeconds: config.pagePauseSeconds,
      },
    });
  } catch (err) {
    console.warn("Eliminador de likes TikTok: error al guardar configuración", err);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  applyI18n();
  loadSavedConfig();

  const configToggle = document.getElementById("configToggle");
  const configBody = document.getElementById("configBody");
  const configSection = document.querySelector(".popup-config");
  
  if (configSection && configToggle && configBody) {
    configToggle.addEventListener("click", function () {
      const isClosed = configSection.classList.toggle("is-closed");
      configToggle.setAttribute("aria-expanded", isClosed ? "false" : "true");
    });
  }

  const useKeywords = document.getElementById("useKeywords");
  const keywordsInput = document.getElementById("keywordsInput");
  useKeywords.addEventListener("change", function () {
    keywordsInput.disabled = !this.checked;
  });

  function updateDualRangeDisplay() {
    const minEl = document.getElementById("intervalMin");
    const maxEl = document.getElementById("intervalMax");
    const fillEl = document.getElementById("intervalRangeFill");
    const displayEl = document.getElementById("intervalRangeDisplay");
    
    if (!minEl || !maxEl) return;
    let min = Math.max(1, Math.min(10, parseInt(minEl.value, 10) || 1));
    let max = Math.max(1, Math.min(10, parseInt(maxEl.value, 10) || 3));
    
    if (min > max) max = min;
    minEl.value = min;
    maxEl.value = max;
    
    const range = 9;
    const pctMin = ((min - 1) / range) * 100;
    const pctWidth = ((max - min) / range) * 100;
    
    if (fillEl) { fillEl.style.left = pctMin + "%"; fillEl.style.width = pctWidth + "%"; }
    if (displayEl) displayEl.textContent = min + "s – " + max + "s";
  }

  const intervalMinEl = document.getElementById("intervalMin");
  const intervalMaxEl = document.getElementById("intervalMax");
  
  if (intervalMinEl && intervalMaxEl) {
    intervalMinEl.addEventListener("input", function () {
      const min = parseInt(this.value, 10);
      const maxEl = document.getElementById("intervalMax");
      if (maxEl && parseInt(maxEl.value, 10) < min) maxEl.value = min;
      updateDualRangeDisplay();
    });
    intervalMaxEl.addEventListener("input", function () {
      const max = parseInt(this.value, 10);
      const minEl = document.getElementById("intervalMin");
      if (minEl && parseInt(minEl.value, 10) > max) minEl.value = max;
      updateDualRangeDisplay();
    });
    updateDualRangeDisplay();
  }

  const intervalMode = document.getElementById("intervalMode");
  const intervalRangeGroup = document.getElementById("intervalRangeGroup");
  const intervalSetGroup = document.getElementById("intervalSetGroup");
  
  function syncIntervalGroups() {
    if (!intervalMode || !intervalRangeGroup || !intervalSetGroup) return;
    const isRange = intervalMode.value === "range";
    intervalRangeGroup.style.display = isRange ? "flex" : "none";
    intervalSetGroup.style.display = isRange ? "none" : "flex";
    if (isRange) intervalSetGroup.setAttribute("hidden", "");
    else intervalSetGroup.removeAttribute("hidden");
  }
  
  syncIntervalGroups();
  if (intervalMode) intervalMode.addEventListener("change", syncIntervalGroups);

  const loginButton = document.getElementById("loginButton");
  const startButton = document.getElementById("startButton");
  
  checkTiktokLogin().then((isLoggedIn) => {
    if (isLoggedIn) {
      startButton.disabled = false;
      startButton.style.display = "block";
      if (loginButton) { loginButton.style.display = "none"; loginButton.hidden = true; }
    } else {
      startButton.disabled = true;
      startButton.style.display = "none";
      if (loginButton) {
        loginButton.hidden = false;
        loginButton.style.display = "block";
        const i18n = typeof chrome !== "undefined" && chrome.i18n ? chrome.i18n : null;
        loginButton.title = (i18n && i18n.getMessage("notLoggedIn")) || "Primero inicia sesión en TikTok.";
      }
    }
  });

  if (loginButton) {
    loginButton.addEventListener("click", () => {
      chrome.tabs.create({ url: "https://www.tiktok.com/login", active: true });
      window.close();
    });
  }

  startButton.addEventListener("click", function () {
    if (startButton.disabled) return;
    const config = getConfig();
    saveConfig(config);
    chrome.runtime.sendMessage({
      action: "startRemovingLikes",
      payload: { config },
    });
    window.close();
  });
});