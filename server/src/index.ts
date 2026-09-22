import express, { type NextFunction, type Request, type Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import path from 'node:path';
import fs from 'node:fs';
import { config } from './config.js';
import { checkDb, initSchema } from './db.js';
import { apiLimiter, authLimiter, registerLimiter } from './middleware/rateLimit.js';

import authRoutes from './routes/auth.js';
import shopRoutes from './routes/shops.js';
import membershipRoutes from './routes/membership.js';
import serviceRoutes from './routes/services.js';
import barberRoutes from './routes/barbers.js';
import clientRoutes from './routes/clients.js';
import appointmentRoutes from './routes/appointments.js';
import saleRoutes from './routes/sales.js';
import reportRoutes from './routes/reports.js';
import { startMembershipScheduler } from './membership.js';

const app = express();

// Confía solo en el primer proxy (Render/LB) cuando la app define la ruta real del cliente.
app.set('trust proxy', config.trustProxy ? 1 : false);

// ----- Seguridad de headers -----
const isDevOrigin = (origin: string) =>
  origin === 'http://localhost:3000' ||
  origin === 'http://localhost:5173' ||
  origin === 'http://127.0.0.1:3000' ||
  origin === 'http://127.0.0.1:5173';

app.use(
  helmet({
    crossOriginEmbedderPolicy: false,
    crossOriginOpenerPolicy: { policy: 'same-origin' },
    crossOriginResourcePolicy: { policy: 'same-origin' },
    referrerPolicy: { policy: 'no-referrer' },
    hsts: config.isProduction ? { maxAge: 31536000, includeSubDomains: true, preload: true } : false,
    frameguard: { action: 'deny' },
    contentSecurityPolicy: {
      useDefaults: false,
      directives: {
        'default-src': ["'self'"],
        // El index.html usa Google Fonts (Barlow Condensed / Plus Jakarta) y Material Symbols.
        'style-src': [
          "'self'",
          "'unsafe-inline'",
          'https://fonts.googleapis.com',
          'https://checkout.wompi.co',
        ],
        'font-src': ["'self'", 'https://fonts.gstatic.com', 'data:'],
        'img-src': [
          "'self'",
          'data:',
          'blob:',
          'https://checkout.wompi.co',
          'https://*.wompi.co',
        ],
        // El widget de pago de Wompi (Nequi, PSE, tarjetas) carga scripts y habla
        // con las APIs de pago desde checkout.wompi.co y *.wompi.co.
        'connect-src': ["'self'", 'https://checkout.wompi.co', 'https://*.wompi.co'],
        'script-src': ["'self'", 'https://checkout.wompi.co', 'https://*.wompi.co'],
        'frame-src': ["'self'", 'https://checkout.wompi.co', 'https://*.wompi.co'],
        'object-src': ["'none'"],
        'base-uri': ["'self'"],
        'frame-ancestors': ["'none'"],
        'form-action': ["'self'", 'https://checkout.wompi.co', 'https://*.wompi.co'],
        ...(config.isProduction ? { 'upgrade-insecure-requests': [] } : {}),
      },
    },
  }),
);

// Permissions-Policy: solo features ampliamente soportadas. Evita los avisos
// de consola por features desconocidas ('attribution-reporting', etc.) que
// añadía el default de helmet v7 en despliegues anteriores.
app.use((_req, res, next) => {
  res.setHeader(
    'Permissions-Policy',
    'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()',
  );
  next();
});

// ----- CORS estricto (lista blanca) -----
app.use(
  cors({
    origin: (origin, cb) => {
      if (!origin) return cb(null, true); // mismo origen (sin header Origin)
      const allowed = config.allowedOrigins.includes(origin) || (!config.isProduction && isDevOrigin(origin));
      cb(null, allowed);
    },
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    maxAge: 86400,
  }),
);

app.use(
  express.json({
    limit: '1mb',
    // Se guarda el body crudo para poder verificar la firma de los webhooks de Wompi.
    verify: (req: express.Request, _res: express.Response, buf: Buffer) => {
      (req as express.Request & { rawBody?: Buffer }).rawBody = buf;
    },
  }),
);

const startedAt = Date.now();

// ----- Rate limiting -----
app.use('/api', apiLimiter);
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/logout', authLimiter);
app.use('/api/auth/register', registerLimiter);

app.get('/api/health', async (_req, res) => {
  const db = await checkDb();
  res.json({
    ok: true,
    db,
    uptimeMs: Date.now() - startedAt,
    env: config.isProduction ? 'production' : 'development',
    gemini: Boolean(config.googleGeminiApiKey),
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/shop', shopRoutes);
app.use('/api/membership', membershipRoutes);
app.use('/api/services', serviceRoutes);
app.use('/api/barbers', barberRoutes);
app.use('/api/clients', clientRoutes);
app.use('/api/appointments', appointmentRoutes);
app.use('/api/sales', saleRoutes);
app.use('/api/reports', reportRoutes);

app.use('/api', (_req: Request, res: Response) => {
  res.status(404).json({ error: 'Ruta no encontrada' });
});

// ----- Estáticos (build de Vite) -----
const distDir = path.resolve(process.cwd(), 'dist');
if (fs.existsSync(distDir)) {
  app.use(
    express.static(distDir, {
      dotfiles: 'deny',
      index: 'index.html',
      setHeaders: (res, filePath) => {
        const base = path.basename(filePath);
        if (base === 'index.html') {
          // Nunca cachear el HTML: cada carga revalida y apunta a los assets del deploy vigente
          res.setHeader('Cache-Control', 'no-cache');
        } else if (filePath.endsWith('.webmanifest')) {
          // El manifest también se revalida siempre: si no, el splash PWA (colores y
          // nombre) sigue cacheado del primer deploy durante toda la vida del acceso directo.
          res.setHeader('Cache-Control', 'no-cache');
        } else {
          // Los assets hasheados de Vite son inmutables: caché máxima
          res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
        }
        if (filePath.endsWith('.webmanifest')) {
          res.type('application/manifest+json');
        }
      },
    })
  );
  // SPA fallback: solo rutas de navegación (sin extensión de archivo) reciben index.html.
  // Un asset ausente (p. ej. CSS viejo en caché de otro deploy) responde 404 real en vez
  // de HTML con Content-Type text/html, que el navegador rechaza por strict MIME checking.
  app.get(/^\/(?!api).*/, (req: Request, res: Response) => {
    if (path.extname(req.path)) {
      return res.status(404).end();
    }
    res.sendFile(path.join(distDir, 'index.html'), {
      headers: { 'Cache-Control': 'no-cache' },
    });
  });
}

// ----- Manejo central de errores (sin filtrar detalles internos en 5xx) -----
app.use((err: unknown, _req: Request, res: Response, _next: NextFunction) => {
  const status = (err as { status?: number }).status || 500;
  if (status >= 500) {
    console.error('[error]', err);
    if (config.isProduction) {
      return res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
  res.status(status).json({ error: (err as Error).message || 'Error interno' });
});

async function main() {
  try {
    await initSchema();
    console.log('[db] esquema listo / sincronizado');
  } catch (err) {
    console.warn('[db] no se pudo validar el esquema:', (err as Error).message);
  }
  app.listen(config.port, () => {
    console.log(`[barberos-api] escuchando en http://localhost:${config.port}`);
  });
  // Recordatorios + bloqueos de membresía (prueba gratis 7 días, cobro $35.900)
  startMembershipScheduler();
}

main();