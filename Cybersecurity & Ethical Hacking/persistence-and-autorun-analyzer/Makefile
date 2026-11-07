VENV := .venv
PYTHON := $(VENV)/bin/python
PIP := $(VENV)/bin/pip
PACKAGE := src/iocx_registry_keys

# Default target
.DEFAULT_GOAL := help

PERFORMANCE_DIR := tests/performance

# -----------------------------
# Virtual environment
# -----------------------------

$(VENV):
	python3 -m venv $(VENV)
	$(PIP) install --upgrade pip setuptools wheel

.PHONY: venv
venv: $(VENV)
	@echo "Virtual environment created in $(VENV)"

# -----------------------------
# Install plugin + dev deps
# -----------------------------

.PHONY: install
install: venv
	$(PIP) install -e .
	$(PIP) install pytest ruff black coverage pip-audit bandit

# -----------------------------
# Run tests
# -----------------------------

.PHONY: test
test: install
	$(VENV)/bin/pytest -q -m "not performance"

.PHONY: test-performance
test-performance: install
	@echo "Running performance tests..."
	$(VENV)/bin/pytest -m performance $(PERFORMANCE_DIR) -q -s

.PHONY: test-coverage
test-coverage: install
	$(PYTHON) -m coverage run -m pytest
	$(PYTHON) -m coverage report -m


# ----------------------------------------
# Static analysis and SCA
# ----------------------------------------

.PHONY: security
security: install
	@echo "Running pip-audit..."
	-$(VENV)/bin/pip-audit --skip-editable
	@echo "Running Bandit..."
	$(VENV)/bin/bandit -r $(PACKAGE) -lll


# ===========================
# Linting & Formatting
# ===========================

.PHONY: lint
lint: install
	$(VENV)/bin/ruff check $(PACKAGE)

.PHONY: format
format: install
	$(VENV)/bin/black $(PACKAGE)


# -----------------------------
# Clean build artifacts
# -----------------------------

.PHONY: clean
clean:
	rm -rf $(VENV)
	rm -rf build dist *.egg-info
	find . -name "__pycache__" -type d -exec rm -rf {} +

# -----------------------------
# Help
# -----------------------------

.PHONY: help
help:
	@echo ""
	@echo "Available make targets:"
	@echo " make venv - Create virtual environment"
	@echo " make install - Install plugin + dev dependencies"
	@echo " make test - Run unit + integration tests"
	@echo " make test-performance - Run performance tests"
	@echo " make test-coverage - Get coverage statistics across tests"
	@echo " make security - Perform static code analysis and SCA"
	@echo " make clean - Remove venv and build artifacts"
	@echo " make lint - Perform code linting"
	@echo " make format - Perform formatting across codebase"
	@echo ""
