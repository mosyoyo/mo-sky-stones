async function handleIcsRequest(context, getResponse) {
  if (context.request.method === 'GET') return getResponse(context);
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
}

module.exports = { handleIcsRequest };
