export const config = { api: { bodyParser: true } };

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed: ' + req.method });

  const books = req.body?.books;
  if (!books?.length) return res.status(200).json({ results: [] });

  const results = await Promise.all(books.map(async ({ title, author, desc }) => {
    try {
      const q = encodeURIComponent(title + ' ' + author);

      // Search Google Books
      const r = await fetch('https://www.googleapis.com/books/v1/volumes?q=' + q + '&maxResults=5');
      const d = await r.json();
      const items = d.items || [];

      const titleKey = title.toLowerCase().replace(/[^\w\u00e5\u00e4\u00f6]/g, '').substring(0, 8);
      const authorLast = author.toLowerCase().split(' ').pop();

      for (const item of items) {
        const info = item.volumeInfo || {};
        const ft = (info.title || '').toLowerCase().replace(/[^\w\u00e5\u00e4\u00f6]/g, '');
        const fa = (info.authors || []).join(' ').toLowerCase();

        if (ft.includes(titleKey) && fa.includes(authorLast)) {
          const links = info.imageLinks || {};
          const raw = links.large || links.medium || links.thumbnail || links.smallThumbnail || null;
          return {
            title, author, desc,
            verified: true,
            cover: raw ? raw.replace('http://', 'https://').replace('&edge=curl', '') : null
          };
        }
      }

      // Fallback — Open Library
      const olR = await fetch('https://openlibrary.org/search.json?q=' + q + '&limit=3&fields=cover_i,title,author_name');
      const olD = await olR.json();
      for (const doc of (olD.docs || [])) {
        if (doc.cover_i) {
          return {
            title, author, desc,
            verified: true,
            cover: 'https://covers.openlibrary.org/b/id/' + doc.cover_i + '-M.jpg'
          };
        }
      }

      return { title, author, desc, verified: false, cover: null };
    } catch (e) {
      return { title, author, desc, verified: true, cover: null };
    }
  }));

  res.status(200).json({ results });
}
