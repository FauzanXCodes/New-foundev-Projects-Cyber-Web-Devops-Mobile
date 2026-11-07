from iocx_registry_keys.plugin import Plugin

def run(text):
    plugin = Plugin()
    return plugin.detect(text, ctx=None)

def test_registry_key_basic():
    results = run("HKCU\\Software\\Test")
    assert any(r.category == "registry.keys" for r in results["registry.keys"])

def test_registry_value_detection():
    results = run("Type is REG_DWORD")
    assert any(r.category == "registry.values" for r in results["registry.values"])

def test_persistence_key_detection():
    results = run("HKLM\\Software\\Microsoft\\Windows\\CurrentVersion\\Run")
    assert any(r.category == "registry.persistence" for r in results["registry.persistence"])
