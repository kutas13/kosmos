/**
 * Kosmos sihirbazı (görsellere göre):
 * Görsel 1 — ad, soyad, TC, doğum → Sonraki
 * Görsel 2 — doğum yeri/ülke, cinsiyet, medeni hal, uyruk, pasaport → Sonraki
 * Görsel 3 — ülke, şehir, sokak, e-posta, telefon (+ isteğe Hayır) → Sonraki
 * Sayfa 4 — meslek (jobId, örn. 381 Esnaf) → Sonraki
 * Sayfa 5 — seyahat / Schengen (traveltype, ülkeler, tarihler, giriş sayısı, parmak izi) → Sonraki
 * Sayfa 6 — Kalacak Yer Bilgileri: alan yok, yalnızca wizard-btn Sonraki
 * Sayfa 7 — Masraflar: radyo + Nakit checkbox → Sonraki
 * Sayfa 8 — KVKK: aydınlatma metnini sona kaydır → 3 onay + Yer/Tarih → Sonraki
 */

const DEFAULT_DYNAMIC_LABELS = {
  ad: "Ad",
  soyad: "Soyad",
  tc: "T.C",
  dogum_tarihi: "Doğum",
  telefon: "Telefon",
};

const NAME_BY_KEY = {
  ad: "nameOriginal",
  soyad: "surnameOriginal",
  tc: "nationalityNumber",
  dogum_tarihi: "birthDate",
};

/** 2. adım varsayılanları (options'taki wizardStep2 ile üzerine yazılır) */
const DEFAULT_WIZARD_STEP2 = {
  birthPlace: "ISTANBUL",
  birthCountryId: "685",
  genderId: "9",
  martialStatusId: "35",
  nationalityId: "685",
  passportTypeId: "48",
  passportIssueDate: "10.04.2024",
  passportExpiryDate: "10.04.2030",
  issuingAuthority: "ISTANBUL",
};

/** Görsel 3 — adres / iletişim (wizardStep1Extra) */
const APPLICANT_COUNTRY_SELECT_NAMES = [
  "applicantCountryId",
  "applicantCountry",
  "countryId",
  "addressCountryId",
];

const DEFAULT_WIZARD_STEP1_EXTRA = {
  applicantCountryId: "685",
  applicantCityId: "2",
  street: "MENEKSE",
  eMail: "vize@foxturizm.com",
  addressClickHayir: true,
};

const STEP2_FIELD_ORDER = [
  "birthPlace",
  "birthCountryId",
  "genderId",
  "martialStatusId",
  "nationalityId",
  "passportTypeId",
  "passportIssueDate",
  "passportExpiryDate",
  "passportNo",
  "issuingAuthority",
];

const DEFAULT_WIZARD_STEP3 = {
  jobId: "381",
  traveltype: "Turistik",
  schDestinationCountryId: "537",
  schFirstEntryCountryId: "537",
  visaEntryTypeId: "58",
  requestedEntryTypeId: "",
  visaDateAnchor: "2026-04-07",
  visaBaseEntryDate: "2026-05-20",
  visaBaseReturnDate: "2026-05-25",
  schengenVisaFingerPrint: "ParmakiziAlinmadi",
  accommodationTravelCosts: "gecimMasraflariHayir",
  expensePaymentCashValue: "Nakit",
  kvkkLocation: "ISTANBUL",
  kvkkLocationDate: "",
};

const ENTRY_COUNT_SELECT_NAMES = [
  "visaEntryTypeId",
  "requestedEntryTypeId",
  "schRequestedEntriesId",
  "schEntryTypeId",
  "numberOfEntriesId",
  "visaEntryCountId",
  "requestedVisaEntriesId",
  "entryCountId",
];

function findSelectByNameLoose(name) {
  if (!name) return null;
  const nodes = document.querySelectorAll(`select[name="${name}"]`);
  let hidden = null;
  for (const el of nodes) {
    if (!el || !isFillable(el)) continue;
    if (isVisible(el)) return el;
    if (!hidden) hidden = el;
  }
  return hidden;
}

function findRequestedEntrySelectByLabel() {
  for (const frag of [
    "talep edilen giriş",
    "talep edilen giris",
    "giriş sayısı",
    "giris sayisi",
    "talep edilen",
  ]) {
    const el = findByLabel(frag);
    if (el && el.tagName === "SELECT" && isFillable(el)) return el;
  }
  return null;
}

function isKalacakYerBilgileriStepVisible() {
  const raw = document.body?.innerText || "";
  const oneLine = raw.replace(/\s+/g, " ");
  if (/kalacak\s+yer\s+bilgileri/i.test(oneLine)) return true;
  if (/üye\s+ülkeye\s+sizi\s+davet/i.test(oneLine)) return true;
  if (/davet\s+eden\s+firmanın\s+kurumun/i.test(oneLine)) return true;
  for (const frag of [
    "konaklanacak geçici",
    "konaklanacak gecici",
    "otel adı ve ya geçici",
    "otel adi ve ya gecici",
  ]) {
    const el = findByLabel(frag);
    if (el && isVisible(el)) return true;
  }
  return false;
}

/* ====== SAYFA 7 — MASRAFLAR (basit, doğrudan CSS seçicilerle) ====== */

function isMasraflarStepVisible() {
  return !!document.querySelector('input[type="radio"][name="accommodationTravelCosts"]');
}

function forceClick(el) {
  if (!el) return;
  try { el.scrollIntoView({ block: "center", behavior: "instant" }); } catch { /* */ }
  el.focus();
  el.click();
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("input", { bubbles: true }));
}

/**
 * 7. sayfa — tam olarak:
 * 1) input[type=radio][name=accommodationTravelCosts][value=gecimMasraflariHayir] tıkla
 * 2) 1 saniye bekle
 * 3) input[type=checkbox][value=Nakit] tıkla
 */
