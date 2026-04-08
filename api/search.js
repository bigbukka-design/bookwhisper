export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 's-maxage=3600');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const { q } = req.query;
  if (!q) return res.status(400).json({ books: [] });

  const books = [];

  try {
    // LIBRIS xsearch – Sveriges nationella bibliotekskatalog
    const librisUrl = 'https://libris.kb.se/xsearch?query='
      + encodeURIComponent(q)
      + '&format=json&n=6&order=rank&format_level=full';

    const librisR = await fetch(librisUrl);
    const librisD = await librisR.json();

    const items = librisD?.xsearch?.list || [];

    for (const item of items) {
      if (books.length >= 3) break;

      // Bara böcker, inte tidskrifter etc.
      if (item.type && !['Book', 'Bok'].includes(item.type)) continue;

      const title = item.title || item['title-auth'];
      const creator = item.creator || item.author;

      if (!title || !creator) continue;

      // Försök hämta omslag via Open Library med ISBN
      let cover = null;
      const isbn = item.isbn;
      if (isbn) {
        const cleanIsbn = Array.isArray(isbn) ? isbn[0] : isbn;
        cover = `https://covers.openlibrary.org/b/isbn/${cleanIsbn}-M.jpg`;
      }

      books.push({
        title: title,
        author: creator,
        desc: (item.description || item.subject || '').substring(0, 160).trim(),
        cover: cover,
        year: (item.date || '').substring(0, 4),
        lang: item.language || 'sv',
        isbn: isbn || null
      });
    }

    // Fallback: Open Library om LIBRIS ger för lite
    if (books.length < 2) {
      const olUrl = 'https://openlibrary.org/search.json?q='
        + encodeURIComponent(q)
        + '&limit=5&language=swe';

      const olR = await fetch(olUrl);
      const olD = await olR.json();

      for (const doc of (olD.docs || [])) {
        if (books.length >= 3) break;
        if (!doc.title || !doc.author_name) continue;
        if (books.some(b => b.title === doc.title)) continue;

        const coverId = doc.cover_i;
        books.push({
          title: doc.title,
          author: doc.author_name.join(', '),
          desc: '',
          cover: coverId
            ? `https://covers.openlibrary.org/b/id/${coverId}-M.jpg`
            : null,
          year: String(doc.first_publish_year || ''),
          lang: 'sv'
        });
      }
    }

  } catch (e) {
    console.error('Search error:', e.message);
  }

  res.status(200).json({ books: books.slice(0, 3) });
}
