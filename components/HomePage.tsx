"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Musteri = {
  id: number;
  ad: string;
  soyad: string;
  tc: string;
  dogum_tarihi: string;
  telefon: string;
};

function formatDogumInput(raw: string) {
  let v = raw.replace(/\D/g, "");
  if (v.length > 8) v = v.slice(0, 8);
  let formatted = "";
  for (let i = 0; i < v.length; i++) {
    if (i === 2 || i === 4) formatted += ".";
    formatted += v[i];
  }
  return formatted;
}

/** GG.AA.YYYY formatindan yas hesapla. Gecersizse null doner. */
function calcAge(ddmmyyyy: string): number | null {
  const m = ddmmyyyy.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (!m) return null;
  const birth = new Date(+m[3], +m[2] - 1, +m[1]);
  if (isNaN(birth.getTime())) return null;
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

export default function HomePage() {
  const [ad, setAd] = useState("");
  const [soyad, setSoyad] = useState("");
  const [tc, setTc] = useState("");
  const [dogum, setDogum] = useState("");
  const [telefon, setTelefon] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<Musteri[]>([]);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [btnLabel, setBtnLabel] = useState("Kaydet ve ID Al");
  const [showCancel, setShowCancel] = useState(false);
  const [statusText, setStatusText] = useState("");
  const [statusKind, setStatusKind] = useState<"" | "err" | "ok" | "warn">("");
  const [showIdBox, setShowIdBox] = useState(false);
  const [newId, setNewId] = useState("—");
  const [submitting, setSubmitting] = useState(false);
  const isChild = dogum.length === 10 && (calcAge(dogum) ?? 99) < 12;
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const refreshList = useCallback(async (q: string) => {
    try {
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      const r = await fetch(`/api/musteri${qs}`);
      const j = await r.json();
      const list = (j.musteriler || []) as Musteri[];
      setRows(list);
    } catch {
      setRows([]);
    }
  }, []);

  useEffect(() => {
    refreshList("");
  }, [refreshList]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => refreshList(search.trim()), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, refreshList]);

  function clearForm() {
    setAd("");
    setSoyad("");
    setTc("");
    setDogum("");
    setTelefon("");
    setEditingId(null);
    setBtnLabel("Kaydet ve ID Al");
    setShowCancel(false);
  }

  function cancelEdit() {
    clearForm();
    setStatusText("");
    setStatusKind("");
  }

  function editMusteri(id: number) {
    const m = rows.find((r) => r.id === id);
    if (!m) return;
    setAd(m.ad);
    setSoyad(m.soyad);
    setTc(m.tc);
    setDogum(m.dogum_tarihi);
    setTelefon(m.telefon || "");
    setEditingId(id);
    setBtnLabel(`#${id} Güncelle`);
    setShowCancel(true);
    setStatusText(`#${id} düzenleniyor…`);
    setStatusKind("warn");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteMusteri(id: number) {
    if (!confirm(`#${id} numaralı müşteriyi silmek istediğinize emin misiniz?`)) return;
    try {
      const r = await fetch(`/api/musteri/${id}`, { method: "DELETE" });
      if (!r.ok) {
        alert("Silinemedi");
        return;
      }
      if (editingId === id) clearForm();
      await refreshList(search.trim());
    } catch {
      alert("Hata");
    }
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatusText("");
    setStatusKind("");
    setSubmitting(true);
    const body = {
      ad: ad.trim(),
      soyad: soyad.trim(),
      tc: tc.trim(),
      dogum_tarihi: dogum.trim(),
      telefon: telefon.trim(),
    };
    try {
      const isEdit = editingId !== null;
      const url = isEdit ? `/api/musteri/${editingId}` : "/api/musteri";
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setStatusKind(r.status === 409 ? "warn" : "err");
        const d = j.detail;
        setStatusText(
          Array.isArray(d)
            ? d.map((x: { msg?: string }) => x.msg || JSON.stringify(x)).join(" · ")
            : d || r.statusText || "Hata"
        );
        return;
      }
      const savedId = String(j.id);
      setStatusKind("ok");
      setNewId(savedId);
      setShowIdBox(true);

      // Panoya kopyala
      try { await navigator.clipboard.writeText(savedId); } catch { /* */ }

      // Eklentiye otomatik aktar (foxvize-bridge.js content script dinler)
      try {
        window.postMessage(
          { type: "FOXVIZE_MUSTERI_SAVED", payload: j },
          "*"
        );
      } catch { /* eklenti yoksa sorun değil */ }

      setStatusText(
        isEdit
          ? `#${savedId} güncellendi.`
          : `Kaydedildi — ID #${savedId} panoya kopyalandı.`
      );
      clearForm();
      await refreshList(search.trim());
    } catch (err) {
      setStatusKind("err");
      setStatusText(String(err));
    } finally {
      setSubmitting(false);
    }
  }

  const displayRows = [...rows].reverse();

  return (
    <>
      <nav className="nav">
        <div className="brand">
          FoxVize <span>· Müşteri Yönetimi</span>
        </div>
        <div className="nav-links">
          <a href="#form-section">Kayıt</a>
          <a href="#list-section">Müşteriler</a>
          <a href="#download-section">Eklenti</a>
        </div>
      </nav>

      <div className="container">
        <section className="hero" id="download-section">
          <div className="hero-text">
            <h2>Chrome Eklentisini İndirin</h2>
            <p>
              Kosmos başvuru formlarını otomatik dolduran Chrome eklentisini indirin. Müşteri
              bilgilerini buradan kaydedin; eklentide API adresinizi ve müşteri ID’sini kullanın.
            </p>
          </div>
          <a
            className="btn-download"
            href="/extension.zip"
            download="kosmos-eklenti.zip"
          >
            <svg viewBox="0 0 16 16" aria-hidden>
              <path d="M2.75 14A1.75 1.75 0 0 1 1 12.25v-2.5a.75.75 0 0 1 1.5 0v2.5c0 .138.112.25.25.25h10.5a.25.25 0 0 0 .25-.25v-2.5a.75.75 0 0 1 1.5 0v2.5A1.75 1.75 0 0 1 13.25 14ZM7.25 7.689V2a.75.75 0 0 1 1.5 0v5.689l1.97-1.969a.749.749 0 1 1 1.06 1.06l-3.25 3.25a.749.749 0 0 1-1.06 0L4.22 6.78a.749.749 0 1 1 1.06-1.06l1.97 1.969Z" />
            </svg>
            İndir (.zip)
          </a>
        </section>

        <div className="grid">
          <section className="card" id="form-section">
            <h3>Müşteri Kaydı</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.75rem", lineHeight: 1.45 }}>
              Kaydettiğinizde size <strong>1–999</strong> arası rastgele ve benzersiz bir müşteri numarası verilir
              (en fazla 999 kayıt). Aynı anda birden fazla kayıt olsa bile numaralar birbirine karışmaz.
            </p>
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="ad">Ad</label>
                <input
                  id="ad"
                  value={ad}
                  onChange={(e) => setAd(e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="field">
                <label htmlFor="soyad">Soyad</label>
                <input
                  id="soyad"
                  value={soyad}
                  onChange={(e) => setSoyad(e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
              <div className="field">
                <label htmlFor="tc">T.C. Kimlik No (11 hane)</label>
                <input
                  id="tc"
                  value={tc}
                  onChange={(e) => setTc(e.target.value.replace(/\D/g, "").slice(0, 11))}
                  required
                  inputMode="numeric"
                  maxLength={11}
                  pattern="\d{11}"
                />
              </div>
              <div className="field">
                <label htmlFor="dogum_tarihi">Doğum Tarihi</label>
                <input
                  id="dogum_tarihi"
                  value={dogum}
                  onChange={(e) => setDogum(formatDogumInput(e.target.value))}
                  required
                  placeholder="GG.AA.YYYY"
                  maxLength={10}
                  inputMode="numeric"
                />
              </div>
              <div className="field">
                <label htmlFor="telefon">
                  Telefon {isChild
                    ? "(12 yaş altı — veli telefonu kullanılabilir)"
                    : "(isteğe bağlı)"}
                </label>
                <input
                  id="telefon"
                  type="tel"
                  value={telefon}
                  onChange={(e) => setTelefon(e.target.value)}
                  autoComplete="tel"
                  placeholder="05xx..."
                />
              </div>
              <button type="submit" className="btn-submit" disabled={submitting}>
                {btnLabel}
              </button>
              {showCancel && (
                <button type="button" className="btn-cancel" onClick={cancelEdit}>
                  Düzenlemeyi İptal Et
                </button>
              )}
            </form>
            {showIdBox && (
              <div className="idBox">
                <div className="label">Müşteri ID</div>
                <strong>{newId}</strong>
                <div className="id-hint">Eklentiye otomatik gönderildi</div>
              </div>
            )}
            {statusText && (
              <div className={`status ${statusKind}`}>{statusText}</div>
            )}
          </section>

          <section className="card" id="list-section">
            <h3>Kayıtlı Müşteriler</h3>
            <div className="search-wrap">
              <input
                type="text"
                placeholder="İsim veya TC ile ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <div className="list-container">
              <ul className="list">
                {displayRows.length === 0 ? (
                  <li className="empty-state">Kayıt bulunamadı</li>
                ) : (
                  displayRows.map((m) => (
                    <li key={m.id}>
                      <div className="info">
                        <div className="name">
                          #{m.id} — {m.ad} {m.soyad}
                        </div>
                        <div className="meta">
                          TC {m.tc}
                          {m.telefon ? ` · ${m.telefon}` : ""}
                        </div>
                      </div>
                      <div className="actions">
                        <button
                          type="button"
                          className="act-btn act-edit"
                          onClick={() => editMusteri(m.id)}
                        >
                          Düzenle
                        </button>
                        <button
                          type="button"
                          className="act-btn act-del"
                          onClick={() => deleteMusteri(m.id)}
                        >
                          Sil
                        </button>
                      </div>
                    </li>
                  ))
                )}
              </ul>
            </div>
          </section>
        </div>
      </div>

      <footer className="footer">
        FoxVize © 2026 Tüm hakları saklıdır · Prod By Yusuf Kutas
      </footer>
    </>
  );
}
