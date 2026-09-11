const STORAGE_KEY = "mymap-pin-app:v2";
const GROUPS_KEY = "mymap-pin-app:groups:v1";
const LEGACY_KEY = "mymap-pin-app:v1";
const API_KEY_STORAGE = "mymap-pin-app:google-key";
const OAUTH_KEY = "mymap-pin-app:oauth-client-id";
const DEFAULT_OAUTH_CLIENT_ID =
  "664582093232-q9cdpggq907t6qpm3sbfn5lqg8ks2hqi.apps.googleusercontent.com";
const MYMAP_URL_KEY = "mymap-pin-app:mymap-url";
const ACCOUNT_KEY = "mymap-pin-app:google-account";
const DRIVE_SCOPE = "https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/spreadsheets https://www.googleapis.com/auth/userinfo.email";
const DRIVE_DATA_NAME = "mymap-pin-app-data.json";
const DRIVE_DATA_ID_KEY = "mymap-pin-app:drive-data-id";
const LAYER_LIMIT = 1000;
const SHEET_FIELDS = ["address", "propertyName", "companyRep", "clientRep", "note"];
const DEFAULT_PIN_COLOR = "#e03131";
const PIN_COLOR_PRESETS = [
  ["赤", "#e03131"],
  ["オレンジ", "#f76707"],
  ["黄", "#f59f00"],
  ["緑", "#2f9e44"],
  ["青", "#1971c2"],
  ["紫", "#7048e8"],
  ["黒", "#343a40"],
];
const PROGRESS_OPTIONS = ["未着手", "対応中", "完了", "保留"];
const IMOBILE_SCRIPT = "https://imp-adedge.i-mobile.co.jp/script/v1/spot.js?20220104";
const IMOBILE_SPOT_PC = {
  pid: 85422,
  mid: 596245,
  asid: 1943777,
  type: "banner",
  display: "inline",
  elementid: "im-9487a01bf63f48a2b6e8d2d76a891f76",
};
const IMOBILE_SPOT_SP = {
  pid: 85422,
  mid: 596198,
  asid: 1943778,
  type: "banner",
  display: "inline",
  elementid: "im-6301f748d22642799a44fbc7353c2d79",
};

function isSmartphone() {
  return /Android.+Mobile|iPhone|iPod/i.test(navigator.userAgent);
}

function getImobileSpot() {
  return isSmartphone() ? IMOBILE_SPOT_SP : IMOBILE_SPOT_PC;
}

const state = {
  mapName: "",
  rows: [],
  map: null,
  markers: new Map(),
  locationMarker: null,
  searchMarker: null,
  mapReady: false,
  googleReady: false,
  geocoder: null,
  tokenClient: null,
  accessToken: "",
  userEmail: "",
  pendingAction: null,
  mapVisible: false,
  mapFullscreen: false,
  focusedRowId: null,
  locationMode: "address-and-name",
  groups: [],
  currentGroupId: null,
};

const els = {
  home: document.getElementById("home-view"),
  workspace: document.getElementById("workspace-view"),
  newRegister: document.getElementById("new-register"),
  openMyMap: document.getElementById("open-mymap"),
  openGoogleMyMaps: document.getElementById("open-google-mymaps"),
  registerGoogle: document.getElementById("register-google"),
  homeMapRegister: document.getElementById("home-map-register"),
  toolbarSaveMymap: document.getElementById("toolbar-save-mymap"),
  groupsDialog: document.getElementById("groups-dialog"),
  groupsList: document.getElementById("groups-list"),
  groupsEmpty: document.getElementById("groups-empty"),
  closeGroups: document.getElementById("close-groups"),
  syncGroups: document.getElementById("sync-groups"),
  groupsSyncNote: document.getElementById("groups-sync-note"),
  openMapRegister: document.getElementById("open-map-register"),
  closeMap: document.getElementById("close-map"),
  mapPane: document.getElementById("map-pane"),
  layerNotice: document.getElementById("layer-notice"),
  backHome: document.getElementById("back-home"),
  mapName: document.getElementById("map-name"),
  locationMode: document.querySelectorAll('input[name="location-mode"]'),
  sheetBody: document.getElementById("sheet-body"),
  addRow: document.getElementById("add-row"),
  addSamples: document.getElementById("add-samples"),
  exportCsv: document.getElementById("export-csv"),
  importCsv: document.getElementById("import-csv"),
  rowCount: document.getElementById("row-count"),
  fitPins: document.getElementById("fit-pins"),
  mapSearchForm: document.getElementById("map-search-form"),
  mapSearch: document.getElementById("map-search"),
  locateMe: document.getElementById("locate-me"),
  expandMap: document.getElementById("expand-map"),
  shrinkMap: document.getElementById("shrink-map"),
  signedInLabel: document.getElementById("signed-in-label"),
  googleSignin: document.getElementById("google-signin"),
  googleSignout: document.getElementById("google-signout"),
  accountBadge: document.getElementById("account-badge"),
  accountDialog: document.getElementById("account-dialog"),
  accountEmail: document.getElementById("account-email"),
  accountStatus: document.getElementById("account-status"),
  saveAccount: document.getElementById("save-account"),
  confirmAccount: document.getElementById("confirm-account"),
  closeAccount: document.getElementById("close-account"),
  settingsAccountEmail: document.getElementById("settings-account-email"),
  openSettings: document.getElementById("open-settings"),
  adDialog: document.getElementById("ad-dialog"),
  adFrame: document.getElementById("ad-frame"),
  homeAd: document.getElementById("home-ad"),
  adContinue: document.getElementById("ad-continue"),
  settingsDialog: document.getElementById("settings-dialog"),
  settingsForm: document.getElementById("settings-form"),
  oauthClientId: document.getElementById("oauth-client-id"),
  apiKey: document.getElementById("api-key-input"),
  myMapUrl: document.getElementById("mymap-url"),
  toast: document.getElementById("toast"),
  resultDialog: document.getElementById("result-dialog"),
  resultMessage: document.getElementById("result-message"),
  closeResult: document.getElementById("close-result"),
  quotaDialog: document.getElementById("quota-dialog"),
  closeQuota: document.getElementById("close-quota"),
  quotaStatus: document.getElementById("quota-status"),
  quotaCount: document.getElementById("quota-count"),
  quotaLimitNote: document.getElementById("quota-limit-note"),
  pasteClipboard: document.getElementById("paste-clipboard"),
  showMapButton: document.getElementById("show-map"),
  saveMymapFile: document.getElementById("save-mymap-file"),
};

function toast(message, ms = 2800) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), ms);
}

