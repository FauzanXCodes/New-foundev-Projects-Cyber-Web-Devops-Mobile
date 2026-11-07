
# 🔐 Log Analysis API & Dashboard

A full-stack, containerized security tool that parses Linux system logs, detects suspicious events, and displays results on a live web dashboard.

## Why I built this

Log analysis is a core task in security operations. I wanted to build something that mirrors a real workflow — ingesting raw auth logs, applying detection rules, exposing the results via an API, and visualizing them in a dashboard. This project connects my interest in cybersecurity with backend development and containerization.

## What it does

- Parses Linux `auth.log` files and extracts structured log entries
- Detects suspicious patterns: failed login attempts, brute-force behavior, path traversal
- Exposes findings through a REST API (`/api/logs` and `/api/alerts`)
- Displays results on a JavaScript dashboard that fetches live from the API
- Fully containerized with Docker for consistent deployment

## 🛠️ Tech Stack

| Layer | Technology | What it does |
|---|---|---|
| **Backend** | Python, OOP, Regex | Log parsing, multi-rule detection engine, modular design |
| **API** | Flask, REST, CORS | Two GET endpoints serving structured JSON |
| **Frontend** | HTML, CSS, JavaScript | Async data fetching, dynamic table rendering |
| **DevOps** | Docker | Containerized deployment, port mapping, cross-platform stability |

## 📐 Project Structure

```
log-analysis-api/
├── api/
│   ├── app.py              # Flask entry point
│   ├── detection/          # Alert rules (failed login, path traversal)
│   └── parser/             # Raw log → structured data
├── frontend/
│   └── index.html          # Dashboard (fetches from API)
├── logs/
│   └── auth.log            # Sample Linux auth log
├── Dockerfile
└── requirements.txt
```

## 🚀 How to Run

**Option 1 — Docker (recommended)**

```bash
# Build the image
docker build -t log-analysis-api .

# Run the container
docker run -d -p 8080:5000 --name log-analyzer log-analysis-api
```

Then open `frontend/index.html` in your browser. The dashboard fetches from `http://localhost:8080/api/alerts`.

**Option 2 — Local (Python)**

```bash
pip install -r requirements.txt
python main.py
```

## API Endpoints

| Method | Endpoint | Returns |
|---|---|---|
| GET | `/api/logs` | All parsed log entries |
| GET | `/api/alerts` | Detected suspicious events only |

## What I learned

- How to design a modular Python backend with separation between parsing and detection logic
- RESTful API design with Flask and CORS handling
- Containerizing a multi-component app with Docker
- How real security tools structure log ingestion pipelines
