# Frontend

React frontend for the local-first message archive utility.

The app browses conversations from the local backend, supports search, can load the fake sample archive on demand, and includes the local iPhone backup import flow. The development server proxies `/api` requests to the FastAPI backend on port `8000`.

## Run

From the repository root, you can start the frontend and backend together:

```bash
npm run dev:message-archive
```

To run only the frontend:

```bash
npm install
npm run dev
```
