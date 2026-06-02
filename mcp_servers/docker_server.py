def generate_dockerfile(query):

    return """
FROM python:3.11

WORKDIR /app

COPY . .

RUN pip install -r requirements.txt

EXPOSE 8000

CMD ["python", "main.py"]
"""