function parseCoord(value) {
  if (value == null || String(value).trim() === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function isValidLatLng(lat, lng) {
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return false;
  if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) return false;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return false;
  return true;
}

function isInJapan(lat, lng) {
  return lat >= 24 && lat <= 46 && lng >= 122 && lng <= 154;
}

function normalizePlaceQuery(text) {
  return String(text || "")
    .replace(/^\s*test\s*/i, "")
    .replace(/[()[\]【】［］]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function sanitizePinColor(value) {
  const text = String(value || "").trim();
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text.toLowerCase();
  if (/^#[0-9a-fA-F]{3}$/.test(text)) {
    return `#${text[1]}${text[1]}${text[2]}${text[2]}${text[3]}${text[3]}`.toLowerCase();
  }
  return DEFAULT_PIN_COLOR;
}

let pinColorMenuRow = null;

function closePinColorMenu() {
  const menu = document.getElementById("pin-color-menu");
  if (menu) menu.hidden = true;
  pinColorMenuRow = null;
}

function pinColorPresetButtons(selected) {
  const current = sanitizePinColor(selected);
  return PIN_COLOR_PRESETS.map(([name, value]) => {
    const active = current === value ? " is-selected" : "";
    return `<button type="button" class="pin-color-preset${active}" data-color="${value}" title="${name}" aria-label="${name}" style="background:${value}"></button>`;
  }).join("");
}

function ensurePinColorMenu() {
  let menu = document.getElementById("pin-color-menu");
  if (menu) return menu;
  menu = document.createElement("div");
  menu.id = "pin-color-menu";
  menu.className = "pin-color-menu";
  menu.hidden = true;
  menu.innerHTML = `
    <p class="pin-color-menu-title">ピンの色</p>
    <div class="pin-color-presets">${pinColorPresetButtons(DEFAULT_PIN_COLOR)}</div>
    <label class="pin-color-custom">
      自由に選ぶ
      <input type="color" class="pin-color" id="pin-color-custom" value="${DEFAULT_PIN_COLOR}" />
    </label>
  `;
  document.body.appendChild(menu);
  menu.addEventListener("click", (event) => event.stopPropagation());
  menu.querySelector(".pin-color-presets").addEventListener("click", (event) => {
    const button = event.target.closest("[data-color]");
    if (!button || !pinColorMenuRow) return;
    applyPinColor(pinColorMenuRow, button.dataset.color);
    closePinColorMenu();
  });
  menu.querySelector("#pin-color-custom").addEventListener("input", (event) => {
    if (!pinColorMenuRow) return;
    applyPinColor(pinColorMenuRow, event.target.value);
  });
  return menu;
}

function applyPinColor(row, color) {
  row.pinColor = sanitizePinColor(color);
  const tr = els.sheetBody?.querySelector(`tr[data-row-id="${row.id}"]`);
  const swatch = tr?.querySelector(".pin-color-swatch");
  if (swatch) {
    swatch.style.background = row.pinColor;
    swatch.title = `ピンの色 ${row.pinColor}`;
  }
  const menu = document.getElementById("pin-color-menu");
  if (menu) {
    menu.querySelector(".pin-color-presets").innerHTML = pinColorPresetButtons(row.pinColor);
    const custom = menu.querySelector("#pin-color-custom");
    if (custom) custom.value = row.pinColor;
  }
  saveState();
  syncMarkers();
}

function openPinColorMenu(row, anchor) {
  const menu = ensurePinColorMenu();
  pinColorMenuRow = row;
  menu.querySelector(".pin-color-presets").innerHTML = pinColorPresetButtons(row.pinColor);
  menu.querySelector("#pin-color-custom").value = sanitizePinColor(row.pinColor);
  menu.hidden = false;
  const rect = anchor.getBoundingClientRect();
  const width = menu.offsetWidth || 220;
  const left = Math.min(Math.max(8, rect.left), window.innerWidth - width - 8);
  const top = rect.bottom + 6;
  menu.style.left = `${left}px`;
  menu.style.top = `${top}px`;
}

function normalizeProgress(value) {
  const text = String(value || "").trim();
  return PROGRESS_OPTIONS.includes(text) ? text : "未着手";
}

function progressOptionsHtml(selected) {
  const current = normalizeProgress(selected);
  return PROGRESS_OPTIONS.map(
    (option) =>
      `<option value="${escapeAttr(option)}"${option === current ? " selected" : ""}>${escapeHtml(option)}</option>`
  ).join("");
}

function emptyRow() {
  return {
    id: crypto.randomUUID(),
    address: "",
    propertyName: "",
    companyRep: "",
    clientRep: "",
    progress: "未着手",
    note: "",
    pinColor: DEFAULT_PIN_COLOR,
    lat: null,
    lng: null,
  };
}

function cloneRows(rows) {
  return (Array.isArray(rows) ? rows : []).map((row) => {
    const lat = parseCoord(row?.lat);
    const lng = parseCoord(row?.lng);
    const valid = isValidLatLng(lat, lng) && isInJapan(lat, lng);
    return {
      id: row?.id || crypto.randomUUID(),
      address: row?.address || "",
      propertyName: row?.propertyName || "",
      companyRep: row?.companyRep || "",
      clientRep: row?.clientRep || "",
      progress: normalizeProgress(row?.progress),
      note: row?.note || "",
      pinColor: sanitizePinColor(row?.pinColor),
      lat: valid ? lat : null,
      lng: valid ? lng : null,
    };
  });
}

function persistGroups() {
  localStorage.setItem(
    GROUPS_KEY,
    JSON.stringify({
      currentGroupId: state.currentGroupId,
      groups: state.groups,
    })
  );
}

function applyCurrentGroup() {
  const group = state.groups.find((item) => item.id === state.currentGroupId);
  if (!group) {
    state.mapName = "";
    state.locationMode = "address-and-name";
    state.rows = [emptyRow()];
    return;
  }
  state.mapName = group.name || "";
  state.locationMode = group.locationMode || "address-and-name";
  state.rows = cloneRows(group.rows);
  if (!state.rows.length) state.rows = [emptyRow()];
  group.rows = state.rows;
}

function loadState() {
  try {
    const raw = localStorage.getItem(GROUPS_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      state.groups = Array.isArray(parsed.groups) ? parsed.groups : [];
      state.currentGroupId = parsed.currentGroupId || state.groups[0]?.id || null;
      applyCurrentGroup();
      return;
    }

    const previous = localStorage.getItem(STORAGE_KEY);
    if (previous) {
      const parsed = JSON.parse(previous);
      const rows = Array.isArray(parsed.rows) ? parsed.rows : [];
      if (parsed.mapName || rows.some((row) => row.address || row.propertyName)) {
        state.currentGroupId = crypto.randomUUID();
        state.groups = [
          {
            id: state.currentGroupId,
            name: parsed.mapName || "無題",
            locationMode: parsed.locationMode || "address-and-name",
            rows: rows.length ? rows : [emptyRow()],
            updatedAt: Date.now(),
          },
        ];
        persistGroups();
        applyCurrentGroup();
        return;
      }
    }

    const legacy = localStorage.getItem(LEGACY_KEY);
    if (legacy) {
      const pins = JSON.parse(legacy);
      state.currentGroupId = crypto.randomUUID();
      state.groups = [
        {
          id: state.currentGroupId,
          name: "無題",
          locationMode: "address-and-name",
          rows: pins.map((pin) => ({
            id: pin.id || crypto.randomUUID(),
            address: pin.address || "",
            propertyName: pin.name || "",
            companyRep: "",
            clientRep: "",
            note: pin.memo || "",
            progress: "未着手",
            pinColor: DEFAULT_PIN_COLOR,
            lat: pin.lat ?? null,
            lng: pin.lng ?? null,
          })),
          updatedAt: Date.now(),
        },
      ];
      persistGroups();
      applyCurrentGroup();
      return;
    }
  } catch {
    state.groups = [];
  }
  state.rows = [emptyRow()];
}

function saveState() {
  const name = (state.mapName || "").trim();
  if (!state.currentGroupId) {
    if (!name && !filledRows().length) return;
    state.currentGroupId = crypto.randomUUID();
    state.groups.unshift({
      id: state.currentGroupId,
      name: name || "無題",
      locationMode: getLocationMode(),
      rows: cloneRows(state.rows),
      updatedAt: Date.now(),
    });
  } else {
    const group = state.groups.find((item) => item.id === state.currentGroupId);
    if (group) {
      group.name = name || group.name || "無題";
      group.locationMode = getLocationMode();
      group.rows = cloneRows(state.rows);
      group.updatedAt = Date.now();
    }
  }
  persistGroups();
  scheduleDriveSync();
}

let driveSyncTimer = 0;

function scheduleDriveSync() {
  if (!state.accessToken) return;
  window.clearTimeout(driveSyncTimer);
  driveSyncTimer = window.setTimeout(() => {
    uploadServerGroups().catch(() => {});
  }, 1200);
}

function hasDriveScope(scopeText) {
  const text = String(scopeText || "");
  if (!text) return true;
  return text.includes("drive.file") || text.includes("userinfo.email") || text.includes("email");
}

function mergeGroups(localGroups, cloudGroups) {
  const map = new Map();
  [...(localGroups || []), ...(cloudGroups || [])].forEach((group) => {
    if (!group?.id) return;
    const prev = map.get(group.id);
    if (!prev || (Number(group.updatedAt) || 0) >= (Number(prev.updatedAt) || 0)) {
      map.set(group.id, group);
    }
  });
  return [...map.values()].sort((a, b) => (Number(b.updatedAt) || 0) - (Number(a.updatedAt) || 0));
}

function cloudHeaders() {
  return { Authorization: `Bearer ${state.accessToken}` };
}

function applySyncedGroups() {
  applyCurrentGroup();
  persistGroups();
  if (els.mapName) els.mapName.value = state.mapName;
  setLocationMode(state.locationMode);
  renderSheet();
  syncMarkers();
  if (els.groupsDialog?.open) renderGroups();
}

async function downloadServerGroups() {
  const response = await fetch("/api/groups", { headers: cloudHeaders() });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { error: [data.error || `保存サーバーエラー ${response.status}`, data.detail].filter(Boolean).join(" "), groups: [] };
  }
  return {
    groups: Array.isArray(data.groups) ? data.groups : [],
    currentGroupId: data.currentGroupId || null,
  };
}

async function uploadServerGroups() {
  if (!state.accessToken) return false;
  const response = await fetch("/api/groups", {
    method: "PUT",
    headers: { ...cloudHeaders(), "Content-Type": "application/json" },
    body: JSON.stringify({
      currentGroupId: state.currentGroupId,
      groups: state.groups,
      updatedAt: Date.now(),
    }),
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    toast([data.error, data.detail].filter(Boolean).join(" "), 6000);
    return false;
  }
  return true;
}

async function syncFromDrive() {
  if (!state.accessToken) return false;
  toast("グループを同期しています…");
  const cloud = await downloadServerGroups();
  if (cloud.error) {
    toast(cloud.error, 5000);
    return false;
  }
  if (cloud.groups.length) {
    state.groups = mergeGroups(state.groups, cloud.groups);
    if (cloud.currentGroupId && state.groups.some((group) => group.id === cloud.currentGroupId)) {
      state.currentGroupId = cloud.currentGroupId;
    } else if (!state.groups.some((group) => group.id === state.currentGroupId)) {
      state.currentGroupId = state.groups[0]?.id || null;
    }
    applySyncedGroups();
    const uploaded = await uploadServerGroups();
    if (uploaded) toast(`${savedGroups().length}件のグループを同期しました`, 5000);
    return uploaded;
  }
  if (savedGroups().length) {
    applySyncedGroups();
    const uploaded = await uploadServerGroups();
    if (uploaded) toast(`この端末の${savedGroups().length}件を保存しました。他の端末でも再同期してください`, 5000);
    return uploaded;
  }
  toast("保存されたグループはまだありません。グループがある端末で先に再同期してください", 5000);
  return true;
}

function startNewGroup() {
  saveState();
  state.currentGroupId = null;
  state.mapName = "";
  state.locationMode = "address-and-name";
  state.rows = [emptyRow()];
  hideMap();
  showWorkspace();
}

function openGroup(id) {
  state.currentGroupId = id;
  applyCurrentGroup();
  persistGroups();
  els.groupsDialog.close();
  showMap();
  refreshMapView();
}

function savedGroups() {
  return state.groups.filter((group) => group.name || (group.rows || []).some((row) => row.address || row.propertyName));
}

function renderGroups() {
  const groups = savedGroups();
  els.groupsList.innerHTML = "";
  els.groupsEmpty.hidden = groups.length > 0;
  groups.forEach((group) => {
    const count = (group.rows || []).filter((row) => row.address || row.propertyName).length;
    const item = document.createElement("li");
    item.className = "group-item";
    item.innerHTML = `
      <div>
        <h3>${escapeHtml(group.name || "無題")}</h3>
        <p>${count}件</p>
      </div>
      <div>
        <button type="button" class="btn compact primary" data-open>開く</button>
        <button type="button" class="btn danger" data-delete>削除</button>
      </div>
    `;
    item.querySelector("[data-open]").addEventListener("click", () => openGroup(group.id));
    item.querySelector("[data-delete]").addEventListener("click", () => {
      if (!window.confirm(`「${group.name || "無題"}」を削除しますか？`)) return;
      state.groups = state.groups.filter((item) => item.id !== group.id);
      if (state.currentGroupId === group.id) {
        state.currentGroupId = null;
        state.mapName = "";
        state.rows = [emptyRow()];
      }
      persistGroups();
      scheduleDriveSync();
      renderGroups();
    });
    els.groupsList.appendChild(item);
  });
}

function refreshMapView() {
  window.setTimeout(() => {
    if (!state.mapReady) initMap();
    else {
      state.map.invalidateSize();
      syncMarkers();
    }
    fitPins();
  }, 200);
}

function getLocationMode() {
  const selected = document.querySelector('input[name="location-mode"]:checked');
  return selected?.value || state.locationMode || "address-and-name";
}

function setLocationMode(mode) {
  state.locationMode = mode === "address" ? "address" : "address-and-name";
  document.querySelectorAll('input[name="location-mode"]').forEach((input) => {
    input.checked = input.value === state.locationMode;
  });
}

const CITY_PREF = {
  御殿場市: "静岡県",
  裾野市: "静岡県",
  富士市: "静岡県",
  富士宮市: "静岡県",
  沼津市: "静岡県",
  三島市: "静岡県",
  熱海市: "静岡県",
  伊東市: "静岡県",
  下田市: "静岡県",
  島田市: "静岡県",
  藤枝市: "静岡県",
  焼津市: "静岡県",
  掛川市: "静岡県",
  袋井市: "静岡県",
  磐田市: "静岡県",
  浜松市: "静岡県",
  静岡市: "静岡県",
  清水区: "静岡県",
  小田原市: "神奈川県",
  箱根町: "神奈川県",
  南足柄市: "神奈川県",
  富士吉田市: "山梨県",
  都留市: "山梨県",
};

function withPrefecture(address) {
  if (!address || /[都道府県]/.test(address)) return address;
  const city = Object.keys(CITY_PREF).find((name) => address.includes(name));
  return city ? `${CITY_PREF[city]}${address}` : address;
}

function untilStreetNumber(address) {
  const text = withPrefecture(address);
  const cut = text.replace(/[0-9０-９].*$/, "").replace(/[-−ー－、,\s]+$/g, "");
  return cut || text;
}

function locationQueries(row) {
  const address = withPrefecture(normalizePlaceQuery(row.address));
  const name = normalizePlaceQuery(row.propertyName);
  const district = untilStreetNumber(address);
  const queries = [];
  if (getLocationMode() === "address-and-name") {
    if (address && name) queries.push(`${address} ${name}`);
    if (district && name && district !== address) queries.push(`${district} ${name}`);
    if (address) queries.push(address);
    if (district && district !== address) queries.push(district);
  } else if (address) {
    queries.push(address);
    if (district && district !== address) queries.push(district);
  } else if (name) {
    queries.push(name);
  }
  return [...new Set(queries.filter(Boolean))];
}

function locationLabel(row) {
  return locationQueries(row)[0] || row.address || row.propertyName || "";
}

function filledRows() {
  return state.rows.filter((row) => row.address.trim() || row.propertyName.trim());
}

function ensureImobileScript() {
  if (document.querySelector(`script[src="${IMOBILE_SCRIPT}"]`)) return;
  const script = document.createElement("script");
  script.async = true;
  script.src = IMOBILE_SCRIPT;
  document.head.appendChild(script);
}

function requestImobileAd() {
  ensureImobileScript();
  (window.adsbyimobile = window.adsbyimobile || []).push({ ...getImobileSpot() });
}

function clearImobileSlots() {
  [IMOBILE_SPOT_PC.elementid, IMOBILE_SPOT_SP.elementid].forEach((id) => {
    document.getElementById(id)?.remove();
  });
}

function mountImobileAd(container) {
  if (!container) return;
  const spot = getImobileSpot();
  clearImobileSlots();
  container.replaceChildren();
  const slot = document.createElement("div");
  slot.id = spot.elementid;
  if (isSmartphone()) {
    slot.style.minWidth = "320px";
    slot.style.minHeight = "100px";
  }
  container.appendChild(slot);
  requestImobileAd();
}

function restoreHomeAd() {
  if (els.home?.hidden) return;
  mountImobileAd(els.homeAd);
}

function isAdOverlayOpen() {
  return Boolean(els.adDialog) && !els.adDialog.hidden;
}

function openAdOverlay() {
  document.body.classList.add("ad-open");
  els.adDialog.hidden = false;
}

function closeAdOverlay() {
  document.body.classList.remove("ad-open");
  els.adDialog.hidden = true;
}

function dismissAdOverlay() {
  window.clearInterval(withAd.timer);
  closeAdOverlay();
  restoreHomeAd();
}

function withAd(action) {
  state.pendingAction = action;
  els.adContinue.disabled = true;
  let left = 3;
  els.adContinue.textContent = `あと ${left} 秒`;
  openAdOverlay();
  const mountWhenVisible = () => {
    if (!isAdOverlayOpen()) return;
    if (els.adFrame.getBoundingClientRect().width > 0) {
      mountImobileAd(els.adFrame);
      return;
    }
    window.setTimeout(mountWhenVisible, 50);
  };
  window.requestAnimationFrame(() => window.requestAnimationFrame(mountWhenVisible));
  window.clearInterval(withAd.timer);
  withAd.timer = window.setInterval(() => {
    left -= 1;
    if (left <= 0) {
      window.clearInterval(withAd.timer);
      els.adContinue.disabled = false;
      els.adContinue.textContent = "続ける";
      return;
    }
    els.adContinue.textContent = `あと ${left} 秒`;
  }, 1000);
}

function finishAd() {
  dismissAdOverlay();
  const action = state.pendingAction;
  state.pendingAction = null;
  if (action) action();
}

function showHome() {
  hideMap();
  els.home.hidden = false;
  els.workspace.hidden = true;
  refreshQuotaDisplay();
  restoreHomeAd();
}

function showWorkspace() {
  els.home.hidden = true;
  els.workspace.hidden = false;
  els.mapName.value = state.mapName;
  setLocationMode(state.locationMode);
  renderSheet();
  refreshQuotaDisplay();
}

function showMap() {
  showWorkspace();
  state.mapVisible = true;
  els.mapPane.hidden = false;
  els.workspace.classList.add("map-open");
  if (els.showMapButton) els.showMapButton.hidden = true;
  refreshMapView();
}

function hideMap() {
  exitMapFullscreen();
  state.mapVisible = false;
  els.mapPane.hidden = true;
  els.workspace.classList.remove("map-open");
  if (els.showMapButton) els.showMapButton.hidden = false;
}

function enterMapFullscreen() {
  showMap();
  state.mapFullscreen = true;
  document.body.classList.add("map-fullscreen");
  els.workspace.classList.add("map-fullscreen");
  els.expandMap.hidden = true;
  els.shrinkMap.hidden = false;
  refreshMapView();
}

function exitMapFullscreen() {
  if (!state.mapFullscreen) return;
  state.mapFullscreen = false;
  document.body.classList.remove("map-fullscreen");
  els.workspace.classList.remove("map-fullscreen");
  els.expandMap.hidden = false;
  els.shrinkMap.hidden = true;
  refreshMapView();
}

function focusRowPin(row) {
  if (!isValidLatLng(row.lat, row.lng)) {
    toast("この行の位置がまだありません。「ピンを刺す」を押してください");
    return;
  }
  state.focusedRowId = row.id;
  highlightSheetRows();
  showMap();
  const go = () => {
    if (!state.mapReady) {
      window.setTimeout(go, 200);
      return;
    }
    syncMarkers();
    const marker = state.markers.get(row.id);
    state.map.flyTo([row.lat, row.lng], 17, { duration: 0.55 });
    if (marker) marker.openPopup();
  };
  window.setTimeout(go, 220);
}

function highlightSheetRows() {
  els.sheetBody.querySelectorAll("tr").forEach((tr) => {
    const focused = tr.dataset.rowId === state.focusedRowId;
    tr.classList.toggle("is-focused", focused);
    if (focused) tr.scrollIntoView({ block: "nearest", behavior: "smooth" });
  });
}

function focusPinFromMap(row, marker) {
  state.focusedRowId = row.id;
  highlightSheetRows();
  if (marker) marker.openPopup();
}

function renderSheet() {
  els.sheetBody.innerHTML = "";
  const rows = state.rows.length ? state.rows : [emptyRow()];
  if (!state.rows.length) state.rows = rows;
  rows.forEach((row, index) => {
    const tr = document.createElement("tr");
    tr.dataset.rowId = row.id;
    if (state.focusedRowId === row.id) tr.classList.add("is-focused");
    tr.innerHTML = `
      <td class="col-num" title="このピンを地図で見る">${index + 1}</td>
      <td class="col-color">
        <button type="button" class="pin-color-swatch" style="background:${escapeAttr(sanitizePinColor(row.pinColor))}" title="ピンの色" aria-label="ピンの色を選ぶ"></button>
      </td>
      <td><textarea data-field="address" rows="2" placeholder="○○県○○市...">${escapeHtml(row.address)}</textarea></td>
      <td><textarea data-field="propertyName" rows="2" placeholder="○○ビル">${escapeHtml(row.propertyName)}</textarea></td>
      <td><textarea data-field="companyRep" rows="2" placeholder="△△">${escapeHtml(row.companyRep)}</textarea></td>
      <td><textarea data-field="clientRep" rows="2" placeholder="○○">${escapeHtml(row.clientRep)}</textarea></td>
      <td class="col-progress">
        <select data-field="progress" aria-label="進捗">${progressOptionsHtml(row.progress)}</select>
      </td>
      <td><textarea data-field="note" rows="2">${escapeHtml(row.note)}</textarea></td>
      <td class="col-action">
        <button type="button" class="btn compact" data-nav title="Googleマップでナビ">ナビ</button>
        <button type="button" class="btn danger" data-delete>削除</button>
      </td>
    `;
    tr.querySelectorAll("textarea").forEach((input) => {
      input.addEventListener("input", () => {
        if (looksLikeSpreadsheet(input.value) && applyExcelPaste(index, input.dataset.field, input.value)) {
          return;
        }
        row[input.dataset.field] = input.value;
        if (input.dataset.field === "address") {
          row.lat = null;
          row.lng = null;
        }
        saveState();
        updateRowCount();
      });
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") event.preventDefault();
      });
      input.addEventListener("beforeinput", (event) => {
        if (event.inputType !== "insertFromPaste") return;
        const text = event.data || "";
        if (looksLikeSpreadsheet(text) && applyExcelPaste(index, input.dataset.field, text)) {
          event.preventDefault();
        }
      });
      input.addEventListener("paste", (event) => {
        void handleSheetPaste(event, index, input.dataset.field);
      });
    });
    tr.querySelector(".pin-color-swatch").addEventListener("click", (event) => {
      event.stopPropagation();
      const menu = document.getElementById("pin-color-menu");
      if (menu && !menu.hidden && pinColorMenuRow === row) {
        closePinColorMenu();
        return;
      }
      openPinColorMenu(row, event.currentTarget);
    });
    tr.querySelector("[data-field=progress]").addEventListener("change", (event) => {
      row.progress = normalizeProgress(event.target.value);
      saveState();
      syncMarkers();
    });
    tr.querySelector("[data-nav]").addEventListener("click", (event) => {
      event.stopPropagation();
      openNavigation(row);
    });
    tr.querySelector("[data-delete]").addEventListener("click", (event) => {
      event.stopPropagation();
      deleteRowById(row.id);
    });
    tr.addEventListener("click", (event) => {
      if (event.target.closest("textarea, button, input, select, label")) return;
      focusRowPin(row);
    });
    els.sheetBody.appendChild(tr);
  });
  updateRowCount();
}

function updateRowCount() {
  const count = filledRows().length;
  els.rowCount.textContent = `${count}件 / ${LAYER_LIMIT}件（1グループ上限）`;
  const over = count > LAYER_LIMIT;
  els.rowCount.classList.toggle("warn", over);
  els.layerNotice.classList.toggle("warn", over);
}

function escapeAttr(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function escapeHtml(value) {
  return escapeAttr(value);
}

function escapeXml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function escapeCsv(value) {
  const text = String(value ?? "");
  if (/[",\n]/.test(text)) return `"${text.replaceAll('"', '""')}"`;
  return text;
}

function isHeaderRow(cells) {
  const text = cells.join("");
  return ["住所", "物件名", "自社担当", "取引担当", "進捗", "備考", "address", "name"].some((label) =>
    text.includes(label)
  );
}

function parseHtmlTable(html) {
  if (!html || !/<table/i.test(html)) return "";
  try {
    const doc = new DOMParser().parseFromString(html, "text/html");
    const rows = [...doc.querySelectorAll("table tr")];
    if (!rows.length) return "";
    return rows
      .map((tr) =>
        [...tr.querySelectorAll("th,td")]
          .map((cell) => cell.textContent.replace(/\s+/g, " ").trim())
          .join("\t")
      )
      .join("\n");
  } catch {
    return "";
  }
}

function splitPasteRow(line) {
  if (line.includes("\t")) return line.split("\t").map((cell) => cell.trim());
  if (/\s{2,}/.test(line)) return line.split(/\s{2,}/).map((cell) => cell.trim());
  return [line.trim()];
}

function parsePasteGrid(text) {
  const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!raw.trim()) return [];
  const lines = raw.split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  let grid = lines.map(splitPasteRow).filter((cells) => cells.some((cell) => cell));
  if (grid.length && isHeaderRow(grid[0])) grid = grid.slice(1);
  return grid;
}

function looksLikeSpreadsheet(text) {
  const grid = parsePasteGrid(text);
  return grid.length > 1 || (grid.length === 1 && grid[0].length > 1);
}

function clipboardTextFromEvent(event) {
  const html = event.clipboardData?.getData("text/html") || "";
  const fromTable = parseHtmlTable(html);
  if (fromTable) return fromTable;
  return event.clipboardData?.getData("text/plain") || "";
}

let pasteBusy = false;

async function handleSheetPaste(event, startRowIndex, startField) {
  let text = clipboardTextFromEvent(event);
  if (!text && navigator.clipboard?.readText) {
    try {
      text = await navigator.clipboard.readText();
    } catch {
      text = "";
    }
  }
  if (!text) return;
  if (applyExcelPaste(startRowIndex, startField, text)) {
    event.preventDefault();
  }
}

function focusedSheetCell() {
  const active = document.activeElement;
  if (active?.dataset?.field && els.sheetBody.contains(active)) {
    const index = [...els.sheetBody.rows].indexOf(active.closest("tr"));
    return { index: Math.max(0, index), field: active.dataset.field };
  }
  return { index: 0, field: "address" };
}

async function pasteClipboardIntoSheet() {
  let text = "";
  try {
    text = await navigator.clipboard.readText();
  } catch {
    toast("クリップボードを読めませんでした。セルを長押しして貼り付けてください");
    return;
  }
  const target = focusedSheetCell();
  if (!applyExcelPaste(target.index, target.field, text)) {
    toast("表形式のデータをコピーしてから貼り付けてください");
  }
}

function applyExcelPaste(startRowIndex, startField, text) {
  const grid = parsePasteGrid(text);
  if (!grid.length || (grid.length === 1 && grid[0].length === 1)) return false;
  if (pasteBusy) return true;
  pasteBusy = true;

  const startCol = Math.max(0, SHEET_FIELDS.indexOf(startField));
  grid.forEach((cells, offset) => {
    const rowIndex = startRowIndex + offset;
    while (state.rows.length <= rowIndex) state.rows.push(emptyRow());
    const row = state.rows[rowIndex];
    const pasteFields =
      startField === "address" && cells.length >= 6
        ? ["address", "propertyName", "companyRep", "clientRep", "progress", "note"]
        : SHEET_FIELDS;
    cells.forEach((value, colOffset) => {
      const field = pasteFields[startCol + colOffset];
      if (!field) return;
      row[field] = field === "progress" ? normalizeProgress(value) : value;
      if (field === "address") {
        row.lat = null;
        row.lng = null;
      }
    });
  });

  if (filledRows().length === state.rows.length) state.rows.push(emptyRow());
  saveState();
  renderSheet();
  syncMarkers();
  const count = filledRows().length;
  if (count > LAYER_LIMIT) {
    toast(`${grid.length}件を貼り付けました。1グループは最大${LAYER_LIMIT}件です。超えた分は別グループへ分けてください`);
  } else {
    toast(`${grid.length}件を Excel から貼り付けました`);
  }
  window.setTimeout(() => {
    pasteBusy = false;
  }, 0);
  return true;
}

function createPinIcon(color) {
  return L.divIcon({
    className: "",
    html: `<div class="map-pin" style="background:${sanitizePinColor(color)}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -18],
  });
}

function destinationQuery(row) {
  if (isValidLatLng(row.lat, row.lng)) return `${row.lat},${row.lng}`;
  return String(locationLabel(row) || "").trim();
}

function navigationUrl(row) {
  const destination = destinationQuery(row);
  if (!destination) return "";
  const apple = /iPad|iPhone|iPod/.test(navigator.userAgent);
  if (apple) {
    const url = new URL("https://maps.apple.com/");
    url.searchParams.set("daddr", destination);
    url.searchParams.set("dirflg", "d");
    return url.toString();
  }
  const url = new URL("https://www.google.com/maps/dir/");
  url.searchParams.set("api", "1");
  url.searchParams.set("destination", destination);
  url.searchParams.set("travelmode", "driving");
  return url.toString();
}

function openNavigation(row) {
  const url = navigationUrl(row);
  if (!url) {
    toast("この行の位置がまだありません。「ピンを刺す」を押してください");
    return;
  }
  window.open(url, "_blank", "noopener");
}

function popupHtml(row) {
  const nav = navigationUrl(row);
  const navControl = nav
    ? `<a class="btn compact pin-popup-nav" href="${escapeAttr(nav)}" target="_blank" rel="noopener" data-nav-pin>ナビ</a>`
    : "";
  return `<div class="pin-popup">
      <strong>${escapeHtml(row.propertyName || row.address)}</strong><br>${escapeHtml(row.address)}
      <br>自社: ${escapeHtml(row.companyRep || "-")} / 取引: ${escapeHtml(row.clientRep || "-")}
      <br>進捗: ${escapeHtml(normalizeProgress(row.progress))}
      <div class="pin-popup-actions">
        ${navControl}
        <button type="button" class="btn danger pin-popup-delete" data-delete-pin="${escapeAttr(row.id)}">このピンを削除</button>
      </div>
    </div>`;
}

function deleteRowById(id) {
  if (!id || !state.rows.some((item) => item.id === id)) return;
  state.rows = state.rows.filter((item) => item.id !== id);
  if (!state.rows.length) state.rows.push(emptyRow());
  if (state.focusedRowId === id) state.focusedRowId = null;
  const marker = state.markers.get(id);
  if (marker) {
    marker.closePopup();
    marker.remove();
    state.markers.delete(id);
  }
  saveState();
  renderSheet();
  syncMarkers();
  toast("ピンを削除しました");
}

function bindPinPopupActions(popup) {
  const root = popup?.getElement?.();
  if (!root) return;
  const deleteButton = root.querySelector("[data-delete-pin]");
  if (deleteButton) L.DomEvent.disableClickPropagation(deleteButton);
  const navLink = root.querySelector("[data-nav-pin]");
  if (navLink) L.DomEvent.disableClickPropagation(navLink);
}

function bindGlobalPinPopupClicks() {
  if (bindGlobalPinPopupClicks.done) return;
  bindGlobalPinPopupClicks.done = true;
  let lastDelete = 0;
  const handler = (event) => {
    const deleteButton = event.target.closest?.("[data-delete-pin]");
    if (!deleteButton) return;
    event.preventDefault();
    event.stopPropagation();
    const now = Date.now();
    if (now - lastDelete < 400) return;
    lastDelete = now;
    deleteRowById(deleteButton.getAttribute("data-delete-pin"));
  };
  document.addEventListener("pointerup", handler, true);
  document.addEventListener("click", handler, true);
}

function isMapUiTarget(target) {
  return Boolean(
    target?.closest?.(
      ".leaflet-marker-icon, .leaflet-popup, .leaflet-control, .map-pin, .map-locate, .map-controls, .pin-popup"
    )
  );
}

async function addPinAt(latlng) {
  if (!latlng) return;
  const lat = latlng.lat;
  const lng = latlng.lng;
  if (!isValidLatLng(lat, lng)) return;
  toast("住所を取得しています…");
  const address = await reverseGeocode(lat, lng);
  const blank = state.rows.find((row) => !row.address.trim());
  const row = blank || emptyRow();
  row.address = address;
  row.propertyName = row.propertyName || address.split(/[,\s]/)[0];
  row.lat = lat;
  row.lng = lng;
  if (!blank) state.rows.push(row);
  saveState();
  renderSheet();
  syncMarkers();
}

function syncMarkers() {
  if (!state.map) return;
  const keep = new Set(state.rows.map((row) => row.id));
  for (const [id, marker] of state.markers.entries()) {
    if (!keep.has(id)) {
      marker.remove();
      state.markers.delete(id);
    }
  }
  state.rows.forEach((row) => {
    if (!isValidLatLng(row.lat, row.lng)) return;
    const existing = state.markers.get(row.id);
    if (existing) {
      existing.setLatLng([row.lat, row.lng]);
      existing.setIcon(createPinIcon(row.pinColor));
      existing.setPopupContent(popupHtml(row));
      bindPinPopupActions(existing.getPopup());
      existing.off("click");
      existing.on("click", () => focusPinFromMap(row, existing));
      return;
    }
    const marker = L.marker([row.lat, row.lng], { icon: createPinIcon(row.pinColor) })
      .addTo(state.map)
      .bindPopup(popupHtml(row));
    marker.on("click", () => focusPinFromMap(row, marker));
    state.markers.set(row.id, marker);
  });
}

function fitPins() {
  if (!state.map) return;
  const located = state.rows.filter((row) => isValidLatLng(row.lat, row.lng));
  if (!located.length) {
    state.map.setView([36.2, 138.25], 5);
    return;
  }
  state.map.fitBounds(
    L.latLngBounds(located.map((row) => [row.lat, row.lng])),
    { padding: [40, 40], maxZoom: 14 }
  );
}

function createLocationIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="map-user-dot"><span></span></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
    popupAnchor: [0, -12],
  });
}

function createSearchIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="map-pin map-pin-search"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -18],
  });
}

function showPointOnMap(lat, lng, label, kind) {
  if (!state.mapReady) initMap();
  const markerKey = kind === "location" ? "locationMarker" : "searchMarker";
  const icon = kind === "location" ? createLocationIcon() : createSearchIcon();
  if (state[markerKey]) {
    state[markerKey].setLatLng([lat, lng]);
    state[markerKey].setIcon(icon);
    state[markerKey].setPopupContent(escapeHtml(label));
  } else {
    state[markerKey] = L.marker([lat, lng], { icon, zIndexOffset: 1200 })
      .addTo(state.map)
      .bindPopup(escapeHtml(label));
  }
  state.map.setView([lat, lng], Math.max(state.map.getZoom() || 0, 15));
  state[markerKey].openPopup();
}

async function waitForMap() {
  if (!state.mapVisible) showMap();
  if (!state.mapReady) initMap();
  await new Promise((resolve) => window.setTimeout(resolve, 250));
  state.map?.invalidateSize();
}

async function searchWithNominatim(query) {
  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", query);
  url.searchParams.set("limit", "1");
  url.searchParams.set("countrycodes", "jp");
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "Accept-Language": "ja" },
    });
    if (!response.ok) return null;
    const data = await response.json();
    const hit = Array.isArray(data) ? data[0] : null;
    const lat = Number(hit?.lat);
    const lng = Number(hit?.lon);
    if (!isValidLatLng(lat, lng)) return null;
    return { lat, lng, label: hit.display_name || query };
  } catch {
    return null;
  }
}

async function searchMapPlace(query) {
  const text = String(query || "").trim();
  if (!text) {
    toast("検索する住所や地名を入力してください");
    return;
  }
  toast("場所を検索しています…");
  await waitForMap();
  let found = await searchWithNominatim(text);
  if (!found) {
    try {
      const geo = await geocodeAddress(text);
      if (geo) found = { lat: geo.lat, lng: geo.lng, label: geo.formatted || text };
    } catch (err) {
      if (err instanceof QuotaExceededError) {
        showQuotaDialog();
        return;
      }
    }
  }
  if (!found) {
    toast("場所が見つかりませんでした");
    return;
  }
  showPointOnMap(found.lat, found.lng, found.label, "search");
  toast("場所を表示しました");
}

function goToCurrentLocation() {
  if (!navigator.geolocation) {
    toast("この端末では現在地を使えません");
    return;
  }
  toast("現在地を取得しています…");
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      if (!isValidLatLng(lat, lng)) {
        toast("現在地を取得できませんでした");
        return;
      }
      await waitForMap();
      showPointOnMap(lat, lng, "現在地", "location");
      toast(isInJapan(lat, lng) ? "現在地を表示しました" : "日本の外の位置です");
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        toast("現在地の利用が許可されていません");
        return;
      }
      toast("現在地を取得できませんでした");
    },
    { enableHighAccuracy: true, timeout: 12000, maximumAge: 20000 }
  );
}

function initMap() {
  state.map = L.map("map").setView([36.2, 138.25], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(state.map);
  state.mapReady = true;
  state.map.on("popupopen", (event) => bindPinPopupActions(event.popup));
  let lastPinAt = 0;
  const placeFromEvent = (event) => {
    if (isMapUiTarget(event.originalEvent?.target)) return;
    const now = Date.now();
    if (now - lastPinAt < 800) return;
    lastPinAt = now;
    void addPinAt(event.latlng);
  };
  state.map.on("contextmenu", (event) => {
    L.DomEvent.preventDefault(event);
    placeFromEvent(event);
  });
  const mapEl = state.map.getContainer();
  let holdTimer = 0;
  const clearHold = () => window.clearTimeout(holdTimer);
  mapEl.addEventListener(
    "touchstart",
    (event) => {
      if (event.touches.length !== 1 || isMapUiTarget(event.target)) return;
      const touch = event.touches[0];
      clearHold();
      holdTimer = window.setTimeout(() => {
        const latlng = state.map.mouseEventToLatLng(touch);
        const now = Date.now();
        if (now - lastPinAt < 800) return;
        lastPinAt = now;
        navigator.vibrate?.(20);
        void addPinAt(latlng);
      }, 550);
    },
    { passive: true }
  );
  mapEl.addEventListener("touchend", clearHold, { passive: true });
  mapEl.addEventListener("touchcancel", clearHold, { passive: true });
  mapEl.addEventListener("touchmove", clearHold, { passive: true });
  mapEl.addEventListener("contextmenu", (event) => event.preventDefault());
  syncMarkers();
  if (state.rows.some((row) => isValidLatLng(row.lat, row.lng))) fitPins();
}

function getApiKey() {
  return localStorage.getItem(API_KEY_STORAGE) || "";
}

function getOauthClientId() {
  return localStorage.getItem(OAUTH_KEY) || DEFAULT_OAUTH_CLIENT_ID;
}

function getRegisteredEmail() {
  return localStorage.getItem(ACCOUNT_KEY) || state.userEmail || "";
}

function setRegisteredAccount(email) {
  const normalized = String(email || "").trim().toLowerCase();
  const previous = getRegisteredEmail();
  if (previous && normalized && previous !== normalized) {
    localStorage.removeItem(DRIVE_DATA_ID_KEY);
    state.accessToken = "";
  }
  state.userEmail = normalized;
  if (normalized) localStorage.setItem(ACCOUNT_KEY, normalized);
  else {
    localStorage.removeItem(ACCOUNT_KEY);
    localStorage.removeItem(DRIVE_DATA_ID_KEY);
  }
  renderAccount();
}

function renderAccount() {
  const email = getRegisteredEmail();
  const driveReady = Boolean(state.accessToken);
  const connected = Boolean(email);
  els.googleSignin.hidden = driveReady;
  els.googleSignin.textContent = connected ? "Googleと同期" : "Googleアカウントを登録";
  els.googleSignout.hidden = !connected;
  els.accountBadge.hidden = !connected;
  els.accountBadge.textContent = connected ? (driveReady ? email : `${email}（未同期）`) : "";
  els.accountBadge.classList.toggle("unsynced", connected && !driveReady);
  els.signedInLabel.textContent = connected
    ? driveReady
      ? `${email} と同期済みです。PCとスマホで同じグループを使えます。`
      : `${email} を登録済みです。まだドライブと同期できていません。「Googleと同期」を押してください。`
    : "";
  if (els.accountStatus) {
    els.accountStatus.textContent = connected
      ? driveReady
        ? `${email} と同期済みです。`
        : `${email} を登録済みです。下のボタンで Google ドライブと同期してください。`
      : "未登録です。";
  }
  if (els.syncGroups) {
    els.syncGroups.textContent = driveReady ? "Googleと再同期" : "Googleと同期";
  }
  if (els.groupsSyncNote) {
    els.groupsSyncNote.textContent = driveReady
      ? "Googleドライブとつながっています。一覧に出ないときは「Googleと再同期」を押してください。"
      : "メールが表示されていても、同期には Google の許可画面が必要です。「Googleと同期」を押してください。";
  }
  if (els.accountEmail && !els.accountEmail.value) els.accountEmail.value = email;
  if (els.settingsAccountEmail) els.settingsAccountEmail.value = email;
}

const DEFAULT_MYMAP_URL = "https://www.google.com/maps/d/";

function getMyMapBaseUrl() {
  const saved = (localStorage.getItem(MYMAP_URL_KEY) || "").trim();
  if (saved && /^https?:\/\//i.test(saved) && !/google\.com\/mymaps(?:[/?#]|$)/i.test(saved)) {
    return saved;
  }
  if (saved && /google\.com\/mymaps(?:[/?#]|$)/i.test(saved)) {
    localStorage.setItem(MYMAP_URL_KEY, DEFAULT_MYMAP_URL);
  }
  return DEFAULT_MYMAP_URL;
}

function getMyMapUrl() {
  const base = getMyMapBaseUrl();
  const email = getRegisteredEmail();
  try {
    const url = new URL(base);
    if (email) url.searchParams.set("authuser", email);
    return url.toString();
  } catch {
    return DEFAULT_MYMAP_URL;
  }
}

function openAccountDialog() {
  els.accountEmail.value = getRegisteredEmail();
  renderAccount();
  els.accountDialog.showModal();
}

function registerAccountFromInput() {
  const email = els.accountEmail.value.trim();
  if (!email || !email.includes("@")) {
    toast("Googleアカウントのメールアドレスを入力してください");
    els.accountEmail.focus();
    return;
  }
  setRegisteredAccount(email);
  toast(`${email} を登録しました。MyMap はこのアカウントで開きます`);
  els.accountDialog.close();
}

function asGeoResult(lat, lng, formatted) {
  const latitude = Number(lat);
  const longitude = Number(lng);
  if (!isValidLatLng(latitude, longitude) || !isInJapan(latitude, longitude)) return null;
  return { lat: latitude, lng: longitude, formatted: formatted || "" };
}

async function geocodeWithYahoo(query) {
  const res = await fetch("/api/geocode", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ query }),
  });
  const data = await res.json().catch(() => ({}));
  applyQuotaPayload(data);
  if (res.status === 429) throw new QuotaExceededError();
  if (!res.ok) return null;
  return asGeoResult(data.lat, data.lng, data.formatted);
}

const geocodeCache = new Map();

class QuotaExceededError extends Error {
  constructor() {
    super("DAILY_QUOTA_EXCEEDED");
    this.name = "QuotaExceededError";
  }
}

function showQuotaDialog() {
  if (els.quotaDialog.open) return;
  els.quotaDialog.showModal();
}

function renderQuota(data) {
  if (!els.quotaCount) return data;
  const count = Number(data?.count) || 0;
  const limit = Number(data?.limit) || 40000;
  const blocked = Boolean(data?.blocked) || count >= limit;
  els.quotaCount.textContent = `本日のピン上限 ${count}/${limit}本`;
  if (els.quotaLimitNote) els.quotaLimitNote.hidden = !blocked;
  els.quotaStatus?.classList.toggle("is-blocked", blocked);
  return { ...data, count, limit, blocked };
}

async function fetchQuota() {
  const res = await fetch("/api/quota");
  if (!res.ok) throw new Error("quota unavailable");
  return res.json();
}

async function refreshQuotaDisplay() {
  try {
    return renderQuota(await fetchQuota());
  } catch {
    return null;
  }
}

function applyQuotaPayload(data) {
  if (!data || (data.count == null && !data.quota)) return;
  renderQuota(data.quota || data);
}

async function isQuotaBlocked() {
  try {
    const data = await refreshQuotaDisplay();
    return Boolean(data?.blocked);
  } catch {
    return true;
  }
}

async function geocodeAddress(address) {
  const query = normalizePlaceQuery(address);
  if (!query) return null;
  if (geocodeCache.has(query)) return geocodeCache.get(query);

  let found = null;
  try {
    found = await geocodeWithYahoo(query);
  } catch (err) {
    if (err instanceof QuotaExceededError) throw err;
    throw new QuotaExceededError();
  }

  if (found) geocodeCache.set(query, found);
  return found;
}

async function reverseGeocode(lat, lng) {
  if (getApiKey() && state.googleReady && state.geocoder) {
    return new Promise((resolve) => {
      state.geocoder.geocode({ location: { lat, lng } }, (results, status) => {
        resolve(status === "OK" && results[0] ? results[0].formatted_address : `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
      });
    });
  }
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lng));
  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  const data = await response.json();
  return data.display_name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

