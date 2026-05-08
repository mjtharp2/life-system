// Life System worker — currently only the Oura CORS proxy.
// Step 4 of Phase 0 refactors this into a multi-route worker
// (Oura + Todoist OAuth callback + Google OAuth callback + future routes).

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.searchParams.get('path');
    const token = url.searchParams.get('token');
    if (!path || !token) return new Response('Missing params', { status: 400 });
    const ouraUrl = 'https://api.ouraring.com/v2/usercollection/' + decodeURIComponent(path);
    const ouraRes = await fetch(ouraUrl, { headers: { Authorization: 'Bearer ' + token } });
    const data = await ouraRes.text();
    return new Response(data, {
      status: ouraRes.status,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*'
      }
    });
  }
}
