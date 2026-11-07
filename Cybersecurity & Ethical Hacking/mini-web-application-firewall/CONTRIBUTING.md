# Contributing to Mini Web Application Firewall (`mini-waf`)

Thank you for your interest in contributing to `mini-waf`!

## Development Guidelines

1. **Strict Type Safety**: All codebase additions must have 100% strict type annotations validated via `mypy`.
2. **Quality Gates**: Ensure code passes formatting and linting via `ruff` (`ruff check .` and `ruff format --check .`).
3. **Security Assurance**: All code must pass AST security inspection with `bandit`.
4. **Test Coverage**: Maintain at least 90% test coverage with `pytest --cov=miniwaf`.
5. **Deterministic Git Flow**: Commits must be clean, semantic, and well-described.