function toCsv() {
  const header = ["名前", "位置", "住所", "物件名", "自社担当者", "取引担当者", "進捗", "備考", "ピン色", "緯度", "経度"];
  const rows = filledRows().map((row) =>
    [
      row.propertyName || row.address,
      locationLabel(row),
      row.address,
      row.propertyName,
      row.companyRep,
      row.clientRep,
      normalizeProgress(row.progress),
      row.note,
      sanitizePinColor(row.pinColor),
      row.lat ?? "",
      row.lng ?? "",
    ]
      .map(escapeCsv)
      .join(",")
  );
  return ["\uFEFF" + header.join(","), ...rows].join("\n");
}

function toKml() {
  const name = state.mapName || "ピン刺しアプリ";
  const placemarks = filledRows()
    .map((row) => {
      const point =
        row.lat != null && row.lng != null
          ? `<Point><coordinates>${row.lng},${row.lat},0</coordinates></Point>`
          : "";
      const description = [
        row.address,
        `自社担当: ${row.companyRep}`,
        `取引担当: ${row.clientRep}`,
        `進捗: ${normalizeProgress(row.progress)}`,
        row.note,
      ]
        .filter(Boolean)
        .join("\n");
      const styleId = `pin-${row.id.replace(/[^a-zA-Z0-9_-]/g, "")}`;
      const color = sanitizePinColor(row.pinColor).slice(1);
      const kmlColor = `ff${color.slice(4, 6)}${color.slice(2, 4)}${color.slice(0, 2)}`;
      return `<Style id="${styleId}"><IconStyle><color>${kmlColor}</color></IconStyle></Style><Placemark><name>${escapeXml(row.propertyName || row.address)}</name><styleUrl>#${styleId}</styleUrl><description>${escapeXml(description)}</description>${point}<address>${escapeXml(locationLabel(row))}</address></Placemark>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>${escapeXml(name)}</name>${placemarks}</Document></kml>`;
}

function parseCsv(text) {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];
  const headers = splitCsvLine(lines[0]);
  const index = (names) => headers.findIndex((header) => names.some((name) => header.includes(name)));
  const addressIdx = index(["住所", "address"]);
  const nameIdx = index(["物件名", "名前", "name"]);
  const companyIdx = index(["自社"]);
  const clientIdx = index(["取引"]);
  const progressIdx = index(["進捗"]);
  const noteIdx = index(["備考", "説明"]);
  const colorIdx = index(["ピン色", "色"]);
  const latIdx = index(["緯度", "lat"]);
  const lngIdx = index(["経度", "lng", "lon"]);
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const lat = parseCoord(cells[latIdx]);
    const lng = parseCoord(cells[lngIdx]);
    return {
      id: crypto.randomUUID(),
      address: cells[addressIdx] || "",
      propertyName: cells[nameIdx] || "",
      companyRep: cells[companyIdx] || "",
      clientRep: cells[clientIdx] || "",
      progress: normalizeProgress(cells[progressIdx]),
      note: cells[noteIdx] || "",
      pinColor: sanitizePinColor(cells[colorIdx]),
      lat: isValidLatLng(lat, lng) ? lat : null,
      lng: isValidLatLng(lat, lng) ? lng : null,
    };
  });
}

