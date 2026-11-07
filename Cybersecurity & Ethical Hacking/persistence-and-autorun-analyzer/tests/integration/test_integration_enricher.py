from iocx.engine import Engine

def test_registry_key_scoring_enricher_integration():
    text = "HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\powershell.exe"

    engine = Engine()
    result = engine.extract(text)

    # --- 1. Detector produced registry.keys ---
    assert "registry.keys" in result["iocs"]
    keys = result["iocs"]["registry.keys"]
    assert len(keys) == 1

    # --- 2. Enrichment lives in plugin_context.metadata ---
    ctx = engine.plugin_context
    assert "registry.keys" in ctx.metadata

    # ctx.metadata["registry.keys"] is a list of lists
    enriched = ctx.metadata["registry.keys"]
    assert len(enriched) == 1

    entry = enriched[0]

    # --- 3. Validate enrichment fields ---
    assert entry["value"] == keys[0]
    assert isinstance(entry["score"], int)
    assert entry["score"] > 0

    # --- 4. Validate flags and reasons ---
    assert entry["flags"]["persistence"] is True
    assert "powershell" in entry["flags"]["suspicious_substrings"]
    assert any("persistence" in r.lower() for r in entry["reasons"])
    assert any("powershell" in r.lower() for r in entry["reasons"])


def test_registry_key_scoring_long_key():
    # Create a registry key > 200 characters
    long_tail = "A" * 210
    long_key = f"HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run\\{long_tail}"

    engine = Engine()
    result = engine.extract(long_key)

    # --- 1. Detector produced registry.keys ---
    assert "registry.keys" in result["iocs"]
    keys = result["iocs"]["registry.keys"]
    assert len(keys) == 1

    # --- 2. Enrichment lives in plugin_context.metadata ---
    ctx = engine.plugin_context
    assert "registry.keys" in ctx.metadata

    # ctx.metadata["registry.keys"] is a list of lists
    enriched = ctx.metadata["registry.keys"]
    assert len(enriched) == 1

    entry = enriched[0]

    # --- 3. Validate enrichment fields ---
    assert entry["value"] == keys[0]
    assert isinstance(entry["score"], int)
    assert entry["score"] >= 5
    assert any("unusually long" in r.lower() for r in entry["reasons"])
