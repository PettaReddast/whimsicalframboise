const https = require('https');

function supabaseRequest(method, table, body, match) {
  return new Promise(function(resolve, reject) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_KEY;
    if (!url || !key) {
      reject(new Error('Supabase not configured'));
      return;
    }

    let path = '/rest/v1/' + table;
    if (match) path += '?id=eq.' + encodeURIComponent(match);
    if (method === 'GET') path += (match ? '&' : '?') + 'select=*';

    const payload = body ? JSON.stringify(body) : null;

    const options = {
      hostname: url.replace('https://', '').replace('http://', ''),
      path: path,
      method: method,
      headers: {
        'apikey': key,
        'Authorization': 'Bearer ' + key,
        'Content-Type': 'application/json',
        'Prefer': method === 'POST' ? 'resolution=merge-duplicates,return=minimal' : 'return=minimal'
      }
    };

    if (payload) {
      options.headers['Content-Length'] = Buffer.byteLength(payload);
    }

    const req = https.request(options, function(res) {
      let data = '';
      res.on('data', function(chunk) { data += chunk; });
      res.on('end', function() {
        try {
          resolve(data ? JSON.parse(data) : []);
        } catch(e) {
          resolve([]);
        }
      });
    });

    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

exports.handler = async function(event) {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: 'Method Not Allowed' };
  }

  let body;
  try {
    body = JSON.parse(event.body);
  } catch(e) {
    return { statusCode: 400, body: JSON.stringify({ error: 'Invalid request' }) };
  }

  const { action, table, id, data } = body;

  try {
    if (action === 'get') {
      const rows = await supabaseRequest('GET', table, null, id);
      const row = Array.isArray(rows) ? rows[0] : null;
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: row ? row.data : null })
      };
    }

    if (action === 'set') {
      await supabaseRequest('POST', table, { id: id, data: data, updated_at: new Date().toISOString() }, null);
      return {
        statusCode: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ok: true })
      };
    }

    return { statusCode: 400, body: JSON.stringify({ error: 'Unknown action' }) };

  } catch(e) {
    return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
  }
};
