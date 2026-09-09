const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8000;
const PUBLIC_DIR = 'z:/LBL/public';

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

const server = http.createServer((req, res) => {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(urlObj.pathname);

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

server.listen(PORT, () => {
    console.log(`\n🚀 Servidor LBL corriendo con soporte total de Clean URLs y Rewrites:`);
    console.log(`👉 http://localhost:${PORT}/\n`);
});
