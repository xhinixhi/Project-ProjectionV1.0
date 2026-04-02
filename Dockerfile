# Use an official Python runtime as a parent image
FROM python:3.13-slim

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV FLASK_APP=run.py

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    sqlite3 \
    && rm -rf /var/lib/apt/lists/*

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy the rest of the application code
COPY . .

# Ensure upload directories exist
RUN mkdir -p app/static/uploads/presentations && chmod -R 777 app/static/uploads

# Expose the port the app runs on
EXPOSE 5002

# Run the application
# Using socketio.run in run.py which typically uses eventlet/gevent if installed
CMD ["python", "run.py"]
