"""Localhost / Vercel: müşteri kaydı (otomatik ID) ve eklenti için JSON API."""

from __future__ import annotations

import asyncio
import json
import os
import threading
from pathlib import Path

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse, JSONResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel, Field

try:
    from automation import load_config, run_fill
except ImportError:
    load_config = lambda: {}
    run_fill = None

app = FastAPI(title="Kosmos müşteri + form")
BASE = Path(__file__).resolve().parent

IS_VERCEL = bool(os.environ.get("VERCEL"))
if IS_VERCEL:
    DATA_FILE = Path("/tmp/customers.json")
else:
    DATA_FILE = BASE / "data" / "customers.json"

_db_lock = threading.Lock()
_executor = None


def _executor_pool():
    global _executor
    if _executor is None:
        from concurrent.futures import ThreadPoolExecutor
        _executor = ThreadPoolExecutor(max_workers=1)
    return _executor


class MusteriInput(BaseModel):
    ad: str = Field(..., min_length=1)
    soyad: str = Field(..., min_length=1)
    tc: str = Field(..., min_length=11, max_length=11)
    dogum_tarihi: str = Field(..., description="GG.AA.YYYY veya YYYY-MM-DD")
    telefon: str = Field(default="", max_length=40)


def _load_db() -> dict:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    if not DATA_FILE.exists():
        return {"next_id": 1, "by_id": {}}
    try:
        return json.loads(DATA_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {"next_id": 1, "by_id": {}}


def _save_db(db: dict) -> None:
    DATA_FILE.parent.mkdir(parents=True, exist_ok=True)
    DATA_FILE.write_text(json.dumps(db, ensure_ascii=False, indent=2), encoding="utf-8")


def _find_by_tc(tc: str, exclude_id: int | None = None) -> dict | None:
    """TC numarasına göre müşteri bul (opsiyonel: belirli ID hariç)."""
    with _db_lock:
        db = _load_db()
        for row in db["by_id"].values():
            if row["tc"] == tc and (exclude_id is None or row["id"] != exclude_id):
                return dict(row)
    return None


def _create_musteri(fields: dict) -> dict:
    with _db_lock:
        db = _load_db()
        cid = int(db["next_id"])
        row = {
            "id": cid,
            "ad": fields["ad"],
            "soyad": fields["soyad"],
            "tc": fields["tc"],
            "dogum_tarihi": fields["dogum_tarihi"],
            "telefon": (fields.get("telefon") or "").strip(),
        }
        db["by_id"][str(cid)] = row
        db["next_id"] = cid + 1
        _save_db(db)
        return row


def _get_musteri(cid: int) -> dict | None:
    with _db_lock:
        db = _load_db()
        row = db["by_id"].get(str(cid))
        return dict(row) if row else None


def _update_musteri(cid: int, fields: dict) -> dict | None:
    with _db_lock:
        db = _load_db()
        key = str(cid)
        if key not in db["by_id"]:
            return None
        row = db["by_id"][key]
        row["ad"] = fields["ad"]
        row["soyad"] = fields["soyad"]
        row["tc"] = fields["tc"]
        row["dogum_tarihi"] = fields["dogum_tarihi"]
        row["telefon"] = (fields.get("telefon") or "").strip()
        _save_db(db)
        return dict(row)


def _delete_musteri(cid: int) -> bool:
    with _db_lock:
        db = _load_db()
        key = str(cid)
        if key not in db["by_id"]:
            return False
        del db["by_id"][key]
        _save_db(db)
        return True


app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


def _read_index_html() -> str:
    return (BASE / "templates" / "index.html").read_text(encoding="utf-8")


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return _read_index_html()


@app.post("/api/musteri")
async def api_musteri_olustur(body: MusteriInput):
    tc = body.tc.strip()
    existing = _find_by_tc(tc)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Bu TC ({tc}) zaten #{existing['id']} numaralı müşteride kayıtlı: {existing['ad']} {existing['soyad']}",
        )
    row = _create_musteri(
        {
            "ad": body.ad.strip(),
            "soyad": body.soyad.strip(),
            "tc": tc,
            "dogum_tarihi": body.dogum_tarihi.strip(),
            "telefon": body.telefon.strip(),
        }
    )
    return JSONResponse(row)


@app.get("/api/musteri/{musteri_id:int}")
async def api_musteri_get(musteri_id: int):
    row = _get_musteri(musteri_id)
    if not row:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    return row


@app.put("/api/musteri/{musteri_id:int}")
async def api_musteri_update(musteri_id: int, body: MusteriInput):
    tc = body.tc.strip()
    existing = _find_by_tc(tc, exclude_id=musteri_id)
    if existing:
        raise HTTPException(
            status_code=409,
            detail=f"Bu TC ({tc}) zaten #{existing['id']} numaralı müşteride kayıtlı: {existing['ad']} {existing['soyad']}",
        )
    row = _update_musteri(
        musteri_id,
        {
            "ad": body.ad.strip(),
            "soyad": body.soyad.strip(),
            "tc": tc,
            "dogum_tarihi": body.dogum_tarihi.strip(),
            "telefon": body.telefon.strip(),
        },
    )
    if not row:
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    return JSONResponse(row)


@app.delete("/api/musteri/{musteri_id:int}")
async def api_musteri_delete(musteri_id: int):
    if not _delete_musteri(musteri_id):
        raise HTTPException(status_code=404, detail="Müşteri bulunamadı")
    return {"ok": True, "id": musteri_id}


@app.get("/api/musteri")
async def api_musteri_list(q: str = Query(default="", max_length=100)):
    with _db_lock:
        db = _load_db()
        rows = sorted(db["by_id"].values(), key=lambda x: int(x["id"]))
    if q.strip():
        needle = q.strip().lower()
        rows = [
            r for r in rows
            if needle in r["ad"].lower()
            or needle in r["soyad"].lower()
            or needle in (r["ad"] + " " + r["soyad"]).lower()
            or needle in r["tc"]
        ]
    return {"musteriler": rows}


@app.post("/api/doldur")
async def api_doldur(body: MusteriInput):
    if run_fill is None:
        raise HTTPException(status_code=501, detail="Otomasyon bu ortamda kullanılamaz.")
    data = {
        "ad": body.ad.strip(),
        "soyad": body.soyad.strip(),
        "tc": body.tc.strip(),
        "dogum_tarihi": body.dogum_tarihi.strip(),
        "telefon": body.telefon.strip(),
    }
    loop = asyncio.get_event_loop()
    try:
        msg = await loop.run_in_executor(_executor_pool(), lambda: run_fill(data))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e)) from e
    return JSONResponse({"ok": True, "message": msg})


@app.get("/api/config-ozet")
async def config_ozet():
    cfg = load_config()
    return {
        "form_url": cfg.get("form_url"),
        "browser": cfg.get("browser"),
        "static_field_sayisi": len(cfg.get("static_fields") or []),
    }
