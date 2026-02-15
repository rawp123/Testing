/*
  server.js — tiny Express proxy for Yelp Fusion API
  - Keeps Yelp API key on the server (read from YELP_API_KEY env var)
  - Routes:
    GET /api/yelp/search?term=&latitude=&longitude=&location=&limit=
    GET /api/yelp/business/:id

  Usage:
    YELP_API_KEY=your_key node server.js
*/

const express = require('express');
const axios = require('axios');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;
const YELP_KEY = process.env.YELP_API_KEY;

if (!YELP_KEY) {
  console.warn('Warning: YELP_API_KEY is not set — /api/yelp endpoints will return 500.');
}

app.use(express.json());
// Serve static site so frontend can call /api on same origin when running locally
app.use(express.static(path.join(__dirname)));

// Proxy search to Yelp Fusion
app.get('/api/yelp/search', async (req, res) => {
  if (!YELP_KEY) return res.status(500).json({ error: 'Server missing YELP_API_KEY' });

  const { term = 'coffee', latitude, longitude, location = '', limit = 6 } = req.query;
  const params = { term, limit };
  if (latitude && longitude) {
    params.latitude = latitude;
    params.longitude = longitude;
  } else if (location) {
    params.location = location;
  } else {
    // fallback to a default location
    params.location = 'New York, NY';
  }

  try {
    const r = await axios.get('https://api.yelp.com/v3/businesses/search', {
      headers: { Authorization: `Bearer ${YELP_KEY}` },
      params
    });
    // return only what the frontend needs
    return res.json({ businesses: r.data.businesses || [], total: r.data.total || 0 });
  } catch (err) {
    console.error('Yelp search error', err?.response?.data || err.message);
    return res.status(err?.response?.status || 500).json({ error: 'Yelp search failed' });
  }
});

// Business details + reviews
app.get('/api/yelp/business/:id', async (req, res) => {
  if (!YELP_KEY) return res.status(500).json({ error: 'Server missing YELP_API_KEY' });
  const { id } = req.params;
  try {
    const [details, reviews] = await Promise.all([
      axios.get(`https://api.yelp.com/v3/businesses/${encodeURIComponent(id)}`, { headers: { Authorization: `Bearer ${YELP_KEY}` } }),
      axios.get(`https://api.yelp.com/v3/businesses/${encodeURIComponent(id)}/reviews`, { headers: { Authorization: `Bearer ${YELP_KEY}` } })
    ]);
    return res.json({ details: details.data, reviews: reviews.data.reviews || [] });
  } catch (err) {
    console.error('Yelp business error', err?.response?.data || err.message);
    return res.status(err?.response?.status || 500).json({ error: 'Yelp business fetch failed' });
  }
});

// Health
app.get('/api/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => console.log(`Dev server listening on http://localhost:${PORT} — set YELP_API_KEY to enable Yelp proxy`));