async function fillWizardStep7Masraflar() {
  const results = [];

  const radio = document.querySelector(
    'input[type="radio"][name="accommodationTravelCosts"][value="gecimMasraflariHayir"]'
  );
  if (radio) {
    forceClick(radio);
    results.push({ name: "accommodationTravelCosts", ok: true });
  } else {
    results.push({ name: "accommodationTravelCosts", ok: false });
  }

  await sleep(1000);

  let nakitCb = document.querySelector('input[type="checkbox"][value="Nakit"]');
  if (!nakitCb) {
    try {
      await waitFor(
        () => !!document.querySelector('input[type="checkbox"][value="Nakit"]'),
        15000,
        200
      );
      nakitCb = document.querySelector('input[type="checkbox"][value="Nakit"]');
    } catch { /* */ }
  }

  if (nakitCb && !nakitCb.checked) {
    forceClick(nakitCb);
  }
  results.push({ name: "expensePaymentCash", ok: !!(nakitCb && nakitCb.checked) });

  return results;
}

/* ====== SAYFA 8 — KVKK ====== */

function nearestScrollableAncestor(el) {
  let n = el;
  while (n && n !== document.body && n !== document.documentElement) {
    const s = getComputedStyle(n);
    const oy = s.overflowY;
    if ((oy === "auto" || oy === "scroll" || oy === "overlay") && n.scrollHeight > n.clientHeight + 6) {
      return n;
    }
    n = n.parentElement;
  }
  return null;
}

function findKvkkHeadingElement() {
  for (const h of document.querySelectorAll("h1,h2,h3,h4,h5,h6,strong,.card-title,.fw-bold")) {
    const raw = h.textContent || "";
    const txt = raw.replace(/\s+/g, " ");
    if (/aydınlatma/i.test(txt) || /aydinlatma/i.test(txt) || /kvkk/i.test(raw)) return h;
  }
  return null;
}

function findLargestScrollableDiv() {
  let best = null;
  let bestSpare = 0;
  for (const el of document.querySelectorAll("div,section,main,article")) {
    const s = getComputedStyle(el);
    if (s.overflowY !== "auto" && s.overflowY !== "scroll") continue;
    const spare = el.scrollHeight - el.clientHeight;
    if (spare > bestSpare) {
      bestSpare = spare;
      best = el;
    }
  }
  return best;
}

function collectKvkkScrollTargets() {
  const out = [];
  const seen = new Set();
  function push(el) {
    if (!el || seen.has(el)) return;
    if (el.scrollHeight <= el.clientHeight + 5) return;
    seen.add(el);
    out.push(el);
  }
  for (const ta of document.querySelectorAll("textarea")) {
    if (isVisible(ta)) push(ta);
  }
  const head = findKvkkHeadingElement();
  if (head) {
    push(nearestScrollableAncestor(head));
    let n = head.nextElementSibling;
    for (let i = 0; i < 14 && n; i++) {
      push(nearestScrollableAncestor(n));
      if (n.scrollHeight > n.clientHeight + 5) push(n);
      n = n.nextElementSibling;
    }
  }
  push(findLargestScrollableDiv());
  return out;
}

async function smoothScrollElementToBottom(el) {
  if (!el) return;
  const maxScroll = () => Math.max(0, el.scrollHeight - el.clientHeight);
  for (let i = 0; i < 120; i++) {
    const m = maxScroll();
    if (m <= 0) break;
    el.scrollTop = Math.min(el.scrollTop + Math.max(80, Math.floor(el.clientHeight * 0.85)), m);
    el.dispatchEvent(new Event("scroll", { bubbles: true }));
    await sleep(28);
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) break;
  }
  el.scrollTop = el.scrollHeight;
  el.dispatchEvent(new Event("scroll", { bubbles: true }));
  await sleep(100);
}

async function scrollKvkkDisclosureToBottom() {
  const targets = collectKvkkScrollTargets();
  if (targets.length === 0) return false;
  for (const t of targets) {
    await smoothScrollElementToBottom(t);
  }
  return true;
}

function findKvkkConsentCheckboxes() {
  const matched = [];
  const seen = new Set();
  const patterns = [
    /kvkk\s+r[ıi]za/i,
    /s[öo]zle[şs]meyi\s+okudum/i,
    /reddedilmesi\s+durumunda/i,
    /vize\s+ba[sş]vurumun\s+reddedilmesi/i,
  ];
  for (const block of document.querySelectorAll(".form-check")) {
    const t = (block.textContent || "").replace(/\s+/g, " ").trim();
    const cb = block.querySelector('input[type="checkbox"]');
    if (!cb) continue;
    if (!patterns.some((p) => p.test(t))) continue;
    if (seen.has(cb)) continue;
    seen.add(cb);
    matched.push(cb);
  }
  if (matched.length >= 3) return matched.slice(0, 3);
  const vis = Array.from(document.querySelectorAll("input[type=checkbox].form-check-input")).filter((c) =>
    isVisible(c)
  );
  for (const c of vis) {
    if (seen.has(c)) continue;
    seen.add(c);
    matched.push(c);
    if (matched.length >= 3) break;
  }
  return matched.slice(0, 3);
}

function isKvkkCheckboxEnabled(cb) {
  if (!cb) return false;
  if (cb.disabled) return false;
  if (cb.getAttribute("aria-disabled") === "true") return false;
  if (cb.classList.contains("disabled")) return false;
  return true;
}

function isKVKKStepVisible() {
  const loc = findByName("location");
  const dt = findByName("locationDate");
  if (loc && isVisible(loc)) return true;
  if (dt && isVisible(dt)) return true;
  const t = (document.body?.innerText || "").replace(/\s+/g, " ");
  return (
    /kvkk\s+r[ıi]za/i.test(t) ||
    /aydınlatma\s+metn/i.test(t) ||
    /aydinlatma\s+metn/i.test(t) ||
    /kvkk\s+onay/i.test(t)
  );
}

