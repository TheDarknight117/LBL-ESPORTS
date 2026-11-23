const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

function loadLocalEnvFiles() {
    ['.env', '.env.local'].forEach((fileName) => {
        const fullPath = path.join(__dirname, fileName);
        if (!fs.existsSync(fullPath)) return;
        const lines = fs.readFileSync(fullPath, 'utf8').split(/\r?\n/);
        for (const rawLine of lines) {
            const line = rawLine.trim();
            if (!line || line.startsWith('#')) continue;
            const eqIdx = line.indexOf('=');
            if (eqIdx <= 0) continue;
            const key = line.slice(0, eqIdx).trim();
            const val = line.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '');
            if (key && !(key in process.env)) {
                process.env[key] = val;
            }
        }
    });
}
loadLocalEnvFiles();

const TWITCH_GQL_CLIENT_ID = 'kimne78kx3ncx6brgo4mv6wki5h1ko';
const TWITCH_CLIP_GQL_HASH = '36b89d2507fce29e5ca551df756d27c1cfe079e2609642b4390aa4c35796eb11';
const twitchTokenCache = { accessToken: null, expiresAt: 0 };
const twitchBroadcasterCache = new Map();

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
    if (!resp.ok) {
        throw new Error(`Twitch OAuth fallo HTTP ${resp.status}`);
    }
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
    if (!resp.ok) throw new Error(`Twitch Users API HTTP ${resp.status}`);
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
                extensions: {
                    persistedQuery: { version: 1, sha256Hash: TWITCH_CLIP_GQL_HASH }
                }
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

async function fetchRecentTwitchClips(channelLogin, { windowMinutes = 40, limit = 8, testHistorical = false } = {}) {
    const clientId = (process.env.TWITCH_CLIENT_ID || '').trim();
    const clientSecret = (process.env.TWITCH_CLIENT_SECRET || '').trim();
    if (!clientId || !clientSecret) {
        throw new Error('Falta TWITCH_CLIENT_ID o TWITCH_CLIENT_SECRET en .env.local');
    }

    const token = await getTwitchAppAccessToken(clientId, clientSecret);
    const broadcaster = await getTwitchBroadcasterInfo(channelLogin, clientId, token);

    const nowMs = Date.now();
    const mins = Math.min(Math.max(1, Number(windowMinutes) || 40), 10080);
    const maxItems = Math.min(Math.max(1, Number(limit) || 8), 20);

    const params = new URLSearchParams({
        broadcaster_id: broadcaster.id,
        first: '50'
    });
    if (!testHistorical) {
        params.set('started_at', new Date(nowMs - mins * 60 * 1000).toISOString());
        params.set('ended_at', new Date(nowMs).toISOString());
    }

    const clipsResp = await fetch(`https://api.twitch.tv/helix/clips?${params.toString()}`, {
        headers: { 'Client-Id': clientId, 'Authorization': `Bearer ${token}` }
    });
    if (!clipsResp.ok) throw new Error(`Twitch Clips API HTTP ${clipsResp.status}`);
    const clipsJson = await clipsResp.json();
    const rawClips = Array.isArray(clipsJson?.data) ? clipsJson.data : [];

    rawClips.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const sliced = rawClips.slice(0, maxItems);

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

    return {
        fetchedAt: new Date(nowMs).toISOString(),
        channel: broadcaster.login,
        broadcasterId: broadcaster.id,
        windowMinutes: testHistorical ? 0 : mins,
        testHistorical: Boolean(testHistorical),
        clips: enriched
    };
}

const PORT = 8000;
const PUBLIC_DIR = path.join(__dirname, 'public');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
    '.mp4': 'video/mp4',
    '.webm': 'video/webm'
};

function serveFile(res, filePath) {
    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(500, { 'Content-Type': 'text/plain; charset=utf-8' });
            res.end('500 Internal Server Error');
            return;
        }
        res.writeHead(200, {
            'Content-Type': contentType,
            'Cache-Control': 'no-cache, no-store, must-revalidate'
        });
        res.end(data);
    });
}

// Caché en memoria para imágenes de Google Drive (evita Rate Limit 429)
const driveImageCache = new Map();

