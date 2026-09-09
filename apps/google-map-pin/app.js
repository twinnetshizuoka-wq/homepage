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
const LAYER_LIMIT = 2000;
const SHEET_FIELDS = ["address", "propertyName", "companyRep", "clientRep", "note"];
const ADS = [
  { title: "物件まわりの業務をもっと早く", body: "住所・担当者・備考を表でまとめて、地図にピンを残せます。" },
  { title: "訪問前の地図づくりに", body: "自社担当と取引担当を残して、現場共有用のマイマップを作れます。" },
];

const state = {
  mapName: "",
  rows: [],
  map: null,
  markers: new Map(),
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
  saveMymapFile: document.getElementById("save-mymap-file"),
};

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.clearTimeout(toast.timer);
  toast.timer = window.setTimeout(() => els.toast.classList.remove("show"), 2800);
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

function emptyRow() {
  return {
    id: crypto.randomUUID(),
    address: "",
    propertyName: "",
    companyRep: "",
    clientRep: "",
    note: "",
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
      note: row?.note || "",
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

function withAd(action) {
  state.pendingAction = action;
  const ad = ADS[Math.floor(Math.random() * ADS.length)];
  els.adFrame.innerHTML = `<strong>${ad.title}</strong><p>${ad.body}</p>`;
  els.adContinue.disabled = true;
  let left = 3;
  els.adContinue.textContent = `あと ${left} 秒`;
  els.adDialog.showModal();
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
  els.adDialog.close();
  const action = state.pendingAction;
  state.pendingAction = null;
  if (action) action();
}

function showHome() {
  hideMap();
  els.home.hidden = false;
  els.workspace.hidden = true;
}

function showWorkspace() {
  els.home.hidden = true;
  els.workspace.hidden = false;
  els.mapName.value = state.mapName;
  setLocationMode(state.locationMode);
  renderSheet();
}

function showMap() {
  showWorkspace();
  state.mapVisible = true;
  els.mapPane.hidden = false;
  els.workspace.classList.add("map-open");
  refreshMapView();
}

function hideMap() {
  exitMapFullscreen();
  state.mapVisible = false;
  els.mapPane.hidden = true;
  els.workspace.classList.remove("map-open");
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
    tr.classList.toggle("is-focused", tr.dataset.rowId === state.focusedRowId);
  });
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
      <td><textarea data-field="address" rows="2" placeholder="○○県○○市...">${escapeHtml(row.address)}</textarea></td>
      <td><textarea data-field="propertyName" rows="2" placeholder="○○ビル">${escapeHtml(row.propertyName)}</textarea></td>
      <td><textarea data-field="companyRep" rows="2" placeholder="△△">${escapeHtml(row.companyRep)}</textarea></td>
      <td><textarea data-field="clientRep" rows="2" placeholder="○○">${escapeHtml(row.clientRep)}</textarea></td>
      <td><textarea data-field="note" rows="2">${escapeHtml(row.note)}</textarea></td>
      <td class="col-action"><button type="button" class="btn danger" data-delete>削除</button></td>
    `;
    tr.querySelectorAll("textarea").forEach((input) => {
      input.addEventListener("input", () => {
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
      input.addEventListener("paste", (event) => {
        const text = event.clipboardData?.getData("text/plain") || "";
        if (applyExcelPaste(index, input.dataset.field, text)) {
          event.preventDefault();
        }
      });
    });
    tr.querySelector("[data-delete]").addEventListener("click", (event) => {
      event.stopPropagation();
      state.rows = state.rows.filter((item) => item.id !== row.id);
      if (!state.rows.length) state.rows.push(emptyRow());
      if (state.focusedRowId === row.id) state.focusedRowId = null;
      saveState();
      renderSheet();
      syncMarkers();
    });
    tr.addEventListener("click", (event) => {
      if (event.target.closest("textarea, button, input, label")) return;
      focusRowPin(row);
    });
    els.sheetBody.appendChild(tr);
  });
  updateRowCount();
}

function updateRowCount() {
  const count = filledRows().length;
  els.rowCount.textContent = `${count}件 / ${LAYER_LIMIT}件（1レイヤ上限）`;
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
  return ["住所", "物件名", "自社担当", "取引担当", "備考", "address", "name"].some((label) =>
    text.includes(label)
  );
}

function applyExcelPaste(startRowIndex, startField, text) {
  const raw = String(text || "").replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (!raw.trim()) return false;
  const lines = raw.split("\n");
  while (lines.length && lines[lines.length - 1] === "") lines.pop();
  let grid = lines.map((line) => line.split("\t").map((cell) => cell.trim()));
  if (!grid.length || (grid.length === 1 && grid[0].length === 1)) return false;
  if (isHeaderRow(grid[0])) grid = grid.slice(1);
  if (!grid.length) return false;

  const startCol = Math.max(0, SHEET_FIELDS.indexOf(startField));
  grid.forEach((cells, offset) => {
    const rowIndex = startRowIndex + offset;
    while (state.rows.length <= rowIndex) state.rows.push(emptyRow());
    const row = state.rows[rowIndex];
    cells.forEach((value, colOffset) => {
      const field = SHEET_FIELDS[startCol + colOffset];
      if (!field) return;
      row[field] = value;
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
    toast(`${grid.length}件を貼り付けました。1レイヤは最大${LAYER_LIMIT}件です。超えた分は別レイヤへ分けてください`);
  } else {
    toast(`${grid.length}件を Excel から貼り付けました`);
  }
  return true;
}

function createPinIcon() {
  return L.divIcon({
    className: "",
    html: `<div class="map-pin" style="background:#e03131"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -18],
  });
}

