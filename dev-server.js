const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

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
    '.ttf': 'font/ttf'
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

    const primaryUrl = `https://lh3.googleusercontent.com/d/${id}=${size || 's800'}`;
    const fallbackUrl = `https://drive.google.com/thumbnail?id=${id}&sz=w800`;

    function doRequest(url, isFallback = false) {
        const req = https.get(url, {
            headers: {
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Accept': 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
            },
            timeout: 10000
        }, (res) => {
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
                    callback(null, item);
                });
            } else if (!isFallback) {
                setTimeout(() => doRequest(fallbackUrl, true), 300);
            } else {
                callback(new Error(`Status ${res.statusCode}`));
            }
        });

        req.on('error', (err) => {
            if (!isFallback) {
                setTimeout(() => doRequest(fallbackUrl, true), 300);
            } else {
                callback(err);
            }
        });

        req.on('timeout', () => {
            req.destroy();
            if (!isFallback) {
                doRequest(fallbackUrl, true);
            } else {
                callback(new Error('Timeout'));
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

    // PROXY CON CACHÉ PARA IMÁGENES DE GOOGLE DRIVE (Elimina Rate Limit 429)
    if (pathname === '/api/drive-proxy') {
        const id = urlObj.searchParams.get('id');
        const size = urlObj.searchParams.get('sz') || 's800';
        if (!id) {
            res.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
            return res.end('Falta el parámetro id');
        }

        fetchDriveImage(id, size, (err, item) => {
            if (err || !item) {
                res.writeHead(302, { 'Location': `https://lh3.googleusercontent.com/d/${id}=${size}` });
                return res.end();
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
                res.writeHead(502, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Error al conectar con Challonge: ' + err.message }));
            });

            proxyReq.on('timeout', () => {
                proxyReq.destroy();
                res.writeHead(504, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
                res.end(JSON.stringify({ error: 'Timeout al conectar con Challonge' }));
            });

            return;
        } catch (e) {
            res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' });
            return res.end(JSON.stringify({ error: 'URL inválida: ' + e.message }));
        }
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