function fetchDriveImage(id, size, callback) {
    if (driveImageCache.has(id)) {
        return callback(null, driveImageCache.get(id));
    }

    let called = false;
    const safeCallback = (err, item) => {
        if (!called) {
            called = true;
            callback(err, item);
        }
    };

    const primaryUrl = `https://lh3.googleusercontent.com/d/${id}=${size || 's800'}`;
    const fallbackUrl = `https://drive.google.com/thumbnail?id=${id}&sz=w800`;

    function doRequest(url, isFallback = false) {
        if (called) return;
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            },
            timeout: 10000
        }, (res) => {
            if (called) return;
            if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
                return doRequest(res.headers.location, isFallback);
            }

            if (res.statusCode === 200) {
                const chunks = [];
                res.on('data', chunk => chunks.push(chunk));
                res.on('end', () => {
                    const buffer = Buffer.concat(chunks);
                    const item = {
                        data: buffer,
                        contentType: res.headers['content-type'] || 'image/jpeg'
                    };
                    driveImageCache.set(id, item);
                    safeCallback(null, item);
                });
            } else if (!isFallback) {
                setTimeout(() => doRequest(fallbackUrl, true), 300);
            } else {
                safeCallback(new Error(`Status ${res.statusCode}`));
            }
        });

        req.on('error', (err) => {
            if (called) return;
            if (!isFallback) {
                setTimeout(() => doRequest(fallbackUrl, true), 300);
            } else {
                safeCallback(err);
            }
        });

        req.on('timeout', () => {
            req.destroy();
            if (called) return;
            if (!isFallback) {
                doRequest(fallbackUrl, true);
            } else {
                safeCallback(new Error('Timeout'));
            }
        });
    }

    doRequest(primaryUrl);
}

