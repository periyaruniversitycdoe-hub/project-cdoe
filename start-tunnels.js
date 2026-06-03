/**
 * PhD ERP Portal — Localtunnel Public Access Script
 * Starts tunnels for all 9 services, writes .env files, prints public URLs.
 *
 * Usage:  node start-tunnels.js
 * Stop:   Ctrl+C
 */

const localtunnel = require('localtunnel');
const fs          = require('fs');
const path        = require('path');

const ROOT = __dirname;

const SERVICES = [
  // ── Backends ────────────────────────────────────────────────────────
  { name: 'Student Backend',     port: 5000, envKey: 'STUDENT_BE' },
  { name: 'Admin Backend',       port: 5001, envKey: 'ADMIN_BE'   },
  { name: 'Supervisor Backend',  port: 5002, envKey: 'SUPERVISOR_BE' },
  { name: 'Center Backend',      port: 5003, envKey: 'CENTER_BE'  },
  // ── Frontends ───────────────────────────────────────────────────────
  { name: 'Portal Dashboard',    port: 5172, envKey: 'PORTAL_FE'  },
  { name: 'Student Frontend',    port: 5173, envKey: 'STUDENT_FE' },
  { name: 'Admin Frontend',      port: 5174, envKey: 'ADMIN_FE'   },
  { name: 'Supervisor Frontend', port: 5175, envKey: 'SUPERVISOR_FE' },
  { name: 'Center Frontend',     port: 5176, envKey: 'CENTER_FE'  },
];

const tunnels = [];

async function openTunnel(svc) {
  return new Promise((resolve, reject) => {
    localtunnel({ port: svc.port, allow_invalid_cert: true }, (err, tunnel) => {
      if (err) return reject(err);
      tunnel.on('error', (e) => console.error(`[${svc.name}] tunnel error:`, e.message));
      tunnel.on('close', () => console.log(`[${svc.name}] tunnel closed`));
      console.log(`  ✅  ${svc.name.padEnd(22)} ${tunnel.url}`);
      resolve({ svc, tunnel, url: tunnel.url });
    });
  });
}

function writeEnvFile(filePath, vars) {
  const lines = Object.entries(vars).map(([k, v]) => `${k}=${v}`).join('\n');
  fs.writeFileSync(filePath, lines + '\n', 'utf8');
}

async function main() {
  console.log('\n🚀  PhD ERP Portal — Starting public tunnels...\n');

  // Open all tunnels sequentially (avoids hammering localtunnel API)
  for (const svc of SERVICES) {
    try {
      const result = await openTunnel(svc);
      tunnels.push(result);
    } catch (err) {
      console.error(`  ❌  Failed to open tunnel for ${svc.name}:`, err.message);
    }
  }

  // Build URL map
  const urls = {};
  tunnels.forEach(({ svc, url }) => { urls[svc.envKey] = url; });

  const studentBe    = urls['STUDENT_BE']    || 'http://localhost:5000';
  const adminBe      = urls['ADMIN_BE']      || 'http://localhost:5001';
  const supervisorBe = urls['SUPERVISOR_BE'] || 'http://localhost:5002';
  const centerBe     = urls['CENTER_BE']     || 'http://localhost:5003';

  // ── Write .env for each frontend ──────────────────────────────────────
  const frontendEnvs = {
    [path.join(ROOT, 'student/frontend/.env')]: {
      VITE_STUDENT_API_URL:    studentBe,
      VITE_ADMIN_API_URL:      adminBe,
    },
    [path.join(ROOT, 'admin/frontend/.env')]: {
      VITE_ADMIN_API_URL:      adminBe,
      VITE_STUDENT_API_URL:    studentBe,
      VITE_SUPERVISOR_API_URL: supervisorBe,
      VITE_CENTER_API_URL:     centerBe,
    },
    [path.join(ROOT, 'supervisor/frontend/.env')]: {
      VITE_SUPERVISOR_API_URL: supervisorBe,
      VITE_ADMIN_API_URL:      adminBe,
    },
    [path.join(ROOT, 'center/frontend/.env')]: {
      VITE_CENTER_API_URL:     centerBe,
      VITE_ADMIN_API_URL:      adminBe,
    },
    [path.join(ROOT, 'portal-dashboard/.env')]: {
      VITE_STUDENT_API_URL:    studentBe,
      VITE_ADMIN_API_URL:      adminBe,
      VITE_SUPERVISOR_API_URL: supervisorBe,
      VITE_CENTER_API_URL:     centerBe,
    },
  };

  console.log('\n📝  Writing frontend .env files...');
  for (const [file, vars] of Object.entries(frontendEnvs)) {
    writeEnvFile(file, vars);
    console.log(`  ✅  ${path.relative(ROOT, file)}`);
  }

  // ── Print summary ─────────────────────────────────────────────────────
  const portalFe    = urls['PORTAL_FE']     || 'http://localhost:5172';
  const studentFe   = urls['STUDENT_FE']    || 'http://localhost:5173';
  const adminFe     = urls['ADMIN_FE']      || 'http://localhost:5174';
  const supervisorFe= urls['SUPERVISOR_FE'] || 'http://localhost:5175';
  const centerFe    = urls['CENTER_FE']     || 'http://localhost:5176';

  console.log(`
╔══════════════════════════════════════════════════════════════════╗
║         PhD ERP Portal — PUBLIC ACCESS URLs                      ║
╠══════════════════════════════════════════════════════════════════╣
║  🌐 FRONTENDS                                                    ║
║  Portal Dashboard  : ${(portalFe    + '                            ').slice(0,42)} ║
║  Student Portal    : ${(studentFe   + '                            ').slice(0,42)} ║
║  Admin Portal      : ${(adminFe     + '                            ').slice(0,42)} ║
║  Supervisor Portal : ${(supervisorFe+ '                            ').slice(0,42)} ║
║  Center Portal     : ${(centerFe    + '                            ').slice(0,42)} ║
╠══════════════════════════════════════════════════════════════════╣
║  🔧 BACKENDS (API)                                               ║
║  Student API       : ${(studentBe   + '                            ').slice(0,42)} ║
║  Admin API         : ${(adminBe     + '                            ').slice(0,42)} ║
║  Supervisor API    : ${(supervisorBe+ '                            ').slice(0,42)} ║
║  Center API        : ${(centerBe    + '                            ').slice(0,42)} ║
╠══════════════════════════════════════════════════════════════════╣
║  ⚠️  IMPORTANT                                                    ║
║  1. Restart all Vite frontends AFTER this script prints URLs.    ║
║  2. First browser visit to each *.loca.lt URL shows a warning    ║
║     page — click "Click to Submit" once per domain.              ║
║  3. Tunnels are temporary. URLs change every session.            ║
║  Press Ctrl+C to stop all tunnels.                               ║
╚══════════════════════════════════════════════════════════════════╝
`);

  console.log('⚡  Tunnels active. Press Ctrl+C to close.\n');

  // Keep process alive; close tunnels gracefully on SIGINT
  process.on('SIGINT', () => {
    console.log('\n🛑  Closing all tunnels...');
    tunnels.forEach(({ tunnel }) => tunnel.close());
    process.exit(0);
  });
}

main().catch((err) => {
  console.error('Fatal:', err);
  process.exit(1);
});
