def generate_kubernetes_yaml(query):

    return """
apiVersion: apps/v1
kind: Deployment

metadata:
  name: ai-app

spec:
  replicas: 2

  selector:
    matchLabels:
      app: ai-app

  template:
    metadata:
      labels:
        app: ai-app

    spec:
      containers:
      - name: ai-app
        image: ai-app:latest

        ports:
        - containerPort: 8000
---
apiVersion: v1
kind: Service

metadata:
  name: ai-service

spec:
  selector:
    app: ai-app

  ports:
    - protocol: TCP
      port: 80
      targetPort: 8000

  type: LoadBalancer
"""