function splitCsvLine(line) {
  const out = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (quoted) {
      if (char === '"' && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        current += char;
      }
    } else if (char === '"') {
      quoted = true;
    } else if (char === ",") {
      out.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  out.push(current);
  return out;
}

async function geocodeFilledRows() {
  let pinned = 0;
  let missed = 0;
  const missedNames = [];
  const rows = filledRows();
  for (let i = 0; i < rows.length; i += 1) {
    const row = rows[i];
    toast(`${i + 1}/${rows.length}件の位置を調べています…`);
    if (isValidLatLng(row.lat, row.lng) && isInJapan(row.lat, row.lng)) {
      pinned += 1;
      continue;
    }
    row.lat = null;
    row.lng = null;
    const queries = locationQueries(row);
    let found = null;
    for (const query of queries) {
      found = await geocodeAddress(query);
      if (found) break;
    }
    if (found && isValidLatLng(found.lat, found.lng)) {
      row.lat = found.lat;
      row.lng = found.lng;
      pinned += 1;
    } else {
      row.lat = null;
      row.lng = null;
      missed += 1;
      missedNames.push(row.propertyName || row.address || "（名称なし）");
    }
  }
  saveState();
  renderSheet();
  refreshQuotaDisplay();
  return { pinned, missed, missedNames };
}

async function registerToGoogle() {
  const rows = filledRows();
  if (!rows.length) {
    toast("登録する住所がありません");
    return;
  }
  if (!state.mapName.trim()) {
    toast("ピンのグループ名を入力してください");
    els.mapName.focus();
    return;
  }
  if (rows.length > LAYER_LIMIT) {
    toast(`1グループあたり${LAYER_LIMIT}件が上限です。${rows.length}件あるので、別グループに分けてから登録してください`);
    return;
  }
  if (await isQuotaBlocked()) {
    showQuotaDialog();
    return;
  }
  toast("地図を作ってピンを刺しています…");
  showMap();
  try {
    const { pinned, missed, missedNames } = await geocodeFilledRows();
    saveState();
    refreshMapView();

    els.resultMessage.textContent =
      missed > 0
        ? `「${state.mapName}」を保存し、${pinned}件にピンを刺しました。位置が分からなかった ${missed}件: ${missedNames.slice(0, 8).join("、")}${missedNames.length > 8 ? " ほか" : ""}`
        : `「${state.mapName}」を保存し、${pinned}件にピンを刺しました。`;
    els.resultDialog.showModal();
  } catch (err) {
    saveState();
    refreshMapView();
    if (err instanceof QuotaExceededError) {
      refreshQuotaDisplay();
      showQuotaDialog();
      return;
    }
    toast("位置の調べ方に失敗しました。時間をおいて再度お試しください");
  }
}

function authHeaders() {
  return { Authorization: `Bearer ${state.accessToken}`, "Content-Type": "application/json" };
}

async function upsertSpreadsheet(rows) {
  const title = state.mapName;
  const values = [
    ["名前", "位置", "住所", "物件名", "自社担当者", "取引担当者", "進捗", "備考", "ピン色", "緯度", "経度"],
    ...rows.map((row) => [
      row.propertyName || row.address,
      locationLabel(row),
      row.address,
      row.propertyName,
      row.companyRep,
      row.clientRep,
      normalizeProgress(row.progress),
      row.note,
      sanitizePinColor(row.pinColor),
      row.lat ?? "",
      row.lng ?? "",
    ]),
  ];
  let spreadsheetId = localStorage.getItem("mymap-pin-app:sheet-id");
  if (!spreadsheetId) {
    const created = await fetch("https://sheets.googleapis.com/v4/spreadsheets", {
      method: "POST",
      headers: authHeaders(),
      body: JSON.stringify({ properties: { title } }),
    }).then((res) => res.json());
    if (!created.spreadsheetId) throw new Error(created.error?.message || "シート作成に失敗");
    spreadsheetId = created.spreadsheetId;
    localStorage.setItem("mymap-pin-app:sheet-id", spreadsheetId);
  }
  await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}/values/A1?valueInputOption=RAW`,
    {
      method: "PUT",
      headers: authHeaders(),
      body: JSON.stringify({ values }),
    }
  );
  return `https://docs.google.com/spreadsheets/d/${spreadsheetId}`;
}