const server = http.createServer((req, res) => {
    // Manejo de Preflight OPTIONS para CORS
    if (req.method === 'OPTIONS') {
        res.writeHead(204, {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '86400'
        });
        return res.end();
    }

    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(urlObj.pathname);

    // UPLOAD DIRECTO DE MULTIMEDIA (Videos MP4 o Flyers locales)
    if (pathname === '/api/upload-media' && req.method === 'POST') {
        const rawFileName = req.headers['x-file-name'] || ('upload_' + Date.now());
        const decoded = decodeURIComponent(rawFileName);
        const ext = path.extname(decoded).toLowerCase() || '.mp4';
        const baseName = path.basename(decoded, ext).replace(/[^a-zA-Z0-9_-]/g, '_');
        const safeFileName = `${Date.now()}_${baseName}${ext}`;

        const uploadsDir = path.join(PUBLIC_DIR, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            fs.mkdirSync(uploadsDir, { recursive: true });
        }

        const targetPath = path.join(uploadsDir, safeFileName);
        const writeStream = fs.createWriteStream(targetPath);

        req.pipe(writeStream);

        writeStream.on('finish', () => {
            const isVideo = ['.mp4', '.webm', '.m4v', '.mov'].includes(ext);
            const relativeUrl = `/uploads/${safeFileName}`;

            res.writeHead(200, {
                'Content-Type': 'application/json; charset=utf-8',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(JSON.stringify({
                success: true,
                url: relativeUrl,
                fileName: decoded,
                mediaType: isVideo ? 'video' : 'image'
            }));
        });

        writeStream.on('error', (err) => {
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            res.end(JSON.stringify({ error: err.message }));
        });
        return;
    }

    // PROXY CON CACHÉ PARA IMÁGENES DE GOOGLE DRIVE (Elimina Rate Limit 429)
    if (pathname === '/api/drive-proxy' || pathname === '/drive-proxy') {
        const id = urlObj.searchParams.get('id');
        const size = urlObj.searchParams.get('sz') || 's800';
        if (!id) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Falta el parámetro id');
        }

        fetchDriveImage(id, size, (err, item) => {
            if (res.headersSent || res.writableEnded) return;
            if (err || !item) {
                // Si Google Drive no permite la descarga directa o da 500, responder 404 limpio
                res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                return res.end('Logo no disponible en Drive');
            }

            res.writeHead(200, {
                'Content-Type': item.contentType,
                'Cache-Control': 'public, max-age=86400, stale-while-revalidate=604800',
                'Access-Control-Allow-Origin': '*'
            });
            res.end(item.data);
        });
        return;
    }

    // 0. CORS PROXY NATIVO PARA CHALLONGE (100% Sin Fallas en Desarrollo Local)
    if (pathname === '/api/challonge-proxy') {
        const targetUrl = urlObj.searchParams.get('url');
        if (!targetUrl) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ error: 'Falta el parámetro url' }));
        }

        try {
            const parsedTarget = new URL(targetUrl);
            if (!parsedTarget.hostname.endsWith('challonge.com')) {
                res.writeHead(403, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                return res.end(JSON.stringify({ error: 'Solo se permiten consultas a Challonge' }));
            }

            const proxyReq = https.get(targetUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) LBLEsports/1.0',
                    'Accept': 'application/json, text/plain, */*'
                },
                timeout: 8000
            }, (challongeRes) => {
                let data = '';
                challongeRes.on('data', chunk => { data += chunk; });
                challongeRes.on('end', () => {
                    res.writeHead(challongeRes.statusCode, {
                        'Content-Type': challongeRes.headers['content-type'] || 'application/json; charset=utf-8',
                        'Access-Control-Allow-Origin': '*',
                        'Access-Control-Allow-Methods': 'GET, OPTIONS',
                        'Access-Control-Allow-Headers': 'Content-Type',
                        'Cache-Control': 'no-cache, no-store, must-revalidate'
                    });
                    res.end(data);
                });
            });

            proxyReq.on('error', (err) => {
                if (res.headersSent || res.writableEnded) return;
                res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Error al conectar con Challonge: ' + err.message }));
            });

            proxyReq.on('timeout', () => {
                proxyReq.destroy();
                if (res.headersSent || res.writableEnded) return;
                res.writeHead(504, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Timeout al conectar con Challonge' }));
            });

            return;
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ error: 'URL inválida: ' + e.message }));
        }
    }

    // 0.1 PROXY PARA RIOT GAMES API (Account-V1 por Riot ID o por PUUID + Summoner-V4 + League-V4)
    if (pathname === '/api/riot-account') {
        const gameName = (urlObj.searchParams.get('gameName') || '').trim();
        const tagLine = (urlObj.searchParams.get('tagLine') || '').trim().replace(/^#+/, '');
        const queryPuuid = (urlObj.searchParams.get('puuid') || '').trim();
        const region = (urlObj.searchParams.get('region') || 'la2').toLowerCase();
        const apiKey = (urlObj.searchParams.get('apiKey') || process.env.RIOT_API_KEY || 'RGAPI-7d514ad3-3115-4677-948d-0282d0d60c7a').trim();

        if (!queryPuuid && (!gameName || !tagLine)) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ error: 'Se requiere gameName y tagLine (o puuid)' }));
        }

        const fetchJson = (url, headers = {}) => new Promise((resolve, reject) => {
            https.get(url, { headers, timeout: 8000 }, (r) => {
                let raw = '';
                r.on('data', chunk => { raw += chunk; });
                r.on('end', () => {
                    try {
                        resolve({ status: r.statusCode, data: raw ? JSON.parse(raw) : null });
                    } catch (err) {
                        resolve({ status: r.statusCode, data: null });
                    }
                });
            }).on('error', reject);
        });

        (async () => {
            try {
                const riotHeaders = { 'X-Riot-Token': apiKey, 'User-Agent': 'LBLEsports/1.0' };
                const accUrl = queryPuuid
                    ? `https://americas.api.riotgames.com/riot/account/v1/accounts/by-puuid/${encodeURIComponent(queryPuuid)}`
                    : `https://americas.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`;
                const accResp = await fetchJson(accUrl, riotHeaders);

                if (accResp.status !== 200 || !accResp.data?.puuid) {
                    res.writeHead(accResp.status || 404, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                    return res.end(JSON.stringify({
                        error: accResp.status === 404
                            ? `No se encontró la cuenta ${gameName}#${tagLine} en Riot Games.`
                            : `Error de Riot API (HTTP ${accResp.status}). Verifica que el Riot ID sea correcto.`
                    }));
                }

                const puuid = accResp.data.puuid;
                const platformHost = ['la1', 'la2', 'br1', 'na1', 'euw1'].includes(region) ? region : 'la2';
                const sumUrl = `https://${platformHost}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${encodeURIComponent(puuid)}`;
                const sumResp = await fetchJson(sumUrl, riotHeaders);

                let profileIconId = 29;
                let summonerLevel = null;
                let soloq = null;

                if (sumResp.status === 200 && sumResp.data) {
                    profileIconId = sumResp.data.profileIconId || 29;
                    summonerLevel = sumResp.data.summonerLevel || null;

                    if (sumResp.data.id) {
                        const leagueUrl = `https://${platformHost}.api.riotgames.com/lol/league/v4/entries/by-summoner/${encodeURIComponent(sumResp.data.id)}`;
                        const leagueResp = await fetchJson(leagueUrl, riotHeaders);
                        if (leagueResp.status === 200 && Array.isArray(leagueResp.data)) {
                            const rankedSolo = leagueResp.data.find(q => q.queueType === 'RANKED_SOLO_5x5') || leagueResp.data[0];
                            if (rankedSolo) {
                                soloq = {
                                    queueType: rankedSolo.queueType,
                                    tier: rankedSolo.tier,
                                    rank: rankedSolo.rank,
                                    leaguePoints: rankedSolo.leaguePoints,
                                    wins: rankedSolo.wins,
                                    losses: rankedSolo.losses
                                };
                            }
                        }
                    }

                    if (!soloq) {
                        const puuidLeagueUrl = `https://${platformHost}.api.riotgames.com/lol/league/v4/entries/by-puuid/${encodeURIComponent(puuid)}`;
                        const puuidLeagueResp = await fetchJson(puuidLeagueUrl, riotHeaders);
                        if (puuidLeagueResp.status === 200 && Array.isArray(puuidLeagueResp.data)) {
                            const rankedSolo = puuidLeagueResp.data.find(q => q.queueType === 'RANKED_SOLO_5x5') || puuidLeagueResp.data[0];
                            if (rankedSolo) {
                                soloq = {
                                    queueType: rankedSolo.queueType,
                                    tier: rankedSolo.tier,
                                    rank: rankedSolo.rank,
                                    leaguePoints: rankedSolo.leaguePoints,
                                    wins: rankedSolo.wins,
                                    losses: rankedSolo.losses
                                };
                            }
                        }
                    }
                }

                res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                return res.end(JSON.stringify({
                    verifiedViaApi: true,
                    puuid,
                    gameName: accResp.data.gameName || gameName,
                    tagLine: accResp.data.tagLine || tagLine,
                    region: platformHost.toUpperCase(),
                    profileIconId,
                    profileIconUrl: `https://raw.communitydragon.org/latest/plugins/rcp-be-lol-game-data/global/default/v1/profile-icons/${profileIconId}.jpg`,
                    summonerLevel,
                    soloq
                }));
            } catch (err) {
                res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                return res.end(JSON.stringify({ error: 'Error consultando Riot API: ' + err.message }));
            }
        })();
        return;
    }

    // 0.2 PROXY TWITCH CLIPS RECIENTES (Helix + GQL MP4, sin exponer TWITCH_CLIENT_SECRET)
    if (pathname === '/api/twitch-recent-clips' && req.method === 'GET') {
        const channel = (urlObj.searchParams.get('channel') || '').trim().toLowerCase();
        const minutes = parseInt(urlObj.searchParams.get('minutes') || '40', 10);
        const limit = parseInt(urlObj.searchParams.get('limit') || '8', 10);
        const testHistorical = urlObj.searchParams.get('testHistorical') === '1';

        if (!channel || !/^[a-z0-9_]{2,30}$/.test(channel)) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ error: 'Parámetro channel inválido o vacío' }));
        }

        fetchRecentTwitchClips(channel, { windowMinutes: minutes, limit, testHistorical })
            .then((result) => {
                res.writeHead(200, {
                    'Content-Type': 'application/json; charset=utf-8',
                    'Access-Control-Allow-Origin': '*',
                    'Cache-Control': 'no-cache, no-store, must-revalidate'
                });
                res.end(JSON.stringify(result));
            })
            .catch((err) => {
                res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: err.message, clips: [] }));
            });
        return;
    }

    // 1. REWRITE: /torneos/* -> torneos.html (igual que Firebase)
    if (pathname.startsWith('/torneos/') || pathname === '/torneos') {
        const torneosFile = path.join(PUBLIC_DIR, 'torneos.html');
        if (fs.existsSync(torneosFile)) {
            return serveFile(res, torneosFile);
        }
    }

    // 2. Ruta directa de archivo
    let filePath = path.join(PUBLIC_DIR, pathname);

    // Si es raíz "/" -> "index.html"
    if (pathname === '/') {
        filePath = path.join(PUBLIC_DIR, 'index.html');
    }

    // Si el archivo exacto existe
    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
        return serveFile(res, filePath);
    }

    // 3. CLEAN URLS: si piden "/equipos", buscar "/equipos.html"
    if (!path.extname(filePath)) {
        const htmlPath = filePath + '.html';
        if (fs.existsSync(htmlPath) && fs.statSync(htmlPath).isFile()) {
            return serveFile(res, htmlPath);
        }
    }

    // 4. Si pide un directorio, buscar index.html dentro
    if (fs.existsSync(filePath) && fs.statSync(filePath).isDirectory()) {
        const indexInDir = path.join(filePath, 'index.html');
        if (fs.existsSync(indexInDir) && fs.statSync(indexInDir).isFile()) {
            return serveFile(res, indexInDir);
        }
    }

    // 5. 404 Not Found
    const errorPage = path.join(PUBLIC_DIR, '404.html');
    if (fs.existsSync(errorPage)) {
        res.writeHead(404, { 'Content-Type': 'text/html; charset=utf-8' });
        fs.createReadStream(errorPage).pipe(res);
    } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found');
    }
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 Servidor LBL corriendo con soporte total de Clean URLs, Rewrites y Proxy Challonge:`);
    console.log(`👉 Local:    http://localhost:${PORT}/`);
    console.log(`👉 En red:   http://0.0.0.0:${PORT}/\n`);
});
