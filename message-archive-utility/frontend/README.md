# Frontend

React frontend for the local-first message archive utility.

The app browses conversations from the local backend, supports search, includes the local iPhone backup import flow, and has a separate Tutorial Workspace with static sandbox sample messages. Tutorial sample messages stay in browser state and are not imported into the real archive database. The development server proxies `/api` requests to the FastAPI backend on port `8000`.

## Run

From the `message-archive-utility` product folder, you can start the frontend and backend together:

```bash
npm run dev
```

To run only the frontend:

```bash
npm install
npm run dev
```
