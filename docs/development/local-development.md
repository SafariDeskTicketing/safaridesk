# Local Development

Frontend:

```bash
cd frontend
npm ci
npm run dev
```

Backend services for local development can be started with Compose from the repo root:

```bash
cp .env.example .env
docker compose up -d db redis
cd backend
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 0.0.0.0:8100
```

For the full containerized stack:

```bash
docker compose up -d --build
```
