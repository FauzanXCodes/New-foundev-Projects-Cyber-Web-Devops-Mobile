from iocx.plugins.api import IOCXPlugin
from iocx.plugins.metadata import PluginMetadata
from iocx.models import Detection, PluginContext

PERSISTENCE_KEYWORD = "\\run"

SUSPICIOUS_SUBSTRINGS = [
    "powershell",
    "cmd.exe",
    "wscript",
    "cscript",
    "temp",
    "appdata",
    "roaming",
]


class Plugin(IOCXPlugin):
    metadata = PluginMetadata(
        id="registry-keys-scoring",
        name="Registry Keys Scoring Enricher",
        version="1.0.0",
        description="Assigns a suspicion score to registry key detections.",
        author="MalX Labs",
        capabilities=["enricher"],
        iocx_min_version="0.4.0",
    )

    def enrich(self, text: str, ctx: PluginContext) -> None:
        """
        Assigns a score to each registry key detection.
        Score is stored in det.metadata["score"].
        """
        detections_map = ctx.detections
        if not detections_map:
            return

        # Normalize metadata for all detections
        for det_list in detections_map.values():
            for det in det_list:
                det.metadata = det.metadata or {}

        # Score only registry key detections
        reg_detections = detections_map.get("registry.keys")
        if not reg_detections:
            return

        for det in reg_detections:
            key = det.value.lower()
            score = 0
            reasons = []
            flags = {
                "persistence": False,
                "suspicious_substrings": []
            }

            # Persistence scoring
            if PERSISTENCE_KEYWORD in key:
                score += 50
                flags["persistence"] = True
                reasons.append("Registry path contains persistence location: HKCU/HKLM Run key")

            # Suspicious substrings
            for s in SUSPICIOUS_SUBSTRINGS:
                if s in key:
                    score += 10
                    flags["suspicious_substrings"].append(s)
                    reasons.append(f"Matched suspicious substring: '{s}'")

            # Very long keys
            if len(key) > 200:
                score += 5
                reasons.append("Registry key path is unusually long (>200 characters)")

            # Store in detection metadata
            det.metadata["score"] = score
            det.metadata["reasons"] = reasons
            det.metadata["flags"] = flags

            # Store in context enrichment
            ctx.metadata.setdefault("registry.keys", []).append({
                "value": det.value,
                "score": score,
                "reasons": reasons,
                "flags": flags
            })

            if ctx.logger:
                ctx.logger.debug(
                    f"[registry-keys-scoring] Scored {det.value!r} = {score}"
                )


