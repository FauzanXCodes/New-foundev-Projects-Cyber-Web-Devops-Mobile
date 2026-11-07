# Deployment Notes

This project is designed to run as a static site.

## Recommended deployment

GitHub Pages is the simplest deployment target because the project does not need:

- a backend server
- a database
- server-side rendering
- environment variables
- build tooling

## GitHub Pages settings

Use these settings:

```text
Source: Deploy from a branch
Branch: main
Folder: /root
```

## Local preview

Use a static file server from the project root:

```bash
python -m http.server 8000
```

Then open:

```text
http://localhost:8000
```

## Validation before deploy

Run:

```bash
npm run validate
```

This checks JavaScript syntax and runs the Node test suite.
