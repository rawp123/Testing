# Testing

This is a small starter site used for demonstrations and learning.

## Yelp integration (server-side proxy)

This project includes a lightweight Express proxy that forwards requests to the Yelp Fusion API so your API key stays secret.

- Server entry: `server.js`
- Environment variable required: `YELP_API_KEY`

Quick start (local):

1. Install dependencies: `npm install`
2. Add your Yelp key (do NOT commit):
   - Copy `.env.example` to `.env` and set `YELP_API_KEY`, or export the variable directly.
3. Run the server: `YELP_API_KEY="<your-key>" npm start`
4. Open the site at `http://localhost:3000` and use the `Yelp search` section to try a query.

How to get a Yelp API key:
1. Go to https://www.yelp.com/developers/v3/manage_app and create a new app.
2. Copy the provided API Key and set it in your environment as `YELP_API_KEY`.

Security note: the proxy keeps the key on the server — never put the Yelp API key directly in client-side code.
