from iocx.engine import Engine

def test_registry_plugin_integration():
    text = """
    HKCU\\Software\\Microsoft\\Windows\\CurrentVersion\\Run
    REG_DWORD
    """.strip()

    engine = Engine()
    result = engine.extract(text)

    # Persistence
    assert "registry.persistence" in result["iocs"]

    # This input should match on both REGISTRY KEY and PERSISTENCE patterns
    # Given persistence takes precedence, Keys should be omitted
    assert "registry.keys" not in result["iocs"]

    # Values
    assert "registry.values" in result["iocs"]
    assert "reg_dword" in [v.lower() for v in result["iocs"]["registry.values"]]


