# Dockerfile

# 1. Base Image: Use a lean Python image
FROM python:3.11-slim

# 2. Set Working Directory
WORKDIR /app

# 3. Copy Requirements and Install Dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# 4. Copy Application Code: This copies 'api/', which contains detection/ and parser/
COPY api/ api/

# 5. Copy logs and frontend (these are in the project root)
COPY logs/ logs/
COPY frontend/ frontend/

# 6. Expose Port: The port Flask runs on
EXPOSE 5000

# 7. Define Startup Command: Run the Flask application as a Python module
CMD ["python", "-m", "api.app"]