function forceCheckboxCheck(cb) {
  if (!cb) return false;
  if (cb.checked) return true;
  try { cb.scrollIntoView({ block: "center", behavior: "instant" }); } catch { /* */ }
  cb.click();
  cb.dispatchEvent(new Event("change", { bubbles: true }));
  cb.dispatchEvent(new Event("input", { bubbles: true }));
  return !!cb.checked;
}

async function fillWizardStep8KVKK(merged) {
  const results = [];

  let scrolled = await scrollKvkkDisclosureToBottom();
  results.push({ name: "kvkkScroll", ok: scrolled });
  await sleep(450);

  try {
    await waitFor(() => {
      const list = findKvkkConsentCheckboxes();
      if (list.length < 3) return false;
      return list.slice(0, 3).every(isKvkkCheckboxEnabled);
    }, 16000);
  } catch {
    scrolled = await scrollKvkkDisclosureToBottom();
    results.push({ name: "kvkkScrollRetry", ok: scrolled });
    await sleep(500);
  }

  let cbs = findKvkkConsentCheckboxes();
  for (let i = 0; i < 3; i++) {
    const cb = cbs[i];
    const ok = forceCheckboxCheck(cb);
    results.push({ name: `kvkkConsent${i + 1}`, ok });
  }

  const loc = merged.kvkkLocation != null && String(merged.kvkkLocation).trim() !== ""
    ? String(merged.kvkkLocation).trim()
    : "ISTANBUL";
  const locEl = findByName("location");
  if (!locEl || !isVisible(locEl)) {
    results.push({ name: "location", ok: false });
  } else {
    setInputValue(locEl, loc);
    commitField(locEl);
    results.push({ name: "location", ok: true });
  }

  const dateRaw =
    merged.kvkkLocationDate != null && String(merged.kvkkLocationDate).trim() !== ""
      ? String(merged.kvkkLocationDate).trim()
      : localTodayYmd();
  const dateIso = /^\d{4}-\d{2}-\d{2}$/.test(dateRaw) ? dateRaw : parseToYmd(dateRaw);
  const dateEl = findByName("locationDate");
  if (!dateEl || !isVisible(dateEl)) {
    results.push({ name: "locationDate", ok: false });
  } else {
    setInputValue(dateEl, dateIso);
    commitField(dateEl);
    results.push({ name: "locationDate", ok: true });
  }

  return results;
}

/* ====== ORTAK YARDIMCILAR ====== */

const STEP3_TRAVEL_FIELD_ORDER = [
  "traveltype",
  "schDestinationCountryId",
  "schFirstEntryCountryId",
  "visaEntryDate",
  "visaReturnDate",
];

function norm(s) {
  return (s || "").toString().trim().toLowerCase().replace(/\s+/g, " ");
}

function findByLabel(fragment) {
  if (!fragment) return null;
  const frag = norm(fragment);
  const labels = Array.from(document.querySelectorAll("label"));
  for (const label of labels) {
    const t = norm(label.textContent);
    if (!t.includes(frag)) continue;
    if (label.htmlFor) {
      const el = document.getElementById(label.htmlFor);
      if (el && isFillable(el)) return el;
    }
    const inner = label.querySelector("input, select, textarea");
    if (inner && isFillable(inner)) return inner;
    const wrap = label.closest("div, td, tr, li, fieldset, form");
    if (wrap) {
      const next = wrap.querySelector(
        "input:not([type=hidden]):not([type=submit]):not([type=button]), select, textarea"
      );
      if (next && isFillable(next)) return next;
    }
  }
  return null;
}

function findByPlaceholder(fragment) {
  if (!fragment) return null;
  const low = fragment.toLowerCase();
  const els = document.querySelectorAll("input[placeholder], textarea[placeholder]");
  for (const el of els) {
    const p = (el.getAttribute("placeholder") || "").toLowerCase();
    if (p.includes(low)) return el;
  }
  return null;
}

function findByCss(selector) {
  if (!selector) return null;
  const el = document.querySelector(selector);
  return el && isFillable(el) ? el : null;
}

function findByName(name) {
  if (!name) return null;
  const sel = `input[name="${name}"], select[name="${name}"], textarea[name="${name}"]`;
  const nodes = document.querySelectorAll(sel);
  let fallback = null;
  for (const el of nodes) {
    if (!el || !isFillable(el)) continue;
    if (!fallback) fallback = el;
    if (isVisible(el)) return el;
  }
  return fallback;
}

function findKosmosPhoneInput() {
  const candidates = document.querySelectorAll(
    "input[placeholder], input.form-control[inputmode='numeric'], input[inputmode='numeric']"
  );
  for (const el of candidates) {
    if (!isFillable(el)) continue;
    const ph = (el.getAttribute("placeholder") || "").replace(/\s/g, "");
    if (/\(555\)/.test(ph)) return el;
    if (ph.includes("5555555")) return el;
  }
  return document.querySelector('input.form-control[placeholder*="(555)"]');
}

function mergeStep1Extra(stored) {
  return {
    ...DEFAULT_WIZARD_STEP1_EXTRA,
    ...(stored && typeof stored === "object" ? stored : {}),
  };
}

function fillApplicantCountryIfPresent(merged, results) {
  const val = merged.applicantCountryId;
  if (val === undefined || val === null || val === "") return;
  const extra = merged.applicantCountrySelectName;
  const names = extra ? [String(extra)] : APPLICANT_COUNTRY_SELECT_NAMES;
  for (const nm of names) {
    const el = findByName(nm);
    if (!el || !isVisible(el)) continue;
    setInputValue(el, String(val));
    commitField(el);
    results.push({ step: "1extra", name: nm, ok: true });
    return;
  }
}

function clickAddressPageHayirRadio() {
  for (const block of document.querySelectorAll(".form-check")) {
    const t = (block.textContent || "").replace(/\s+/g, " ").trim();
    if (!/^hayır\b/i.test(t) && !/^hayir\b/i.test(t)) continue;
    const r = block.querySelector("input[type=radio]");
    if (r && isVisible(r)) {
      r.click();
      return true;
    }
  }
  return false;
}

