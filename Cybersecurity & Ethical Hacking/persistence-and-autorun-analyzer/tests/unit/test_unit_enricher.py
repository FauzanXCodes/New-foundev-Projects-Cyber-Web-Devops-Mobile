import pytest
from iocx.models import Detection, PluginContext
from iocx_registry_keys.enricher import Plugin as RegistryKeyEnricher


@pytest.fixture
def ctx(tmp_path):
    """Create a minimal PluginContext for testing."""
    return PluginContext(
        file_path=None,
        raw_text="dummy text",
        logger=None,
        config={},
        detections={}
    )


def test_enricher_does_not_crash_on_empty(ctx):
    """Enricher should safely handle empty detection sets."""
    enricher = RegistryKeyEnricher()
    ctx.detections = {}

    enricher.enrich("dummy text", ctx)

    assert ctx.detections == {}, "Enricher should not modify empty detection sets"


def test_enricher_ignores_other_categories(ctx):
    """Enricher should ignore non-registry-key categories."""
    enricher = RegistryKeyEnricher()
    ctx.detections = {
        "urls": [Detection("http://example.com", 0, 10, "urls")]
    }

    enricher.enrich("dummy text", ctx)

    # Should not add metadata to unrelated categories
    assert "score" not in ctx.detections["urls"][0].metadata


def test_enricher_scores_registry_keys(ctx):
    """Enricher should assign a score to registry key detections."""
    enricher = RegistryKeyEnricher()
    det = Detection(
        value=r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run\BadApp",
        start=0,
        end=10,
        category="registry.keys"
    )

    ctx.detections = {"registry.keys": [det]}

    enricher.enrich("dummy text", ctx)

    assert "score" in det.metadata, "Enricher must add a score"
    assert isinstance(det.metadata["score"], int), "Score must be an integer"
    assert det.metadata["score"] > 0, "Score should be positive for suspicious keys"


def test_enricher_detects_suspicious_substrings(ctx):
    """Enricher should increase score when suspicious substrings are present."""
    enricher = RegistryKeyEnricher()
    det = Detection(
        value=r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run\powershell.exe",
        start=0,
        end=10,
        category="registry.keys"
    )

    ctx.detections = {"registry.keys": [det]}

    enricher.enrich("dummy text", ctx)

    score = det.metadata.get("score", 0)
    assert score >= 60, "Expected base score + suspicious substring score"


def test_enricher_does_not_modify_detection_value(ctx):
    """Enricher must not change the detection value itself."""
    enricher = RegistryKeyEnricher()
    original_value = r"HKCU\Software\Microsoft\Windows\CurrentVersion\Run\BadApp"

    det = Detection(
        value=original_value,
        start=0,
        end=10,
        category="registry.keys"
    )

    ctx.detections = {"registry.keys": [det]}

    enricher.enrich("dummy text", ctx)

    assert det.value == original_value, "Enricher must not mutate detection value"