async function upsertKmlFile() {
  const metadata = {
    name: `${state.mapName}.kml`,
    mimeType: "application/vnd.google-earth.kml+xml",
  };
  const form = new FormData();
  form.append("metadata", new Blob([JSON.stringify(metadata)], { type: "application/json" }));
  form.append("file", new Blob([toKml()], { type: "application/vnd.google-earth.kml+xml" }));
  const existing = localStorage.getItem("mymap-pin-app:kml-id");
  const endpoint = existing
    ? `https://www.googleapis.com/upload/drive/v3/files/${existing}?uploadType=multipart`
    : "https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart";
  const response = await fetch(endpoint, {
    method: existing ? "PATCH" : "POST",
    headers: { Authorization: `Bearer ${state.accessToken}` },
    body: form,
  });
  const data = await response.json();
  if (data.id) localStorage.setItem("mymap-pin-app:kml-id", data.id);
  return data.id;
}

function downloadFile(filename, text, type) {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function loadGoogleMaps(apiKey) {
  if (!apiKey || window.google?.maps) return;
  const script = document.createElement("script");
  script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}`;
  script.async = true;
  script.onload = () => {
    state.googleReady = true;
    state.geocoder = new google.maps.Geocoder();
  };
  document.head.appendChild(script);
}

let googleAuthSilent = false;
let pendingDriveResolve = null;
let driveConsentRetry = false;

function finishDriveAuth(ok) {
  pendingDriveResolve?.(ok);
  pendingDriveResolve = null;
  renderAccount();
}

function setupGoogleAuth() {
  const clientId = getOauthClientId();
  if (!clientId || !window.google?.accounts?.oauth2) return;
  if (state.tokenClient) return;
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPE,
    include_granted_scopes: true,
    callback: async (response) => {
      const silent = googleAuthSilent;
      googleAuthSilent = false;
      if (response.error) {
        if (!silent) toast("Googleログインに失敗しました。ポップアップがブロックされていないか確認してください");
        finishDriveAuth(false);
        return;
      }
      state.accessToken = response.access_token;
      const me = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${state.accessToken}` },
      }).then((res) => res.json());
      setRegisteredAccount(me.email || els.accountEmail.value);
      try {
        await syncFromDrive();
        finishDriveAuth(true);
      } catch {
        if (!silent) toast("ログインしました。ドライブ同期は「Googleと同期」でもう一度お試しください");
        finishDriveAuth(false);
      }
      if (!silent) els.accountDialog.close();
    },
    error_callback: (error) => {
      const silent = googleAuthSilent;
      googleAuthSilent = false;
      if (!silent && error?.type !== "popup_closed") {
        toast("Googleログインを完了できませんでした");
      }
      finishDriveAuth(false);
    },
  });
}

