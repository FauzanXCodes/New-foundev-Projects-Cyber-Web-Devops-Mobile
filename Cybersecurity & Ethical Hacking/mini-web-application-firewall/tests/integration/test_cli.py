"""Integration tests for MiniWAF Typer CLI commands."""

from typer.testing import CliRunner

from miniwaf import __version__
from miniwaf.cli.main import app

runner = CliRunner()


def test_cli_version() -> None:
    result = runner.invoke(app, ["version"])
    assert result.exit_code == 0
    assert __version__ in result.stdout


def test_cli_rules_list() -> None:
    result = runner.invoke(app, ["rules"], env={"COLUMNS": "160"})
    assert result.exit_code == 0
    assert "MiniWAF Registered Inspection Rules" in result.stdout
    assert "RULE-SQLI-001" in result.stdout


def test_cli_rules_filter_category() -> None:
    result = runner.invoke(app, ["rules", "--category", "SQLI"], env={"COLUMNS": "160"})
    assert result.exit_code == 0
    assert "RULE-SQLI-001" in result.stdout
    assert "RULE-XSS-001" not in result.stdout


def test_cli_test_benign_url() -> None:
    result = runner.invoke(app, ["test", "--url", "http://example.com/api/v1/users?page=1"])
    assert result.exit_code == 0
    assert "WAF DECISION: ALLOW" in result.stdout


def test_cli_test_attack_payload() -> None:
    result = runner.invoke(
        app,
        [
            "test",
            "--url",
            "http://example.com/search?q=1%20UNION%20SELECT%20username%20FROM%20users",
        ],
    )
    assert result.exit_code == 0
    assert "WAF DECISION: BLOCK" in result.stdout
    assert "RULE-SQLI-001" in result.stdout


def test_cli_test_body_xss() -> None:
    result = runner.invoke(
        app,
        [
            "test",
            "--url",
            "/api/comment",
            "--method",
            "POST",
            "--body",
            "<script>alert(1)</script>",
        ],
    )
    assert result.exit_code == 0
    assert "WAF DECISION: BLOCK" in result.stdout
    assert "RULE-XSS-001" in result.stdout


def test_cli_unjail_ip() -> None:
    result = runner.invoke(app, ["unjail", "192.168.1.55"])
    assert result.exit_code == 0
    assert "Successfully released IP 192.168.1.55 from jail" in result.stdout
