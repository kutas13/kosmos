const $ = (id) => document.getElementById(id);

function load() {
  chrome.storage.local.get(
    [
      "apiBaseUrl",
      "staticFields",
      "dynamicLabels",
      "dynamicFieldMap",
      "wizardStep1Extra",
      "wizardStep2",
      "wizardStep3",
    ],
    (r) => {
      $("apiBaseUrl").value = r.apiBaseUrl ?? "http://127.0.0.1:3000";
      $("staticFields").value = JSON.stringify(r.staticFields ?? [], null, 2);
      $("dynamicLabels").value = JSON.stringify(r.dynamicLabels ?? {}, null, 2);
      $("dynamicFieldMap").value = JSON.stringify(r.dynamicFieldMap ?? {}, null, 2);
      $("wizardStep1Extra").value = JSON.stringify(r.wizardStep1Extra ?? {}, null, 2);
      $("wizardStep2").value = JSON.stringify(r.wizardStep2 ?? {}, null, 2);
      $("wizardStep3").value = JSON.stringify(r.wizardStep3 ?? {}, null, 2);
    }
  );
}

function setStatus(text, isErr) {
  const el = $("status");
  el.textContent = text;
  el.className = isErr ? "err" : "ok";
}

$("save").addEventListener("click", () => {
  const apiBaseUrl = $("apiBaseUrl").value.trim().replace(/\/$/, "") || "http://127.0.0.1:3000";
  let staticFields;
  let dynamicLabels;
  let dynamicFieldMap;
  let wizardStep1Extra;
  let wizardStep2;
  let wizardStep3;
  try {
    staticFields = JSON.parse($("staticFields").value || "[]");
    if (!Array.isArray(staticFields)) throw new Error("staticFields bir dizi olmalı");
  } catch (e) {
    setStatus("staticFields JSON hatası: " + e.message, true);
    return;
  }
  try {
    dynamicLabels = JSON.parse($("dynamicLabels").value || "{}");
    if (typeof dynamicLabels !== "object" || dynamicLabels === null || Array.isArray(dynamicLabels)) {
      throw new Error("dynamicLabels bir nesne olmalı");
    }
  } catch (e) {
    setStatus("dynamicLabels JSON hatası: " + e.message, true);
    return;
  }
  try {
    dynamicFieldMap = JSON.parse($("dynamicFieldMap").value || "{}");
    if (typeof dynamicFieldMap !== "object" || dynamicFieldMap === null || Array.isArray(dynamicFieldMap)) {
      throw new Error("dynamicFieldMap bir nesne olmalı");
    }
  } catch (e) {
    setStatus("dynamicFieldMap JSON hatası: " + e.message, true);
    return;
  }
  try {
    wizardStep1Extra = JSON.parse($("wizardStep1Extra").value || "{}");
    if (
      typeof wizardStep1Extra !== "object" ||
      wizardStep1Extra === null ||
      Array.isArray(wizardStep1Extra)
    ) {
      throw new Error("wizardStep1Extra bir nesne olmalı");
    }
  } catch (e) {
    setStatus("wizardStep1Extra JSON hatası: " + e.message, true);
    return;
  }
  try {
    wizardStep2 = JSON.parse($("wizardStep2").value || "{}");
    if (typeof wizardStep2 !== "object" || wizardStep2 === null || Array.isArray(wizardStep2)) {
      throw new Error("wizardStep2 bir nesne olmalı");
    }
  } catch (e) {
    setStatus("wizardStep2 JSON hatası: " + e.message, true);
    return;
  }
  try {
    wizardStep3 = JSON.parse($("wizardStep3").value || "{}");
    if (typeof wizardStep3 !== "object" || wizardStep3 === null || Array.isArray(wizardStep3)) {
      throw new Error("wizardStep3 bir nesne olmalı");
    }
  } catch (e) {
    setStatus("wizardStep3 JSON hatası: " + e.message, true);
    return;
  }

  chrome.storage.local.set(
    {
      apiBaseUrl,
      staticFields,
      dynamicLabels,
      dynamicFieldMap,
      wizardStep1Extra,
      wizardStep2,
      wizardStep3,
    },
    () => {
      setStatus("Kaydedildi.", false);
    }
  );
});

load();
