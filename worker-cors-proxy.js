/**
 * worker-cors-proxy.js
 * Proxy CORS dedicado y ultra-ligero para LBL Esports en Cloudflare Workers.
 *
 * Funcionalidades:
 * 1. Proxy CORS para API de Challonge (?url=...)
 * 2. Endpoint seguro /twitch/recent-clips?channel=...&minutes=40&limit=8
 *    (Usa Secrets TWITCH_CLIENT_ID y TWITCH_CLIENT_SECRET configurados en Cloudflare Workers)
 */

const TWITCH_GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const TWITCH_CLIP_GQL_HASH = '36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11';
const twitchTokenCache = { accessToken: null, expiresAt: 0 };
const twitchBroadcasterCache = new Map();

function corsJsonResponse(payload, status = 200, cacheControl = 'no-cache, no-store, must-revalidate') {
    return new Response(JSON.stringify(payload), {
        status,
        headers: {
            'Content-Type': 'application/json; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Cache-Control': cacheControl
        }
    });
}

async function getTwitchAppAccessToken(clientId, clientSecret) {
    if (twitchTokenCache.accessToken && Date.now() < twitchTokenCache.expiresAt) {
        return twitchTokenCache.accessToken;
    }
    const resp = await fetch('https://id.twitch.tv/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: 'client_credentials'
        }).toString()
    });
    if (!resp.ok) throw new Error(`Twitch OAuth HTTP ${resp.status}`);
    const data = await resp.json();
    twitchTokenCache.accessToken = data.access_token;
    twitchTokenCache.expiresAt = Date.now() + Math.max(60, (Number(data.expires_in) || 3600) - 120) * 1000;
    return twitchTokenCache.accessToken;
}

