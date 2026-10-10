// Prints the Mac's LAN IPv4 address (used for dev URLs that phones and the VVD can reach).
import {networkInterfaces} from 'node:os';
for (const addrs of Object.values(networkInterfaces()))
  for (const a of addrs ?? []) if (a.family === 'IPv4' && !a.internal) { console.log(a.address); process.exit(0); }
console.log('localhost');
