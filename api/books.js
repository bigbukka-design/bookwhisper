export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();
  const { title, author } = req.query;
  if (!title) return res.status(400).json({ error: 'Missing title' });
  try {
    const q = encodeURIComponent(`${title} ${author || ''}`);
    const r = await fetch(`https://www.googleapis.com/books/v1/volumes?q=${q}&maxResults=1`);
    const d = await r.json();
    const info = d.items?.[0]?.volumeInfo;
    const cover = info?.imageLinks?.thumbnail?.replace('http:', 'https:') || null;
    res.status(200).json({ cover });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
}