function popupHtml(row) {
  return `<strong>${escapeHtml(row.propertyName || row.address)}</strong><br>${escapeHtml(row.address)}
    <br>自社: ${escapeHtml(row.companyRep || "-")} / 取引: ${escapeHtml(row.clientRep || "-")}`;
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
      existing.setPopupContent(popupHtml(row));
      return;
    }
    const marker = L.marker([row.lat, row.lng], { icon: createPinIcon() })
      .addTo(state.map)
      .bindPopup(popupHtml(row));
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

function initMap() {
  state.map = L.map("map").setView([36.2, 138.25], 5);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 19,
    attribution: "&copy; OpenStreetMap",
  }).addTo(state.map);
  state.mapReady = true;
  state.map.on("click", async (event) => {
    const { lat, lng } = event.latlng;
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
  });
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
  state.userEmail = normalized;
  if (normalized) localStorage.setItem(ACCOUNT_KEY, normalized);
  else localStorage.removeItem(ACCOUNT_KEY);
  renderAccount();
}

function renderAccount() {
  const email = getRegisteredEmail();
  const connected = Boolean(email);
  els.googleSignin.hidden = connected;
  els.googleSignout.hidden = !connected;
  els.accountBadge.hidden = !connected;
  els.accountBadge.textContent = connected ? email : "";
  els.signedInLabel.textContent = connected
    ? `${email} を登録済みです。MyMap はこのアカウントで開きます。`
    : "";
  if (els.accountStatus) {
    els.accountStatus.textContent = connected
      ? `${email} を登録済みです。`
      : "未登録です。";
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
  if (res.status === 429) throw new QuotaExceededError();
  if (!res.ok) return null;
  const data = await res.json().catch(() => ({}));
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

async function fetchQuota() {
  const res = await fetch("/api/quota");
  if (!res.ok) throw new Error("quota unavailable");
  return res.json();
}

async function isQuotaBlocked() {
  try {
    const data = await fetchQuota();
    return Boolean(data.blocked);
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

  geocodeCache.set(query, found);
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
  const header = ["名前", "位置", "住所", "物件名", "自社担当者", "取引担当者", "備考", "緯度", "経度"];
  const rows = filledRows().map((row) =>
    [
      row.propertyName || row.address,
      locationLabel(row),
      row.address,
      row.propertyName,
      row.companyRep,
      row.clientRep,
      row.note,
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
      const description = [row.address, `自社担当: ${row.companyRep}`, `取引担当: ${row.clientRep}`, row.note]
        .filter(Boolean)
        .join("\n");
      return `<Placemark><name>${escapeXml(row.propertyName || row.address)}</name><description>${escapeXml(description)}</description>${point}<address>${escapeXml(locationLabel(row))}</address></Placemark>`;
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
  const noteIdx = index(["備考", "説明"]);
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
      note: cells[noteIdx] || "",
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
    toast(`1レイヤあたり${LAYER_LIMIT}件が上限です。${rows.length}件あるので、別レイヤに分けてから登録してください`);
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
    ["名前", "位置", "住所", "物件名", "自社担当者", "取引担当者", "備考", "緯度", "経度"],
    ...rows.map((row) => [
      row.propertyName || row.address,
      locationLabel(row),
      row.address,
      row.propertyName,
      row.companyRep,
      row.clientRep,
      row.note,
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

function setupGoogleAuth() {
  const clientId = getOauthClientId();
  if (!clientId || !window.google?.accounts?.oauth2) return;
  state.tokenClient = google.accounts.oauth2.initTokenClient({
    client_id: clientId,
    scope: DRIVE_SCOPE,
    callback: async (response) => {
      if (response.error) {
        toast("Googleログインに失敗しました");
        return;
      }
      state.accessToken = response.access_token;
      const me = await fetch("https://www.googleapis.com/oauth2/v2/userinfo", {
        headers: { Authorization: `Bearer ${state.accessToken}` },
      }).then((res) => res.json());
      setRegisteredAccount(me.email || els.accountEmail.value);
      refreshPremiumFromServer();
      toast(`${getRegisteredEmail()} を確認して登録しました`);
      els.accountDialog.close();
    },
  });
}

function isEmbeddedBrowser() {
  const ua = navigator.userAgent;
  return /Electron/i.test(ua) || window.self !== window.top;
}

function requestGoogleSignIn() {
  if (isEmbeddedBrowser()) {
    toast("Googleの画面は Chrome または Edge で開いてください");
    return;
  }
  if (!getOauthClientId()) {
    openAccountDialog();
    toast("メールアドレスを登録してください");
    return;
  }
  if (!state.tokenClient) setupGoogleAuth();
  if (!state.tokenClient) {
    toast("Googleログインの読み込み中です。数秒後にもう一度押してください");
    return;
  }
  const hint = getRegisteredEmail() || els.accountEmail?.value || "";
  state.tokenClient.requestAccessToken({ hint });
}

function bindEvents() {
  els.newRegister.addEventListener("click", () => withAd(startNewGroup));
  els.openMyMap.addEventListener("click", () =>
    withAd(() => {
      renderGroups();
      els.groupsDialog.showModal();
    })
  );
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
    samples.forEach((sample) => state.rows.unshift({ id: crypto.randomUUID(), ...sample }));
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
      toast(`読み込みました。1レイヤは最大${LAYER_LIMIT}件です。超えた分は別レイヤへ分けてください`);
    }
    saveState();
    renderSheet();
    syncMarkers();
  });
  els.fitPins.addEventListener("click", fitPins);
  els.expandMap.addEventListener("click", enterMapFullscreen);
  els.shrinkMap.addEventListener("click", exitMapFullscreen);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && state.mapFullscreen) exitMapFullscreen();
  });
  els.adDialog.addEventListener("cancel", () => {
    state.pendingAction = null;
    window.clearInterval(withAd.timer);
  });
  els.adContinue.addEventListener("click", finishAd);
  els.closeResult.addEventListener("click", () => {
    els.resultDialog.close();
    showMap();
    refreshMapView();
  });
  els.closeQuota.addEventListener("click", () => els.quotaDialog.close());
  els.saveMymapFile.addEventListener("click", saveMymapFiles);
  els.googleSignin.addEventListener("click", openAccountDialog);
  els.googleSignout.addEventListener("click", () => {
    state.accessToken = "";
    setRegisteredAccount("");
    els.accountEmail.value = "";
    toast("Googleアカウントの登録を解除しました");
  });
  els.saveAccount.addEventListener("click", registerAccountFromInput);
  els.confirmAccount.addEventListener("click", () => {
    const typed = els.accountEmail.value.trim();
    if (typed) setRegisteredAccount(typed);
    if (!getOauthClientId()) {
      if (!typed) {
        toast("先にメールアドレスを入力するか、設定に OAuth クライアントIDを入れてください");
        return;
      }
      toast("アカウントを登録しました。Google確認には OAuth クライアントIDが必要です");
      els.accountDialog.close();
      return;
    }
    requestGoogleSignIn();
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
  loadGoogleMaps(getApiKey());
  window.setTimeout(setupGoogleAuth, 800);
}

init();
