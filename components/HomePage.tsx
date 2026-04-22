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

type AlmanyaDurum = "beklemede" | "islemde" | "cikmis" | "hata";

type AlmanyaKayit = {
  id: number;
  ad_soyad: string;
  pasaport_no: string;
  barkod_no: string;
  cikti: boolean;
  cikti_at: string | null;
  durum: AlmanyaDurum;
  son_mesaj: string | null;
  sorgu_at: string | null;
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

function durumLabel(d: AlmanyaDurum): string {
  switch (d) {
    case "cikmis": return "ÇIKTI";
    case "islemde": return "İŞLEMDE";
    case "hata": return "HATA";
    default: return "BEKLEMEDE";
  }
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

  // Almanya
  const [almAd, setAlmAd] = useState("");
  const [almPasaport, setAlmPasaport] = useState("");
  const [almBarkod, setAlmBarkod] = useState("");
  const [almRows, setAlmRows] = useState<AlmanyaKayit[]>([]);
  const [almSearch, setAlmSearch] = useState("");
  const [almEditingId, setAlmEditingId] = useState<number | null>(null);
  const [almBtnLabel, setAlmBtnLabel] = useState("Kaydet ve ID Al");
  const [almShowCancel, setAlmShowCancel] = useState(false);
  const [almSubmitting, setAlmSubmitting] = useState(false);
  const [almStatusText, setAlmStatusText] = useState("");
  const [almStatusKind, setAlmStatusKind] = useState<"" | "err" | "ok" | "warn">("");
  const [almShowIdBox, setAlmShowIdBox] = useState(false);
  const [almNewId, setAlmNewId] = useState("—");
  const almSearchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

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

  const refreshAlmanyaList = useCallback(async (q: string) => {
    try {
      const qs = q ? `?q=${encodeURIComponent(q)}` : "";
      const r = await fetch(`/api/almanya${qs}`);
      const j = await r.json();
      const list = (j.kayitlar || []) as AlmanyaKayit[];
      setAlmRows(list);
    } catch {
      setAlmRows([]);
    }
  }, []);

  useEffect(() => {
    refreshList("");
    refreshAlmanyaList("");
  }, [refreshList, refreshAlmanyaList]);

  // Almanya listesini periyodik yenile (eklenti arka planda durum isaretliyor)
  useEffect(() => {
    const t = setInterval(() => refreshAlmanyaList(almSearch.trim()), 15000);
    return () => clearInterval(t);
  }, [refreshAlmanyaList, almSearch]);

  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => refreshList(search.trim()), 300);
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current);
    };
  }, [search, refreshList]);

  useEffect(() => {
    if (almSearchTimer.current) clearTimeout(almSearchTimer.current);
    almSearchTimer.current = setTimeout(() => refreshAlmanyaList(almSearch.trim()), 300);
    return () => {
      if (almSearchTimer.current) clearTimeout(almSearchTimer.current);
    };
  }, [almSearch, refreshAlmanyaList]);

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
      if (!r.ok) { alert("Silinemedi"); return; }
      if (editingId === id) clearForm();
      await refreshList(search.trim());
    } catch { alert("Hata"); }
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
      try { await navigator.clipboard.writeText(savedId); } catch { /* */ }
      try {
        window.postMessage({ type: "FOXVIZE_MUSTERI_SAVED", payload: j }, "*");
      } catch { /* */ }
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

  // ── ALMANYA ──
  function clearAlmForm() {
    setAlmAd("");
    setAlmPasaport("");
    setAlmBarkod("");
    setAlmEditingId(null);
    setAlmBtnLabel("Kaydet ve ID Al");
    setAlmShowCancel(false);
  }

  function cancelAlmEdit() {
    clearAlmForm();
    setAlmStatusText("");
    setAlmStatusKind("");
  }

  function editAlmanya(id: number) {
    const m = almRows.find((r) => r.id === id);
    if (!m) return;
    setAlmAd(m.ad_soyad);
    setAlmPasaport(m.pasaport_no);
    setAlmBarkod(m.barkod_no);
    setAlmEditingId(id);
    setAlmBtnLabel(`#${id} Güncelle`);
    setAlmShowCancel(true);
    setAlmStatusText(`#${id} düzenleniyor…`);
    setAlmStatusKind("warn");
  }

  async function deleteAlmanya(id: number) {
    if (!confirm(`Almanya kaydı #${id} silinsin mi?`)) return;
    try {
      const r = await fetch(`/api/almanya/${id}`, { method: "DELETE" });
      if (!r.ok) { alert("Silinemedi"); return; }
      if (almEditingId === id) clearAlmForm();
      await refreshAlmanyaList(almSearch.trim());
    } catch { alert("Hata"); }
  }

  async function onAlmSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAlmStatusText("");
    setAlmStatusKind("");
    setAlmSubmitting(true);
    const body = {
      ad_soyad: almAd.trim(),
      pasaport_no: almPasaport.trim(),
      barkod_no: almBarkod.trim(),
    };
    try {
      const isEdit = almEditingId !== null;
      const url = isEdit ? `/api/almanya/${almEditingId}` : "/api/almanya";
      const method = isEdit ? "PUT" : "POST";
      const r = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const j = await r.json().catch(() => ({}));
      if (!r.ok) {
        setAlmStatusKind(r.status === 409 ? "warn" : "err");
        const d = j.detail;
        setAlmStatusText(
          Array.isArray(d)
            ? d.map((x: { msg?: string }) => x.msg || JSON.stringify(x)).join(" · ")
            : d || r.statusText || "Hata"
        );
        return;
      }
      const savedId = String(j.id);
      setAlmStatusKind("ok");
      setAlmNewId(savedId);
      setAlmShowIdBox(true);
      try { await navigator.clipboard.writeText(savedId); } catch { /* */ }
      try {
        window.postMessage({ type: "FOXVIZE_ALMANYA_SAVED", payload: j }, "*");
      } catch { /* */ }
      setAlmStatusText(
        isEdit
          ? `#${savedId} güncellendi.`
          : `Kaydedildi — ID #${savedId} panoya kopyalandı.`
      );
      clearAlmForm();
      await refreshAlmanyaList(almSearch.trim());
    } catch (err) {
      setAlmStatusKind("err");
      setAlmStatusText(String(err));
    } finally {
      setAlmSubmitting(false);
    }
  }

  const displayRows = [...rows].reverse();
  const displayAlmRows = [...almRows].reverse();

  return (
    <>
      <nav className="nav">
        <div className="brand">
          FoxVize <span>· Müşteri Yönetimi</span>
        </div>
        <div className="nav-links">
          <a href="#yunan-liste">Yunan Liste</a>
          <a href="#yunan-kayit">Yunan Kayıt</a>
          <a href="#almanya-kayit">Almanya Kayıt</a>
          <a href="#almanya-liste">Almanya Liste</a>
          <a href="#download-section">Eklenti</a>
        </div>
      </nav>

      <div className="container">
        <section className="hero" id="download-section">
          <div className="hero-text">
            <h2>Chrome Eklentisini İndirin</h2>
            <p>
              Kosmos başvuru formlarını ve Almanya pasaport takip (idata.com.tr) sorgularını
              otomatik dolduran Chrome eklentisini indirin. Eklentide üstteki sekmeden
              <strong> Yunan</strong> ya da <strong>Almanya</strong> modunu seçebilirsiniz.
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

        <div className="grid grid-4">
          {/* 1. En sol: YUNAN LİSTE */}
          <section className="card card-yunan-list" id="yunan-liste">
            <h3>Yunan — Kayıtlı Müşteriler</h3>
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

          {/* 2. YUNAN KAYIT formu */}
          <section className="card card-yunan" id="yunan-kayit">
            <h3>Yunan — Müşteri Kaydı</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.75rem", lineHeight: 1.45 }}>
              Kaydettiğinizde size <strong>1–999</strong> arası rastgele ve benzersiz bir müşteri numarası verilir.
            </p>
            <form onSubmit={onSubmit}>
              <div className="field">
                <label htmlFor="ad">Ad</label>
                <input id="ad" value={ad} onChange={(e) => setAd(e.target.value)} required autoComplete="given-name" />
              </div>
              <div className="field">
                <label htmlFor="soyad">Soyad</label>
                <input id="soyad" value={soyad} onChange={(e) => setSoyad(e.target.value)} required autoComplete="family-name" />
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

          {/* 3. ALMANYA KAYIT formu */}
          <section className="card card-almanya" id="almanya-kayit">
            <h3>Almanya — Müşteri Kaydı</h3>
            <p style={{ fontSize: "0.8rem", color: "var(--muted)", marginBottom: "0.75rem", lineHeight: 1.45 }}>
              idata.com.tr Almanya pasaport takibi için kayıt oluşturun. Her kayda <strong>1–999</strong> arası benzersiz ID atanır.
            </p>
            <form onSubmit={onAlmSubmit}>
              <div className="field">
                <label htmlFor="alm_ad">İsim Soyisim</label>
                <input id="alm_ad" value={almAd} onChange={(e) => setAlmAd(e.target.value)} required placeholder="Ad Soyad" />
              </div>
              <div className="field">
                <label htmlFor="alm_pasaport">Pasaport No</label>
                <input
                  id="alm_pasaport"
                  value={almPasaport}
                  onChange={(e) => setAlmPasaport(e.target.value.toUpperCase())}
                  required
                  maxLength={20}
                  placeholder="U12345678"
                />
              </div>
              <div className="field">
                <label htmlFor="alm_barkod">Barkod No</label>
                <input
                  id="alm_barkod"
                  value={almBarkod}
                  onChange={(e) => setAlmBarkod(e.target.value)}
                  required
                  maxLength={20}
                  placeholder="Barkod"
                />
              </div>
              <button type="submit" className="btn-submit" disabled={almSubmitting}>
                {almBtnLabel}
              </button>
              {almShowCancel && (
                <button type="button" className="btn-cancel" onClick={cancelAlmEdit}>
                  Düzenlemeyi İptal Et
                </button>
              )}
            </form>
            {almShowIdBox && (
              <div className="idBox">
                <div className="label">Almanya ID</div>
                <strong>{almNewId}</strong>
                <div className="id-hint">Eklentiye otomatik gönderildi</div>
              </div>
            )}
            {almStatusText && (
              <div className={`status ${almStatusKind}`}>{almStatusText}</div>
            )}
          </section>

          {/* 4. En sağ: ALMANYA LİSTE */}
          <section className="card card-almanya-list" id="almanya-liste">
            <h3>Almanya — Kayıtlı Müşteriler</h3>
            <div className="search-wrap">
              <input
                type="text"
                placeholder="İsim, pasaport veya barkod..."
                value={almSearch}
                onChange={(e) => setAlmSearch(e.target.value)}
              />
            </div>
            <div className="durum-legend">
              <span className="dl dl-cikmis">Çıktı</span>
              <span className="dl dl-islemde">İşlemde</span>
              <span className="dl dl-hata">Hata</span>
              <span className="dl dl-bek">Beklemede</span>
            </div>
            <div className="list-container">
              <ul className="list">
                {displayAlmRows.length === 0 ? (
                  <li className="empty-state">Kayıt bulunamadı</li>
                ) : (
                  displayAlmRows.map((m) => {
                    const durum = m.durum || "beklemede";
                    const rowCls = `alm-row alm-${durum}`;
                    return (
                      <li key={m.id} className={rowCls}>
                        <div className="info">
                          <div className="name">
                            {durum === "hata" && (
                              <span className="alert-icon" title={m.son_mesaj || "Hata"}>⚠</span>
                            )}
                            #{m.id} — {m.ad_soyad}{" "}
                            <span className={`badge-durum b-${durum}`}>{durumLabel(durum)}</span>
                          </div>
                          <div className="meta">
                            Pas {m.pasaport_no} · Brk {m.barkod_no}
                            {m.son_mesaj && (
                              <div className="alm-mesaj">{m.son_mesaj}</div>
                            )}
                          </div>
                        </div>
                        <div className="actions">
                          <button
                            type="button"
                            className="act-btn act-edit"
                            onClick={() => editAlmanya(m.id)}
                          >
                            Düzenle
                          </button>
                          <button
                            type="button"
                            className="act-btn act-del"
                            onClick={() => deleteAlmanya(m.id)}
                          >
                            Sil
                          </button>
                        </div>
                      </li>
                    );
                  })
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
