"""Integration tests for MiniWAF REST API endpoints."""

from fastapi.testclient import TestClient

from miniwaf.api.app import app

client = TestClient(app)


def test_api_health() -> None:
    resp = client.get("/health")
    assert resp.status_code == 200
    data = resp.json()
    assert data["status"] == "healthy"
    assert "version" in data


def test_api_inspect_benign() -> None:
    payload = {
        "method": "GET",
        "path": "/products",
        "client_ip": "10.0.0.1",
        "query_string": "page=2&sort=name",
    }
    resp = client.post("/api/v1/inspect", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "ALLOW"
    assert data["is_blocked"] is False
    assert data["total_score"] == 0


def test_api_inspect_attack() -> None:
    payload = {
        "method": "POST",
        "path": "/login",
        "client_ip": "10.0.0.2",
        "body": "username=admin' OR '1'='1'--&password=123",
    }
    resp = client.post("/api/v1/inspect", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert data["action"] == "BLOCK"
    assert data["is_blocked"] is True
    assert data["total_score"] >= 5


def test_api_list_rules() -> None:
    resp = client.get("/api/v1/rules")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rules"] >= 18
    rule_ids = [r["rule_id"] for r in data["rules"]]
    assert "RULE-SQLI-001" in rule_ids
    assert "RULE-XSS-001" in rule_ids


def test_api_stats() -> None:
    resp = client.get("/api/v1/stats")
    assert resp.status_code == 200
    data = resp.json()
    assert data["total_rules"] >= 18
    assert data["mode"] in ("BLOCK", "MONITOR")
    assert data["anomaly_threshold"] == 5


def test_api_jailed_and_unjail() -> None:
    resp_list = client.get("/api/v1/jailed")
    assert resp_list.status_code == 200
    assert isinstance(resp_list.json(), dict)

    resp_unjail = client.post("/api/v1/unjail", json={"client_ip": "10.0.0.99"})
    assert resp_unjail.status_code == 200
    assert resp_unjail.json()["status"] == "success"
