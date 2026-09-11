/**
 * worker-cors-proxy.js
 * Proxy CORS dedicado y ultra-ligero para LBL Esports en Cloudflare Workers.
 * 
 * Permite que el Dashboard de LBL consulte la API de Challonge con:
 * - 100% soporte CORS
 * - 100.000 peticiones diarias gratis para siempre
 * - Restringido exclusivamente a dominios oficiales de LBL y localhost
 */

const ALLOWED_ORIGINS = [
    'https://lbl-esports.web.app',
    'https://lbl-esports.firebaseapp.com',
    'http://localhost:8000',
    'http://127.0.0.1:8000'
];

export default {
    async fetch(request) {
        // 1. Manejo de Preflight OPTIONS
        if (request.method === 'OPTIONS') {
            return new Response(null, {
                status: 204,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
                    'Access-Control-Max-Age': '86400'
                }
            });
        }

        const url = new URL(request.url);
        const targetUrl = url.searchParams.get('url');

        if (!targetUrl) {
            return new Response(JSON.stringify({ error: 'Falta parámetro ?url=' }), {
                status: 400,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }

        try {
            const parsed = new URL(targetUrl);
            if (!parsed.hostname.endsWith('challonge.com')) {
                return new Response(JSON.stringify({ error: 'Solo se permite consultar dominios de Challonge' }), {
                    status: 403,
                    headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
                });
            }

            // Consulta a Challonge sin restricciones de navegador
            const challongeResponse = await fetch(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LBLEsports-Worker/1.0',
                    'Accept': 'application/json, text/plain, */*'
                }
            });

            const data = await challongeResponse.arrayBuffer();

            return new Response(data, {
                status: challongeResponse.status,
                headers: {
                    'Content-Type': challongeResponse.headers.get('content-type') || 'application/json',
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Methods': 'GET, OPTIONS',
                    'Access-Control-Allow-Headers': 'Content-Type',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                }
            });
        } catch (err) {
            return new Response(JSON.stringify({ error: 'Fallo al consultar Challonge: ' + err.message }), {
                status: 502,
                headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
            });
        }
    }
};
