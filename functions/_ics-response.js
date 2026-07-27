async function handleIcsRequest(context, getResponse) {
  try {
    if (context.request.method === 'GET') return await getResponse(context);
    if (context.request.method === 'HEAD') {
      const response = await getResponse(context);
      return new Response(null, {
        status: response.status,
        headers: response.headers,
      });
    }
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  } catch (err) {
    console.error('[ICS] handler error:', err.message);
    const empty = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//mo-sky-stones//Error//ZH',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'END:VCALENDAR',
    ].join('\r\n');
    return new Response(empty, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'no-cache, max-age=0',
      },
    });
  }
}

async function createIcsResponse(request, ics, filename) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(ics));
  const etag = `"${[...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('')}"`;
  const headers = {
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': `inline; filename="${filename}"`,
    'Cache-Control': 'no-cache, max-age=0, must-revalidate',
    'CDN-Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
    ETag: etag,
  };
  if (request.headers.get('If-None-Match') === etag) {
    return new Response(null, { status: 304, headers });
  }
  return new Response(ics, { status: 200, headers });
}

module.exports = { createIcsResponse, handleIcsRequest };
