"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";

export default function LoginModal() {
  const router = useRouter();
  const params = useSearchParams();
  const nextPath = params.get("next") || "/";

  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [shake, setShake] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Modal acildiktan sonra input'a odaklan
    const t = setTimeout(() => inputRef.current?.focus(), 350);
    return () => clearTimeout(t);
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (busy) return;
    setError(null);
    setBusy(true);
    try {
      const r = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      const j = await r.json().catch(() => ({} as { detail?: string }));
      if (!r.ok) {
        setError(j.detail || "Sifre yanlis");
        setShake(true);
        setPassword("");
        setTimeout(() => setShake(false), 500);
        setTimeout(() => inputRef.current?.focus(), 100);
        return;
      }
      // Basarili - hedefe git
      router.replace(nextPath.startsWith("/") ? nextPath : "/");
      router.refresh();
    } catch (err) {
      setError("Baglanti hatasi: " + String(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fx-login-root">
      <div className="fx-login-backdrop" />

      <div className="fx-login-bg-shapes" aria-hidden>
        <span className="shape shape-1" />
        <span className="shape shape-2" />
        <span className="shape shape-3" />
      </div>

      <div className={`fx-login-card ${shake ? "shake" : ""}`}>
        <div className="fx-login-logo">
          <svg viewBox="0 0 32 32" width="42" height="42" aria-hidden>
            <defs>
              <linearGradient id="fxg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#639bff" />
                <stop offset="100%" stopColor="#a78bfa" />
              </linearGradient>
            </defs>
            <path
              fill="url(#fxg)"
              d="M16 2 C 22 6, 28 10, 28 18 C 28 26, 22 30, 16 30 C 10 30, 4 26, 4 18 C 4 10, 10 6, 16 2 Z M16 8 L 20 14 L 26 15 L 21.5 19 L 22.8 25 L 16 22 L 9.2 25 L 10.5 19 L 6 15 L 12 14 Z"
            />
          </svg>
        </div>
        <h1 className="fx-login-title">
          FoxVize<span> — Yonetim Paneli</span>
        </h1>
        <p className="fx-login-sub">Devam etmek icin sifreyi girin.</p>

        <form onSubmit={handleSubmit} className="fx-login-form">
          <div className="fx-login-field">
            <label htmlFor="pw" className="fx-sr-only">
              Sifre
            </label>
            <input
              id="pw"
              ref={inputRef}
              type="password"
              inputMode="numeric"
              autoComplete="current-password"
              placeholder="••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={busy}
              maxLength={64}
            />
          </div>
          {error && <div className="fx-login-error">{error}</div>}
          <button type="submit" className="fx-login-btn" disabled={busy || !password}>
            {busy ? (
              <span className="fx-spinner" aria-hidden />
            ) : (
              <>
                Giris Yap
                <svg viewBox="0 0 20 20" width="16" height="16" aria-hidden>
                  <path
                    fill="currentColor"
                    d="M3 10a1 1 0 0 1 1-1h9.586L10.293 5.707A1 1 0 0 1 11.707 4.293l5 5a1 1 0 0 1 0 1.414l-5 5A1 1 0 0 1 10.293 14.293L13.586 11H4a1 1 0 0 1-1-1z"
                  />
                </svg>
              </>
            )}
          </button>
        </form>

        <div className="fx-login-footer">
          Fox Turizm &copy; {new Date().getFullYear()}
        </div>
      </div>

      <style jsx>{`
        .fx-login-root {
          position: fixed;
          inset: 0;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: "Inter", system-ui, -apple-system, sans-serif;
          overflow: hidden;
          background: #060a10;
        }
        .fx-login-backdrop {
          position: absolute;
          inset: 0;
          background:
            radial-gradient(1200px 700px at 50% -10%, rgba(99, 155, 255, 0.16), transparent 60%),
            radial-gradient(900px 600px at 10% 110%, rgba(167, 139, 250, 0.14), transparent 60%),
            #060a10;
          animation: bg-pulse 8s ease-in-out infinite alternate;
        }
        @keyframes bg-pulse {
          0% { filter: brightness(0.85); }
          100% { filter: brightness(1.15); }
        }

        .fx-login-bg-shapes { position: absolute; inset: 0; pointer-events: none; }
        .shape {
          position: absolute;
          border-radius: 50%;
          filter: blur(60px);
          opacity: 0.55;
        }
        .shape-1 {
          width: 340px;
          height: 340px;
          background: radial-gradient(circle, #639bff, transparent 70%);
          top: -80px;
          left: -60px;
          animation: float1 14s ease-in-out infinite;
        }
        .shape-2 {
          width: 300px;
          height: 300px;
          background: radial-gradient(circle, #a78bfa, transparent 70%);
          bottom: -80px;
          right: -40px;
          animation: float2 16s ease-in-out infinite;
        }
        .shape-3 {
          width: 220px;
          height: 220px;
          background: radial-gradient(circle, #38bdf8, transparent 70%);
          top: 45%;
          left: 60%;
          animation: float3 18s ease-in-out infinite;
        }
        @keyframes float1 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(60px, 40px) scale(1.08); }
        }
        @keyframes float2 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-40px, -30px) scale(1.05); }
        }
        @keyframes float3 {
          0%, 100% { transform: translate(0, 0) scale(1); }
          50% { transform: translate(-70px, 30px) scale(1.12); }
        }

        .fx-login-card {
          position: relative;
          z-index: 2;
          width: min(92vw, 360px);
          padding: 30px 28px 24px;
          background: rgba(15, 23, 36, 0.72);
          backdrop-filter: blur(20px) saturate(140%);
          -webkit-backdrop-filter: blur(20px) saturate(140%);
          border: 1px solid rgba(99, 155, 255, 0.22);
          border-radius: 22px;
          box-shadow:
            0 30px 80px -20px rgba(0, 0, 0, 0.7),
            0 0 0 1px rgba(255, 255, 255, 0.03) inset,
            0 0 60px -20px rgba(99, 155, 255, 0.3);
          color: #eaf0f8;
          text-align: center;
          transform: translateY(20px) scale(0.96);
          opacity: 0;
          animation: card-in 0.55s cubic-bezier(0.2, 0.9, 0.25, 1.05) 0.1s forwards;
        }
        @keyframes card-in {
          to { transform: translateY(0) scale(1); opacity: 1; }
        }
        .fx-login-card.shake {
          animation: card-in 0.55s cubic-bezier(0.2, 0.9, 0.25, 1.05) 0.1s forwards,
            shake 0.45s cubic-bezier(.36,.07,.19,.97);
        }
        @keyframes shake {
          10%, 90% { transform: translateX(-2px); }
          20%, 80% { transform: translateX(4px); }
          30%, 50%, 70% { transform: translateX(-8px); }
          40%, 60% { transform: translateX(8px); }
        }

        .fx-login-logo {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          width: 66px;
          height: 66px;
          margin-bottom: 14px;
          border-radius: 18px;
          background: linear-gradient(135deg, rgba(99, 155, 255, 0.14), rgba(167, 139, 250, 0.14));
          border: 1px solid rgba(99, 155, 255, 0.25);
          box-shadow: 0 8px 30px -10px rgba(99, 155, 255, 0.4);
          animation: pulse-glow 3s ease-in-out infinite;
        }
        @keyframes pulse-glow {
          0%, 100% { box-shadow: 0 8px 30px -10px rgba(99, 155, 255, 0.4); }
          50% { box-shadow: 0 8px 40px -8px rgba(167, 139, 250, 0.55); }
        }
        .fx-login-title {
          font-size: 20px;
          font-weight: 700;
          margin: 0 0 4px;
          background: linear-gradient(135deg, #639bff, #a78bfa);
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: 0.01em;
        }
        .fx-login-title span {
          -webkit-text-fill-color: rgba(122, 139, 164, 0.85);
          font-weight: 500;
          font-size: 13px;
          display: block;
        }
        .fx-login-sub {
          margin: 0 0 22px;
          font-size: 12.5px;
          color: rgba(122, 139, 164, 0.9);
        }

        .fx-login-form { display: flex; flex-direction: column; gap: 12px; }
        .fx-sr-only {
          position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
          overflow: hidden; clip: rect(0,0,0,0); border: 0;
        }
        .fx-login-field input {
          width: 100%;
          padding: 13px 16px;
          border: 1px solid rgba(56, 78, 112, 0.55);
          border-radius: 12px;
          background: rgba(6, 10, 16, 0.6);
          color: #eaf0f8;
          font-family: inherit;
          font-size: 20px;
          letter-spacing: 0.4em;
          text-align: center;
          font-weight: 600;
          transition: all 0.2s;
        }
        .fx-login-field input::placeholder {
          color: rgba(122, 139, 164, 0.35);
          letter-spacing: 0.4em;
        }
        .fx-login-field input:focus {
          outline: none;
          border-color: rgba(99, 155, 255, 0.7);
          box-shadow: 0 0 0 4px rgba(99, 155, 255, 0.12);
          background: rgba(6, 10, 16, 0.78);
        }
        .fx-login-error {
          color: #ff6b6b;
          font-size: 12.5px;
          background: rgba(255, 107, 107, 0.08);
          border: 1px solid rgba(255, 107, 107, 0.25);
          padding: 8px 12px;
          border-radius: 10px;
          text-align: left;
          animation: fade-in 0.3s ease-out;
        }
        @keyframes fade-in { from { opacity: 0; transform: translateY(-4px); } to { opacity: 1; transform: none; } }

        .fx-login-btn {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          margin-top: 4px;
          padding: 12px 20px;
          border: none;
          border-radius: 12px;
          background: linear-gradient(135deg, #639bff, #a78bfa);
          color: #fff;
          font-family: inherit;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.25s;
          box-shadow: 0 6px 20px -6px rgba(99, 155, 255, 0.55);
        }
        .fx-login-btn:hover:not(:disabled) {
          transform: translateY(-1px);
          box-shadow: 0 10px 30px -6px rgba(99, 155, 255, 0.7);
        }
        .fx-login-btn:disabled { opacity: 0.55; cursor: not-allowed; }
        .fx-spinner {
          width: 16px;
          height: 16px;
          border: 2px solid rgba(255, 255, 255, 0.35);
          border-top-color: #fff;
          border-radius: 50%;
          animation: spin 0.7s linear infinite;
        }
        @keyframes spin { to { transform: rotate(360deg); } }

        .fx-login-footer {
          margin-top: 18px;
          font-size: 10.5px;
          color: rgba(122, 139, 164, 0.5);
          letter-spacing: 0.03em;
        }
      `}</style>
    </div>
  );
}
