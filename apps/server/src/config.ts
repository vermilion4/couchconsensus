// Runtime configuration from environment variables (ADR-0008, ADR-0009, ADR-0012).
import {networkInterfaces} from 'node:os';
import {fileURLToPath} from 'node:url';

export interface Config {
  port: number;
  host: string;
  /** Base URL phones open from the QR code, e.g. https://dxxxx.cloudfront.net or http://192.168.1.20:5173 */
  publicBaseUrl: string;
  /** Built phone page (apps/phone/dist). Served at /r/:code in production. */
  phoneDistDir: string;
  aiMode: 'off' | 'on';
  catalogMode: 'demo' | 'real';
  defaultRegion: string;
  logLevel: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const port = Number(env.PORT ?? 8080);
  return {
    port,
    host: env.HOST ?? '0.0.0.0',
    // Default: the LAN address, so phones on the same Wi-Fi can open the QR link in development.
    // PHONE_PORT=5173 when the phone page is served by the Vite dev server.
    publicBaseUrl: (env.PUBLIC_BASE_URL ?? `http://${lanIp()}:${env.PHONE_PORT ?? port}`).replace(/\/$/, ''),
    phoneDistDir: env.PHONE_DIST_DIR ?? fileURLToPath(new URL('../../phone/dist', import.meta.url)),
    aiMode: env.AI_MODE === 'on' ? 'on' : 'off',
    catalogMode: env.CATALOG_MODE === 'real' ? 'real' : 'demo',
    defaultRegion: env.DEFAULT_REGION ?? 'US',
    logLevel: env.LOG_LEVEL ?? 'info',
  };
}

function lanIp(): string {
  for (const addrs of Object.values(networkInterfaces()))
    for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) return a.address;
  return 'localhost';
}