function whenGoogleAuthReady() {
  return new Promise((resolve) => {
    if (window.google?.accounts?.oauth2) {
      setupGoogleAuth();
      resolve(Boolean(state.tokenClient));
      return;
    }
    const started = Date.now();
    const timer = window.setInterval(() => {
      if (window.google?.accounts?.oauth2 || Date.now() - started > 8000) {
        window.clearInterval(timer);
        setupGoogleAuth();
        resolve(Boolean(state.tokenClient));
      }
    }, 250);
  });
}

function isEmbeddedBrowser() {
  const ua = navigator.userAgent;
  return /Electron/i.test(ua) || window.self !== window.top;
}

function requestGoogleSignIn(options = {}) {
  if (isEmbeddedBrowser()) {
    if (!options.silent) toast("Googleの画面は Chrome または Edge で開いてください");
    return;
  }
  if (!getOauthClientId()) {
    if (!options.silent) openAccountDialog();
    return;
  }
  if (!state.tokenClient) setupGoogleAuth();
  if (!state.tokenClient) {
    if (!options.silent) toast("Googleログインの読み込み中です。数秒後にもう一度押してください");
    return;
  }
  googleAuthSilent = Boolean(options.silent);
  const hint = getRegisteredEmail() || els.accountEmail?.value || "";
  const request = { hint, include_granted_scopes: true };
  if (options.silent) request.prompt = "";
  else if (options.forcePrompt) request.prompt = "select_account";
  state.tokenClient.requestAccessToken(request);
}