function fillStep1Extra(payload, storedWizardStep1Extra, requirePhone) {
  const merged = mergeStep1Extra(storedWizardStep1Extra);
  const results = [];

  fillApplicantCountryIfPresent(merged, results);

  const cityEl = findByName("applicantCityId");
  if (!cityEl) results.push({ step: "1extra", name: "applicantCityId", ok: false });
  else {
    setInputValue(cityEl, String(merged.applicantCityId ?? ""));
    commitField(cityEl);
    results.push({ step: "1extra", name: "applicantCityId", ok: true });
  }

  const streetEl = findByName("street");
  if (!streetEl) results.push({ step: "1extra", name: "street", ok: false });
  else {
    setInputValue(streetEl, String(merged.street ?? ""));
    commitField(streetEl);
    results.push({ step: "1extra", name: "street", ok: true });
  }

  const emailEl = findByName("eMail");
  if (!emailEl) results.push({ step: "1extra", name: "eMail", ok: false });
  else {
    setInputValue(emailEl, String(merged.eMail ?? ""));
    commitField(emailEl);
    results.push({ step: "1extra", name: "eMail", ok: true });
  }

  const tel = (payload.telefon || "").trim();
  const phoneEl = findKosmosPhoneInput();
  if (!phoneEl) {
    results.push({ step: "1extra", name: "phone", ok: false });
  } else if (!tel) {
    if (requirePhone) {
      results.push({ step: "1extra", name: "phone", ok: false, reason: "boş" });
    } else {
      results.push({ step: "1extra", name: "phone", ok: true, skipped: true });
    }
  } else {
    setInputValue(phoneEl, tel);
    commitField(phoneEl);
    results.push({ step: "1extra", name: "phone", ok: true });
  }

  const pc = merged.postalCode;
  if (pc != null && String(pc).trim() !== "") {
    for (const nm of ["postalCode", "postCode", "zipCode"]) {
      const el = findByName(nm);
      if (!el || !isVisible(el)) continue;
      setInputValue(el, String(pc).trim());
      commitField(el);
      results.push({ step: "1extra", name: nm, ok: true });
      break;
    }
  }

  if (merged.addressClickHayir !== false) {
    if (clickAddressPageHayirRadio()) {
      results.push({ step: "1extra", name: "residenceHayir", ok: true });
    }
  }

  return results;
}

function isFillable(el) {
  const tag = el.tagName;
  if (tag === "SELECT" || tag === "TEXTAREA") return true;
  if (tag !== "INPUT") return false;
  const type = (el.type || "text").toLowerCase();
  return !["hidden", "submit", "button", "checkbox", "radio", "file"].includes(type);
}

function isVisible(el) {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  if (r.width <= 0 && r.height <= 0) return false;
  const s = getComputedStyle(el);
  return s.visibility !== "hidden" && s.display !== "none" && s.opacity !== "0";
}

function valueForField(el, key, raw) {
  const str = String(raw).trim();
  if (!el) return str;
  const type = (el.type || "").toLowerCase();
  const nm = (el.getAttribute("name") || "").toLowerCase();
  const m = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(str);
  if (m) {
    const dateish =
      type === "date" ||
      nm === "birthdate" ||
      nm === "passportissuedate" ||
      nm === "passportexpirydate" ||
      key === "dogum_tarihi";
    if (dateish) {
      const dd = m[1].padStart(2, "0");
      const mm = m[2].padStart(2, "0");
      return `${m[3]}-${mm}-${dd}`;
    }
  }
  return str;
}

function setInputValue(el, value) {
  if (el == null || value === undefined) return false;
  const str = String(value);
  if (el.tagName === "SELECT") {
    el.value = str;
    if (el.value !== str) {
      const opt = Array.from(el.options).find((o) => o.text.trim() === str || o.value === str);
      if (opt) el.value = opt.value;
    }
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    return true;
  }
  const proto = el.tagName === "INPUT" ? HTMLInputElement.prototype : HTMLTextAreaElement.prototype;
  const desc = Object.getOwnPropertyDescriptor(proto, "value");
  if (desc && desc.set) desc.set.call(el, str);
  else el.value = str;
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  try {
    el.dispatchEvent(new InputEvent("input", { bubbles: true, data: str }));
  } catch {
    /* ignore */
  }
  return true;
}

function commitField(el) {
  if (!el || typeof el.blur !== "function") return;
  try {
    el.focus();
    el.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
    el.blur();
  } catch {
    /* ignore */
  }
}

function resolveField(spec) {
  if (!spec || typeof spec !== "object") return null;
  if (spec.strategy === "css" && spec.selector) return findByCss(spec.selector);
  if (spec.strategy === "placeholder" && spec.text) return findByPlaceholder(spec.text);
  if (spec.text) return findByLabel(spec.text);
  return null;
}

function getStored() {
  return new Promise((resolve) => {
    chrome.storage.local.get(
      [
        "dynamicFieldMap",
        "staticFields",
        "dynamicLabels",
        "wizardStep1Extra",
        "wizardStep2",
        "wizardStep3",
      ],
      (r) => resolve(r || {})
    );
  });
}

function ymdParts(y, m, d) {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function localTodayYmd() {
  const x = new Date();
  return ymdParts(x.getFullYear(), x.getMonth() + 1, x.getDate());
}

function parseToYmd(s) {
  const str = String(s).trim();
  const dmY = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(str);
  if (dmY) return ymdParts(Number(dmY[3]), Number(dmY[2]), Number(dmY[1]));
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) return str;
  return str;
}