async function getTwitchBroadcasterInfo(login, clientId, accessToken) {
    const clean = String(login || '').trim().toLowerCase();
    if (twitchBroadcasterCache.has(clean)) {
        return twitchBroadcasterCache.get(clean);
    }
    const resp = await fetch(`https://api.twitch.tv/helix/users?login=${encodeURIComponent(clean)}`, {
        headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${accessToken}` }
    });
    if (!resp.ok) throw new Error(`Twitch Users HTTP ${resp.status}`);
    const json = await resp.json();
    const user = json?.data?.[0];
    if (!user?.id) throw new Error(`Canal Twitch no encontrado: ${clean}`);
    const info = { id: user.id, login: user.login, displayName: user.display_name || user.login };
    twitchBroadcasterCache.set(clean, info);
    return info;
}

async function resolveClipMp4ViaGql(slug) {
    try {
        const resp = await fetch('https://gql.twitch.tv/gql', {
            method: 'POST',
            headers: {
                'Client-Id': TWITCH_GQL_CLIENT_ID,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify([{
                operationName: 'VideoAccessToken_Clip',
                variables: { slug },
                extensions: { persistedQuery: { version: 1, sha256Hash: TWITCH_CLIP_GQL_HASH } }
            }])
        });
        if (!resp.ok) return null;
        const payload = await resp.json();
        const clipData = payload?.[0]?.data?.clip;
        const qualities = Array.isArray(clipData?.videoQualities) ? clipData.videoQualities : [];
        const sig = clipData?.playbackAccessToken?.signature;
        const token = clipData?.playbackAccessToken?.value;
        if (!qualities.length || !sig || !token) return { mp4Url: null, mp4FastUrl: null };

        const signQualityUrl = (q) => {
            if (!q?.sourceURL) return null;
            const sep = q.sourceURL.includes('?') ? '&' : '?';
            return `${q.sourceURL}${sep}sig=${encodeURIComponent(sig)}&token=${encodeURIComponent(token)}`;
        };

        const chosen720 =
            qualities.find(q => Number(q.quality) === 720) ||
            qualities.find(q => Number(q.quality) > 0 && Number(q.quality) <= 720) ||
            qualities.find(q => Number(q.quality) <= 1080) ||
            qualities[0];

        const chosenFast =
            qualities.find(q => Number(q.quality) === 480) ||
            qualities.find(q => Number(q.quality) === 360) ||
            chosen720;

        return {
            mp4Url: signQualityUrl(chosen720),
            mp4FastUrl: signQualityUrl(chosenFast)
        };
    } catch (_) {
        return { mp4Url: null, mp4FastUrl: null };
    }
}

async function handleRecentTwitchClips(url, env) {
    const clientId = (env?.TWITCH_CLIENT_ID || '').trim();
    const clientSecret = (env?.TWITCH_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
        return corsJsonResponse({ error: 'Faltan Secrets TWITCH_CLIENT_ID o TWITCH_CLIENT_SECRET en Worker', clips: [] }, 500);
    }

    const channel = (url.searchParams.get('channel') || '').trim().toLowerCase();
    const minutes = Math.min(Math.max(1, parseInt(url.searchParams.get('minutes') || '40', 10) || 40), 10080);
    const limit = Math.min(Math.max(1, parseInt(url.searchParams.get('limit') || '8', 10) || 8), 20);
    const testHistorical = url.searchParams.get('testHistorical') === '1';

    if (!channel || !/^[a-z0-9_]{2,30}$/.test(channel)) {
        return corsJsonResponse({ error: 'Parámetro channel inválido o vacío', clips: [] }, 400);
    }

    try {
        const token = await getTwitchAppAccessToken(clientId, clientSecret);
        const broadcaster = await getTwitchBroadcasterInfo(channel, clientId, token);

        const nowMs = Date.now();
        const params = new URLSearchParams({
            broadcaster_id: broadcaster.id,
            first: '50'
        });
        if (!testHistorical) {
            params.set('started_at', new Date(nowMs - minutes * 60 * 1000).toISOString());
            params.set('ended_at', new Date(nowMs).toISOString());
        }

        const clipsResp = await fetch(`https://api.twitch.tv/helix/clips?${params.toString()}`, {
            headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${token}` }
        });
        if (!clipsResp.ok) throw new Error(`Twitch Clips API HTTP ${clipsResp.status}`);
        const clipsJson = await clipsResp.json();
        const rawClips = Array.isArray(clipsJson?.data) ? clipsJson.data : [];

        rawClips.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        const sliced = rawClips.slice(0, limit);

        const enriched = await Promise.all(sliced.map(async (c) => {
            const media = await resolveClipMp4ViaGql(c.id);
            return {
                id: c.id,
                title: c.title || 'Clip de Twitch',
                url: c.url,
                embedUrl: c.embed_url || `https://clips.twitch.tv/embed?clip=${c.id}`,
                mp4Url: media?.mp4Url || null,
                mp4FastUrl: media?.mp4FastUrl || media?.mp4Url || null,
                broadcasterId: c.broadcaster_id,
                broadcasterLogin: broadcaster.login,
                broadcasterName: c.broadcaster_name || broadcaster.displayName,
                creatorName: c.creator_name || 'Twitch',
                duration: Number(c.duration) || 30,
                viewCount: Number(c.view_count) || 0,
                createdAt: c.created_at,
                thumbnailUrl: c.thumbnail_url || '',
                isHistoricalTest: Boolean(testHistorical)
            };
        }));

        return corsJsonResponse({
            fetchedAt: new Date(nowMs).toISOString(),
            channel: broadcaster.login,
            broadcasterId: broadcaster.id,
            windowMinutes: testHistorical ? 0 : minutes,
            testHistorical: Boolean(testHistorical),
            clips: enriched
        }, 200, 'public, max-age=20');
    } catch (err) {
        return corsJsonResponse({ error: err.message, clips: [] }, 502);
    }
}

export default {
    async fetch(request, env) {
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

        if (url.pathname === '/twitch/recent-clips') {
            return handleRecentTwitchClips(url, env);
        }

        const targetUrl = url.searchParams.get('url');

        if (!targetUrl) {
            return corsJsonResponse({ error: 'Falta parámetro ?url=' }, 400);
        }

        try {
            const parsed = new URL(targetUrl);
            if (!parsed.hostname.endsWith('challonge.com')) {
                return corsJsonResponse({ error: 'Solo se permite consultar dominios de Challonge' }, 403);
            }

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
            return corsJsonResponse({ error: 'Fallo al consultar Challonge: ' + err.message }, 502);
        }
    }
};