function ensureDriveSession(options = {}) {
  return new Promise((resolve) => {
    if (state.accessToken && !options.forcePrompt) {
      syncFromDrive()
        .then(() => resolve(true))
        .catch(() => resolve(false));
      return;
    }
    if (!getRegisteredEmail() && !options.forcePrompt && !els.accountEmail?.value) {
      resolve(false);
      return;
    }
    pendingDriveResolve = resolve;
    const start = () => {
      if (!state.tokenClient && !window.google?.accounts?.oauth2) {
        if (pendingDriveResolve === resolve) pendingDriveResolve = null;
        resolve(false);
        return;
      }
      setupGoogleAuth();
      requestGoogleSignIn(options);
      if (options.silent) {
        window.setTimeout(() => {
          if (pendingDriveResolve === resolve) {
            pendingDriveResolve = null;
            resolve(false);
          }
        }, 4000);
      }
    };
    if (window.google?.accounts?.oauth2) {
      start();
      return;
    }
    void whenGoogleAuthReady().then((ready) => {
      if (!ready) {
        if (pendingDriveResolve === resolve) pendingDriveResolve = null;
        resolve(false);
        return;
      }
      start();
    });
  });
}

function bindEvents() {
  document.addEventListener("click", (event) => {
    if (event.target.closest(".pin-color-swatch, #pin-color-menu")) return;
    closePinColorMenu();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") closePinColorMenu();
  });
  window.addEventListener("scroll", closePinColorMenu, true);
  els.newRegister.addEventListener("click", () => withAd(startNewGroup));
  els.openMyMap.addEventListener("click", () => {
    const openDialog = () => {
      renderAccount();
      renderGroups();
      els.groupsDialog.showModal();
    };
    if (getRegisteredEmail() && !state.accessToken) {
      toast("Googleドライブと同期します");
      void ensureDriveSession({ forcePrompt: true }).then(openDialog);
      return;
    }
    withAd(() => {
      void (async () => {
        if (state.accessToken) await syncFromDrive();
        openDialog();
      })();
    });
  });
  els.syncGroups?.addEventListener("click", () => {
    void ensureDriveSession({ forcePrompt: !state.accessToken }).then(() => {
      renderGroups();
    });
  });
  els.openGoogleMyMaps.addEventListener("click", () => {
    window.open(getMyMapUrl(), "_blank", "noopener");
  });
  els.registerGoogle.addEventListener("click", async () => {
    if (await isQuotaBlocked()) {
      showQuotaDialog();
      return;
    }
    withAd(registerToGoogle);
  });
  els.homeMapRegister.addEventListener("click", showMap);
  els.openMapRegister.addEventListener("click", showMap);
  els.closeGroups.addEventListener("click", () => els.groupsDialog.close());
  function saveMymapFiles() {
    if (!filledRows().length) return toast("保存するピンがありません");
    const fileName = state.mapName || "ピンのグループ";
    downloadFile(`${fileName}.kml`, toKml(), "application/vnd.google-earth.kml+xml");
    downloadFile(`${fileName}.csv`, toCsv(), "text/csv;charset=utf-8");
    toast("マイマップ用ファイルを保存しました");
  }
  els.toolbarSaveMymap.addEventListener("click", saveMymapFiles);
  els.closeMap.addEventListener("click", hideMap);
  els.showMapButton?.addEventListener("click", showMap);
  els.backHome.addEventListener("click", showHome);
  els.mapName.addEventListener("input", () => {
    state.mapName = els.mapName.value;
    saveState();
  });
  document.querySelectorAll('input[name="location-mode"]').forEach((input) => {
    input.addEventListener("change", () => {
      state.locationMode = getLocationMode();
      saveState();
    });
  });
  els.addRow.addEventListener("click", () => {
    state.rows.push(emptyRow());
    saveState();
    renderSheet();
  });
  els.addSamples.addEventListener("click", () => {
    const samples = [
      { address: "東京都千代田区丸の内1-9-1", propertyName: "東京駅", companyRep: "山田", clientRep: "佐藤", note: "サンプル", lat: 35.681236, lng: 139.767125 },
      { address: "大阪府大阪市北区梅田3-1-1", propertyName: "大阪駅", companyRep: "鈴木", clientRep: "高橋", note: "サンプル", lat: 34.702485, lng: 135.495951 },
    ];
    samples.forEach((sample) => state.rows.unshift({ ...emptyRow(), ...sample }));
    saveState();
    renderSheet();
    syncMarkers();
    fitPins();
  });
  els.exportCsv.addEventListener("click", () => {
    if (!filledRows().length) return toast("書き出す行がありません");
    downloadFile(`${state.mapName || "mymap-pins"}.csv`, toCsv(), "text/csv;charset=utf-8");
  });
  els.importCsv.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    const imported = parseCsv(await file.text());
    if (!imported.length) return toast("CSVを読み取れませんでした");
    state.rows = [...imported, ...state.rows];
    if (filledRows().length > LAYER_LIMIT) {
      toast(`読み込みました。1グループは最大${LAYER_LIMIT}件です。超えた分は別グループへ分けてください`);
    }
    saveState();
    renderSheet();
    syncMarkers();
  });
  els.fitPins.addEventListener("click", fitPins);
  els.mapSearchForm?.addEventListener("submit", (event) => {
    event.preventDefault();
    void searchMapPlace(els.mapSearch?.value);
  });
  els.locateMe?.addEventListener("click", goToCurrentLocation);
  els.expandMap.addEventListener("click", enterMapFullscreen);
  els.shrinkMap.addEventListener("click", exitMapFullscreen);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.mapFullscreen) exitMapFullscreen();
    if (event.key === "Escape" && isAdOverlayOpen()) {
      state.pendingAction = null;
      dismissAdOverlay();
    }
  });
  els.adContinue.addEventListener("click", finishAd);
  els.closeResult.addEventListener("click", () => {
    els.resultDialog.close();
    showMap();
    refreshMapView();
  });
  els.closeQuota.addEventListener("click", () => els.quotaDialog.close());
  els.pasteClipboard?.addEventListener("click", () => {
    void pasteClipboardIntoSheet();
  });
  els.saveMymapFile.addEventListener("click", saveMymapFiles);
  els.googleSignin.addEventListener("click", () => {
    if (getRegisteredEmail()) {
      void ensureDriveSession({ forcePrompt: true });
      return;
    }
    openAccountDialog();
  });
  els.accountBadge?.addEventListener("click", () => {
    if (state.accessToken) {
      void syncFromDrive();
      return;
    }
    void ensureDriveSession({ forcePrompt: true });
  });
  els.googleSignout.addEventListener("click", () => {
    state.accessToken = "";
    setRegisteredAccount("");
    els.accountEmail.value = "";
    toast("Googleアカウントの登録を解除しました");
  });
  els.saveAccount?.addEventListener("click", registerAccountFromInput);
  els.confirmAccount.addEventListener("click", () => {
    void ensureDriveSession({ forcePrompt: true });
  });
  els.closeAccount.addEventListener("click", () => els.accountDialog.close());
  els.openSettings.addEventListener("click", () => {
    els.oauthClientId.value = getOauthClientId();
    els.apiKey.value = getApiKey();
    els.myMapUrl.value = localStorage.getItem(MYMAP_URL_KEY) || "";
    els.settingsAccountEmail.value = getRegisteredEmail();
    els.settingsDialog.showModal();
  });
  els.settingsForm.addEventListener("submit", (event) => {
    if (event.submitter?.value !== "save") return;
    const clientId = els.oauthClientId.value.trim();
    const apiKey = els.apiKey.value.trim();
    const mapUrl = els.myMapUrl.value.trim();
    const account = els.settingsAccountEmail.value.trim();
    if (clientId && clientId !== DEFAULT_OAUTH_CLIENT_ID) {
      localStorage.setItem(OAUTH_KEY, clientId);
    } else {
      localStorage.removeItem(OAUTH_KEY);
    }
    if (apiKey) {
      localStorage.setItem(API_KEY_STORAGE, apiKey);
      loadGoogleMaps(apiKey);
    }
    if (mapUrl) localStorage.setItem(MYMAP_URL_KEY, mapUrl);
    else localStorage.removeItem(MYMAP_URL_KEY);
    if (account) setRegisteredAccount(account);
    setupGoogleAuth();
    toast("設定を保存しました");
  });
}

function init() {
  loadState();
  els.mapName.value = state.mapName;
  setLocationMode(state.locationMode || "address-and-name");
  state.userEmail = getRegisteredEmail();
  renderAccount();
  bindEvents();
  bindGlobalPinPopupClicks();
  loadGoogleMaps(getApiKey());
  window.setTimeout(() => {
    setupGoogleAuth();
    if (getRegisteredEmail()) void ensureDriveSession({ silent: true });
  }, 800);
  refreshQuotaDisplay();
  restoreHomeAd();
  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "visible") refreshQuotaDisplay();
  });
  window.addEventListener("pageshow", () => refreshQuotaDisplay());
}

init();