function addDaysYmd(ymd, delta) {
  const [y, m, d] = ymd.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + delta);
  return ymdParts(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

function diffCalendarDaysLocal(ymdA, ymdB) {
  const [ya, ma, da] = ymdA.split("-").map(Number);
  const [yb, mb, db] = ymdB.split("-").map(Number);
  const ta = new Date(ya, ma - 1, da).getTime();
  const tb = new Date(yb, mb - 1, db).getTime();
  return Math.round((tb - ta) / 86400000);
}

function resolveStep3VisaDates(merged) {
  if (merged.visaRolling === false) {
    return {
      entry: parseToYmd(merged.visaEntryDate || ""),
      ret: parseToYmd(merged.visaReturnDate || ""),
    };
  }
  const anchor = parseToYmd(merged.visaDateAnchor || DEFAULT_WIZARD_STEP3.visaDateAnchor);
  const baseE = parseToYmd(merged.visaBaseEntryDate || DEFAULT_WIZARD_STEP3.visaBaseEntryDate);
  const baseR = parseToYmd(merged.visaBaseReturnDate || DEFAULT_WIZARD_STEP3.visaBaseReturnDate);
  const today = localTodayYmd();
  const shift = Math.max(0, diffCalendarDaysLocal(anchor, today));
  return {
    entry: addDaysYmd(baseE, shift),
    ret: addDaysYmd(baseR, shift),
  };
}

function setRadioByNameValue(name, value) {
  const radios = document.querySelectorAll(`input[type="radio"][name="${name}"]`);
  for (const r of radios) {
    if (r.value === value) {
      r.click();
      return true;
    }
  }
  return false;
}

function setSchengenFingerprintRadio(merged) {
  const v = merged.schengenVisaFingerPrint;
  if (v && setRadioByNameValue("schengenVisaFingerPrint", v)) return true;
  const radios = document.querySelectorAll('input[type="radio"][name="schengenVisaFingerPrint"]');
  for (const r of radios) {
    const wrap = r.closest(".form-check");
    const t = (wrap?.textContent || "").replace(/\s+/g, " ").trim();
    if (/^hayır\b/i.test(t) || /^hayir\b/i.test(t)) {
      if (isVisible(r)) {
        r.click();
        return true;
      }
    }
  }
  return false;
}

function fillRequestedEntryCount(merged, results) {
  const val =
    merged.visaEntryTypeId ??
    merged.requestedEntryTypeId ??
    merged.requestedVisaEntriesId ??
    merged.numberOfEntriesId;
  if (val === undefined || val === null || String(val).trim() === "") {
    return;
  }
  const names = merged.entryCountFieldName
    ? [String(merged.entryCountFieldName)]
    : ENTRY_COUNT_SELECT_NAMES;
  const str = String(val).trim();

  function tryFill(el, resultName) {
    if (!el || el.tagName !== "SELECT") return false;
    setSelectByValueOrOptionText(el, str) || setInputValue(el, str);
    commitField(el);
    const ok = String(el.value) === str;
    results.push({ name: resultName, ok });
    return ok;
  }

  for (const nm of names) {
    const el = findSelectByNameLoose(nm) || findByName(nm);
    if (!el) continue;
    if (tryFill(el, nm)) return;
  }

  const byLabel = findRequestedEntrySelectByLabel();
  if (byLabel && tryFill(byLabel, "visaEntryTypeId")) return;

  results.push({ name: "visaEntryTypeId", ok: false });
}

function fillOptionalTravelText(merged, results) {
  const txt = merged.travelExtraInfo;
  if (txt === undefined || txt === null || String(txt).trim() === "") return;
  const names = merged.travelExtraInfoFieldName
    ? [String(merged.travelExtraInfoFieldName)]
    : ["travelAdditionalInfo", "stayReasonDetail", "additionalStayInfo"];
  for (const nm of names) {
    const el = findByName(nm);
    if (el && isVisible(el)) {
      setInputValue(el, String(txt));
      commitField(el);
      results.push({ name: nm, ok: true });
      return;
    }
  }
  const byLabel = findByLabel("kalış");
  if (byLabel && isVisible(byLabel)) {
    setInputValue(byLabel, String(txt));
    commitField(byLabel);
    results.push({ name: "travelExtraInfo", ok: true });
  }
}

function fillOptionalOtherSchCountries(merged, results) {
  const v = merged.schOtherDestinationCountryId;
  if (v === undefined || v === null || v === "") return;
  const names = ["schOtherDestinationCountryId", "schOtherCountriesId", "otherMemberStatesId"];
  for (const nm of names) {
    const el = findByName(nm);
    if (!el || !isVisible(el)) continue;
    setInputValue(el, String(v));
    commitField(el);
    results.push({ name: nm, ok: true });
    return;
  }
}

const MESLEK_SELECT_NAMES = [
  "jobId",
  "occupationId",
  "currentJobId",
  "meslekId",
  "applicantJobId",
];

function findMeslekSelect() {
  for (const nm of MESLEK_SELECT_NAMES) {
    const el = findByName(nm);
    if (el && el.tagName === "SELECT" && isFillable(el)) return el;
  }
  for (const frag of ["şu anki mesleğiniz", "su anki mesleginiz", "mesleğiniz", "meslek", "mesle"]) {
    const el = findByLabel(frag);
    if (el && el.tagName === "SELECT" && isFillable(el)) return el;
  }
  return null;
}

function setNativeSelectValue(el, valueStr) {
  const desc = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
  if (desc && desc.set) desc.set.call(el, valueStr);
  else el.value = valueStr;
}

function setSelectByValueOrOptionText(el, raw) {
  if (!el || el.tagName !== "SELECT") return false;
  const str = String(raw).trim();
  if (!str) return false;
  setNativeSelectValue(el, str);
  if (el.value === str) {
    el.dispatchEvent(new Event("input", { bubbles: true }));
    el.dispatchEvent(new Event("change", { bubbles: true }));
    try {
      el.dispatchEvent(new InputEvent("input", { bubbles: true }));
    } catch {
      /* ignore */
    }
    return true;
  }
  const opts = Array.from(el.options);
  let opt = opts.find((o) => o.value === str);
  if (!opt) opt = opts.find((o) => o.text.trim() === str);
  if (!opt) {
    const n = norm(str);
    opt = opts.find((o) => norm(o.text) === n || norm(o.text).includes(n));
  }
  if (!opt) return false;
  setNativeSelectValue(el, opt.value);
  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  try {
    el.dispatchEvent(new InputEvent("input", { bubbles: true }));
  } catch {
    /* ignore */
  }
  return el.value === opt.value;
}

function fillJobIdIfOnPage(merged) {
  const results = [];
  const v = merged.jobId;
  if (v === undefined || v === null || v === "") return results;
  const el = findMeslekSelect();
  if (!el || !isVisible(el)) return results;
  const ok = setSelectByValueOrOptionText(el, String(v));
  commitField(el);
  results.push({ name: "jobId", ok });
  return results;
}

function mergeStep3(storedWizardStep3, payloadStep3) {
  return {
    ...DEFAULT_WIZARD_STEP3,
    ...(storedWizardStep3 && typeof storedWizardStep3 === "object" ? storedWizardStep3 : {}),
    ...(payloadStep3 && typeof payloadStep3 === "object" ? payloadStep3 : {}),
  };
}

function fillWizardStep3Travel(merged) {
  const { entry, ret } = resolveStep3VisaDates(merged);
  const map = {
    ...merged,
    visaEntryDate: entry,
    visaReturnDate: ret,
  };
  const results = [];

  for (const name of STEP3_TRAVEL_FIELD_ORDER) {
    const val = map[name];
    if (val == null || val === "") {
      results.push({ name, ok: false });
      continue;
    }
    const el = findByName(name);
    if (!el || !isVisible(el)) {
      results.push({ name, ok: false });
      continue;
    }
    setInputValue(el, valueForField(el, name, val));
    commitField(el);
    results.push({ name, ok: true });
  }

  fillOptionalTravelText(map, results);
  fillOptionalOtherSchCountries(map, results);

  if (!setSchengenFingerprintRadio(map)) {
    results.push({ name: "schengenVisaFingerPrint", ok: false });
  } else {
    results.push({ name: "schengenVisaFingerPrint", ok: true });
  }

  fillRequestedEntryCount(map, results);

  return { results, visaEntryDate: entry, visaReturnDate: ret };
}

function resolveDynamicElement(key, labels, fieldMap) {
  if (fieldMap && fieldMap[key]) {
    return resolveField(fieldMap[key]);
  }
  const byName = NAME_BY_KEY[key];
  if (byName) {
    const el = findByName(byName);
    if (el) return el;
  }
  return resolveField({ strategy: "label", text: labels[key] });
}

function applyDynamic(labels, data, fieldMap) {
  const keys = ["ad", "soyad", "tc", "dogum_tarihi"];
  const results = [];
  for (const key of keys) {
    const val = data[key];
    if (val == null || val === "") {
      results.push({ key, ok: false, reason: "boş" });
      continue;
    }
    const el = resolveDynamicElement(key, labels, fieldMap);
    if (el) {
      setInputValue(el, valueForField(el, key, val));
      results.push({ key, ok: true });
    } else {
      results.push({ key, ok: false, reason: "bulunamadı" });
    }
  }
  return results;
}

function applyStatic(staticFields) {
  const results = [];
  if (!Array.isArray(staticFields)) return results;
  for (const item of staticFields) {
    if (!item) continue;
    let el = null;
    if (item.name) el = findByName(item.name);
    if (!el && item.label) el = findByLabel(item.label);
    if (!el) {
      results.push({ label: item.label || item.name, ok: false });
      continue;
    }
    const type = (item.type || "fill").toLowerCase();
    if (type === "select") {
      setInputValue(el, item.value);
    } else {
      setInputValue(el, item.value ?? "");
    }
    results.push({ label: item.label || item.name, ok: true });
  }
  return results;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function waitFor(predicate, timeoutMs = 20000, intervalMs = 150) {
  const t0 = Date.now();
  return new Promise((resolve, reject) => {
    function tick() {
      try {
        const v = predicate();
        if (v) return resolve(v);
      } catch {
        /* ignore */
      }
      if (Date.now() - t0 > timeoutMs) return reject(new Error("Zaman aşımı: sonraki adım görünmedi"));
      setTimeout(tick, intervalMs);
    }
    tick();
  });
}

function sonrakiLabel(btn) {
  return (btn.textContent || "").replace(/\s+/g, " ").trim();
}

function isSonrakiButton(btn) {
  const t = norm(sonrakiLabel(btn));
  return t.startsWith("sonraki");
}

function isButtonVisibleForClick(b) {
  const r = b.getBoundingClientRect();
  if (r.width < 2 || r.height < 2) return false;
  const s = getComputedStyle(b);
  if (s.display === "none" || s.visibility === "hidden" || Number(s.opacity) === 0) return false;
  if (s.pointerEvents === "none") return false;
  return true;
}

function getWizardSonrakiButtonsInView() {
  return Array.from(document.querySelectorAll("button.wizard-btn")).filter(
    (b) => isSonrakiButton(b) && isButtonVisibleForClick(b)
  );
}

function getSonrakiButtonsInView() {
  const all = Array.from(document.querySelectorAll("button")).filter(
    (b) => isSonrakiButton(b) && isButtonVisibleForClick(b)
  );
  const wiz = all.filter((b) => b.classList.contains("wizard-btn"));
  return wiz.length ? wiz : all;
}

function forceActivateClick(btn) {
  const ev = { bubbles: true, cancelable: true, view: window };
  try {
    btn.dispatchEvent(new PointerEvent("pointerdown", { ...ev, composed: true }));
  } catch {
    /* ignore */
  }
  btn.dispatchEvent(new MouseEvent("mousedown", ev));
  try {
    btn.dispatchEvent(new PointerEvent("pointerup", { ...ev, composed: true }));
  } catch {
    /* ignore */
  }
  btn.dispatchEvent(new MouseEvent("mouseup", ev));
  btn.click();
}

function isNextButtonEnabled(b) {
  if (b.disabled) return false;
  if (b.getAttribute("aria-disabled") === "true") return false;
  if (b.classList.contains("disabled")) return false;
  return true;
}

function clickSonraki() {
  const enabled = getSonrakiButtonsInView().filter(isNextButtonEnabled);
  if (enabled.length === 0) return false;
  const btn = enabled[enabled.length - 1];
  try {
    btn.scrollIntoView({ block: "center", behavior: "instant" });
  } catch {
    btn.scrollIntoView(true);
  }
  try {
    btn.focus({ preventScroll: true });
  } catch {
    btn.focus();
  }
  forceActivateClick(btn);
  return true;
}

async function clickEnabledSonrakiFromList(pickEnabled, maxWaitMs) {
  const t0 = Date.now();
  while (Date.now() - t0 < maxWaitMs) {
    const enabled = pickEnabled().filter(isNextButtonEnabled);
    if (enabled.length > 0) {
      const btn = enabled[enabled.length - 1];
      try {
        btn.scrollIntoView({ block: "center", behavior: "instant" });
      } catch {
        btn.scrollIntoView(true);
      }
      try {
        btn.focus({ preventScroll: true });
      } catch {
        btn.focus();
      }
      forceActivateClick(btn);
      return true;
    }
    await sleep(100);
  }
  return false;
}

async function clickSonrakiWhenReady(maxWaitMs = 15000) {
  const ok = await clickEnabledSonrakiFromList(getSonrakiButtonsInView, maxWaitMs);
  if (ok) return true;
  return clickSonraki();
}

async function clickWizardSonrakiWhenReady(maxWaitMs = 15000) {
  return clickEnabledSonrakiFromList(getWizardSonrakiButtonsInView, maxWaitMs);
}

function generatePassportNo() {
  const n = Math.floor(Math.random() * 1e8);
  return "U" + String(n).padStart(8, "0");
}

function mergeStep2(storedWizardStep2, payloadStep2) {
  return {
    ...DEFAULT_WIZARD_STEP2,
    ...(storedWizardStep2 && typeof storedWizardStep2 === "object" ? storedWizardStep2 : {}),
    ...(payloadStep2 && typeof payloadStep2 === "object" ? payloadStep2 : {}),
  };
}

function fillWizardStep2(merged) {
  const passportNo = merged.passportNo || generatePassportNo();
  const map = { ...merged, passportNo };
  const results = [];
  for (const name of STEP2_FIELD_ORDER) {
    const val = map[name];
    if (val === undefined || val === null || val === "") continue;
    const el = findByName(name);
    if (!el) {
      results.push({ name, ok: false });
      continue;
    }
    setInputValue(el, valueForField(el, name, val));
    results.push({ name, ok: true });
  }
  return { results, passportNo };
}

/* ====== ANA AKIŞ ====== */

async function runWizardFlow(payload) {
  const stored = await getStored();
  const labels = { ...DEFAULT_DYNAMIC_LABELS, ...(stored.dynamicLabels || {}) };
  const fieldMap = stored.dynamicFieldMap || null;

  const dynamicResults = applyDynamic(labels, payload || {}, fieldMap);
  const failedDyn = dynamicResults.filter((r) => !r.ok);
  if (failedDyn.length) {
    return {
      ok: false, dynamic: dynamicResults, static: [], step1Extra: [], step2: [], step3: [],
      wizardError: "Sayfa 1 (kimlik) eksik: " + failedDyn.map((x) => x.key).join(", "),
    };
  }

  await sleep(400);
  if (!(await clickSonrakiWhenReady(18000))) {
    return {
      ok: false, dynamic: dynamicResults, static: [], step1Extra: [], step2: [], step3: [],
      wizardError: "Sayfa 1 → Sonraki tıklanamadı.",
    };
  }

  let staticResults = [];
  try {
    await waitFor(() => { const el = findByName("birthPlace"); return el && isVisible(el); }, 25000);
  } catch (e) {
    return {
      ok: false, dynamic: dynamicResults, static: [], step1Extra: [], step2: [], step3: [],
      wizardError: "Sayfa 2 açılmadı: " + String(e.message || e),
    };
  }

  await sleep(250);
  staticResults = applyStatic(stored.staticFields || []);
  const step2Merged = mergeStep2(stored.wizardStep2, payload?.step2);
  const { results: step2Results, passportNo: usedPassportNo } = fillWizardStep2(step2Merged);
  const failed2 = step2Results.filter((r) => !r.ok);
  if (failed2.length) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: [], step2: step2Results, step3: [],
      wizardError: "Sayfa 2 eksik: " + failed2.map((x) => x.name).join(", "),
    };
  }

  await sleep(450);
  if (!(await clickSonrakiWhenReady(15000))) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: [], step2: step2Results, step3: [],
      wizardError: "Sayfa 2 → Sonraki tıklanamadı.",
    };
  }

  let step1ExtraResults = [];
  try {
    await waitFor(() => {
      const em = findByName("eMail"); const city = findByName("applicantCityId");
      const st = findByName("street"); const ph = findKosmosPhoneInput();
      return (em && isVisible(em)) || (city && isVisible(city)) || (st && isVisible(st)) || (ph && isVisible(ph));
    }, 22000);
  } catch (e) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: [], step2: step2Results, step3: [],
      wizardError: "Sayfa 3 açılmadı: " + String(e.message || e),
    };
  }

  await sleep(350);
  step1ExtraResults = fillStep1Extra(payload, stored.wizardStep1Extra, true);
  const failed1x = step1ExtraResults.filter((r) => !r.ok && !r.skipped);
  if (failed1x.length) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: [],
      wizardError: "Sayfa 3 eksik: " + failed1x.map((x) => x.name).join(", "),
    };
  }

  await sleep(500);
  if (!(await clickSonrakiWhenReady(18000))) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: [],
      wizardError: "Sayfa 3 → Sonraki tıklanamadı.",
    };
  }

  let step3Results = [];
  let visaEntryResolved;
  let visaReturnResolved;
  const step3Merged = mergeStep3(stored.wizardStep3, payload?.step3);

  /* --- Sayfa 4: meslek --- */
  try {
    await waitFor(() => { const job = findMeslekSelect(); return job && isVisible(job); }, 25000);
  } catch (e) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: [],
      wizardError: "Sayfa 4 (meslek) açılmadı: " + String(e.message || e),
    };
  }
  await sleep(250);
  const jobFill = fillJobIdIfOnPage(step3Merged);
  step3Results.push(...jobFill);
  const jobWanted = step3Merged.jobId != null && String(step3Merged.jobId).trim() !== "";
  if (jobWanted && (jobFill.length === 0 || jobFill.some((r) => !r.ok))) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 4 (meslek) eksik: jobId",
    };
  }
  await sleep(500);
  if (!(await clickWizardSonrakiWhenReady(22000))) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 4 → Sonraki tıklanamadı.",
    };
  }

  /* --- Sayfa 5: seyahat --- */
  try {
    await waitFor(() => {
      const tr = findByName("traveltype"); const dest = findByName("schDestinationCountryId"); const ent = findByName("visaEntryDate");
      return (tr && isVisible(tr)) || (dest && isVisible(dest)) || (ent && isVisible(ent));
    }, 25000);
  } catch (e) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 5 (seyahat) açılmadı: " + String(e.message || e),
    };
  }
  await sleep(300);
  const travelFill = fillWizardStep3Travel(step3Merged);
  step3Results.push(...travelFill.results);
  visaEntryResolved = travelFill.visaEntryDate;
  visaReturnResolved = travelFill.visaReturnDate;
  const failedTravel = travelFill.results.filter((r) => !r.ok);
  if (failedTravel.length) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 5 (seyahat) eksik: " + failedTravel.map((x) => x.name).join(", "),
    };
  }
  await sleep(550);
  if (!(await clickWizardSonrakiWhenReady(22000))) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 5 → Sonraki tıklanamadı.",
    };
  }

  /* --- Sayfa 6: Kalacak Yer — boş geç --- */
  try {
    await waitFor(() => isKalacakYerBilgileriStepVisible(), 22000);
  } catch (e) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 6 (kalacak yer) açılmadı: " + String(e.message || e),
    };
  }
  await sleep(400);
  if (!(await clickWizardSonrakiWhenReady(22000))) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 6 → Sonraki tıklanamadı.",
    };
  }

  /* --- Sayfa 7: Masraflar --- */
  try {
    await waitFor(() => isMasraflarStepVisible(), 42000, 280);
  } catch (e) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 7 (masraflar) açılmadı: " + String(e.message || e),
    };
  }
  await sleep(1400);
  const masrafResults = await fillWizardStep7Masraflar();
  step3Results.push(...masrafResults);
  const failedMasraf = masrafResults.filter((r) => !r.ok && !r.skipped);
  if (failedMasraf.length) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 7 (masraflar) eksik: " + failedMasraf.map((x) => x.name).join(", "),
    };
  }
  await sleep(1100);
  if (!(await clickWizardSonrakiWhenReady(32000))) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 7 → Sonraki tıklanamadı.",
    };
  }

  /* --- Sayfa 8: KVKK --- */
  try {
    await waitFor(() => isKVKKStepVisible(), 22000);
  } catch (e) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 8 (KVKK) açılmadı: " + String(e.message || e),
    };
  }
  await sleep(300);
  const kvkkResults = await fillWizardStep8KVKK(step3Merged);
  step3Results.push(...kvkkResults);
  const kvkkFail = kvkkResults.filter(
    (r) => !r.ok && r.name !== "kvkkScroll" && r.name !== "kvkkScrollRetry"
  );
  if (kvkkFail.length) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 8 (KVKK) eksik: " + kvkkFail.map((x) => x.name).join(", "),
    };
  }
  await sleep(400);
  if (!(await clickWizardSonrakiWhenReady(22000))) {
    return {
      ok: false, dynamic: dynamicResults, static: staticResults, step1Extra: step1ExtraResults, step2: step2Results, step3: step3Results,
      wizardError: "Sayfa 8 → Sonraki tıklanamadı.",
    };
  }

  return {
    ok: true,
    dynamic: dynamicResults,
    static: staticResults,
    step1Extra: step1ExtraResults,
    step2: step2Results,
    step3: step3Results,
    passportNo: usedPassportNo,
    visaEntryDate: visaEntryResolved,
    visaReturnDate: visaReturnResolved,
  };
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "KOSMOS_FILL_WIZARD") {
    (async () => {
      try {
        const result = await runWizardFlow(msg.payload || {});
        sendResponse(result);
      } catch (e) {
        sendResponse({ ok: false, wizardError: String(e.message || e) });
      }
    })();
    return true;
  }

  if (msg?.type === "KOSMOS_FILL") {
    (async () => {
      const stored = await getStored();
      const labels = { ...DEFAULT_DYNAMIC_LABELS, ...(stored.dynamicLabels || {}) };
      const fieldMap = stored.dynamicFieldMap || null;
      const dynamicResults = applyDynamic(labels, msg.payload || {}, fieldMap);
      const staticResults = applyStatic(stored.staticFields || []);
      const step1ExtraResults = fillStep1Extra(
        msg.payload || {},
        stored.wizardStep1Extra,
        false
      );
      sendResponse({
        ok: true,
        dynamic: dynamicResults,
        static: staticResults,
        step1Extra: step1ExtraResults,
      });
    })();
    return true;
  }
});
