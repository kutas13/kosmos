"""Kosmos başvuru formu — Playwright ile doldurma."""

from __future__ import annotations

import re
import time
from pathlib import Path
from typing import Any

import yaml
from playwright.sync_api import Page, sync_playwright

CONFIG_PATH = Path(__file__).resolve().parent / "config.yaml"


def load_config() -> dict[str, Any]:
    with CONFIG_PATH.open(encoding="utf-8") as f:
        return yaml.safe_load(f)


def _locator(page: Page, spec: dict[str, Any]):
    strategy = spec.get("strategy", "label")
    if strategy == "label":
        return page.get_by_label(re.compile(spec["text"], re.I))
    if strategy == "placeholder":
        return page.get_by_placeholder(re.compile(spec["text"], re.I))
    if strategy == "css":
        return page.locator(spec["selector"]).first
    raise ValueError(f"Bilinmeyen strategy: {strategy}")


def fill_dynamic(page: Page, cfg: dict[str, Any], data: dict[str, str]) -> None:
    dyn = cfg.get("dynamic") or {}
    mapping = {
        "ad": data.get("ad", ""),
        "soyad": data.get("soyad", ""),
        "tc": data.get("tc", ""),
        "dogum_tarihi": data.get("dogum_tarihi", ""),
        "telefon": data.get("telefon", ""),
    }
    for key, value in mapping.items():
        if key not in dyn:
            continue
        loc = _locator(page, dyn[key])
        loc.first.wait_for(state="visible", timeout=30_000)
        loc.first.fill(value, timeout=15_000)


def apply_static_fields(page: Page, items: list[dict[str, Any]]) -> None:
    for item in items:
        t = item.get("type", "fill")
        label = item.get("label")
        value = item.get("value", "")
        if not label:
            continue
        target = page.get_by_label(re.compile(label, re.I)).first
        target.wait_for(state="visible", timeout=20_000)
        if t == "fill":
            target.fill(str(value), timeout=15_000)
        elif t == "select":
            target.select_option(label=str(value), timeout=15_000)
        else:
            raise ValueError(f"Bilinmeyen static type: {t}")


def _wait_page_ready(page: Page, timeout_ms: int = 90_000) -> None:
    try:
        page.wait_for_load_state("networkidle", timeout=timeout_ms)
    except Exception:
        page.wait_for_load_state("load", timeout=min(timeout_ms, 30_000))


def run_fill(data: dict[str, str], config: dict[str, Any] | None = None) -> str:
    cfg = config or load_config()
    url = cfg.get("form_url", "https://basvuru.kosmosvize.com.tr/registerform")
    bcfg = cfg.get("browser") or {}
    headless = bool(bcfg.get("headless", False))
    slow_mo = int(bcfg.get("slow_mo_ms", 0))
    keep_open = int(bcfg.get("keep_open_sec", 120))

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=headless, slow_mo=slow_mo)
        context = browser.new_context(
            locale="tr-TR",
            viewport={"width": 1280, "height": 900},
        )
        page = context.new_page()
        page.goto(url, wait_until="domcontentloaded", timeout=60_000)
        _wait_page_ready(page)

        fill_dynamic(page, cfg, data)
        static = cfg.get("static_fields") or []
        if static:
            apply_static_fields(page, static)

        if keep_open > 0:
            time.sleep(keep_open)

        browser.close()

    return (
        "Alanlar dolduruldu. Tarayıcı "
        + (f"{keep_open} sn açık kaldı; " if keep_open else "")
        + "Gönder’i kendiniz kullanın."
    )
