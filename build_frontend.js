/**
 * Consolidated Frontend Build Pipeline
 *
 * Usage:
 *   node build_frontend.js                           # dev-mode API URLs (localhost)
 *   node build_frontend.js --production              # production URLs from .env.production
 *   node build_frontend.js --domain https://example.com  # explicit domain
 *
 * Output: ./dist/
 *   dist/           → portal-dashboard  (base /)
 *   dist/admin/     → admin panel       (base /admin/)
 *   dist/student/   → student portal    (base /student/)
 *   dist/supervisor/→ supervisor portal (base /supervisor/)
 *   dist/center/    → center portal     (base /center/)
 */

const { execSync } = require('child_process');
const fs   = require('fs');
const path = require('path');

// ── Parse CLI args ────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isProduction = args.includes('--production') || args.includes('--prod');
const domainArg    = (() => {
  const idx = args.indexOf('--domain');
  return idx !== -1 ? args[idx + 1] : null;
})();

// ── Determine API base URLs ───────────────────────────────────────────────────
let STUDENT_API_URL, ADMIN_API_URL, SUPERVISOR_API_URL, CENTER_API_URL;

if (domainArg) {
  // Explicit domain provided
  const base = domainArg.replace(/\/$/, '');
  STUDENT_API_URL    = `${base}/student`;
  ADMIN_API_URL      = `${base}/admin`;
  SUPERVISOR_API_URL = `${base}/supervisor`;
  CENTER_API_URL     = `${base}/center`;
  console.log(`\n🌐 Building for domain: ${base}`);
} else if (isProduction) {
  // Load from .env.production if present
  const prodEnvPath = path.join(__dirname, '.env.production');
  if (fs.existsSync(prodEnvPath)) {
    require('dotenv').config({ path: prodEnvPath });
  }
  STUDENT_API_URL    = process.env.VITE_STUDENT_API_URL    || 'http://localhost:5000';
  ADMIN_API_URL      = process.env.VITE_ADMIN_API_URL      || 'http://localhost:5001';
  SUPERVISOR_API_URL = process.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002';
  CENTER_API_URL     = process.env.VITE_CENTER_API_URL     || 'http://localhost:5003';
  console.log('\n🚀 Production build — using .env.production API URLs');
} else {
  // Development fallback (localhost)
  STUDENT_API_URL    = process.env.VITE_STUDENT_API_URL    || 'http://localhost:5000';
  ADMIN_API_URL      = process.env.VITE_ADMIN_API_URL      || 'http://localhost:5001';
  SUPERVISOR_API_URL = process.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002';
  CENTER_API_URL     = process.env.VITE_CENTER_API_URL     || 'http://localhost:5003';
  console.log('\n🔧 Development build — using localhost API URLs');
}

console.log(`   Student API    : ${STUDENT_API_URL}`);
console.log(`   Admin API      : ${ADMIN_API_URL}`);
console.log(`   Supervisor API : ${SUPERVISOR_API_URL}`);
console.log(`   Center API     : ${CENTER_API_URL}`);

// ── Build manifest ────────────────────────────────────────────────────────────
const builds = [
  {
    name:     'Portal Dashboard',
    dir:      'portal-dashboard',
    basePath: '/',
    dest:     '',                 // goes to root of dist/
    apiEnv:   {},                 // only uses VITE_STUDENT_API_URL
  },
  {
    name:     'Student Portal',
    dir:      'student/frontend',
    basePath: '/student/',
    dest:     'student',
    apiEnv:   {},
  },
  {
    name:     'Admin Panel',
    dir:      'admin/frontend',
    basePath: '/admin/',
    dest:     'admin',
    apiEnv:   {},
  },
  {
    name:     'Supervisor Portal',
    dir:      'supervisor/frontend',
    basePath: '/supervisor/',
    dest:     'supervisor',
    apiEnv:   {},
  },
  {
    name:     'Center Portal',
    dir:      'center/frontend',
    basePath: '/center/',
    dest:     'center',
    apiEnv:   {},
  },
];

const rootDist = path.join(__dirname, 'dist');

console.log('\n=== Starting Consolidated Frontend Build Pipeline ===');

// ── PHASE 1: Install dependencies ─────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════');
console.log('PHASE 1: Installing dependencies...');
console.log('══════════════════════════════════════════════════');

for (const build of builds) {
  const buildDir = path.join(__dirname, build.dir);
  if (!fs.existsSync(buildDir)) continue;

  const nmPath = path.join(buildDir, 'node_modules');
  if (!fs.existsSync(nmPath)) {
    console.log(`\n📦 Installing: ${build.name} (${build.dir})`);
    try {
      execSync('npm install', { cwd: buildDir, stdio: 'inherit' });
      console.log(`✅ ${build.name} — installed`);
    } catch (err) {
      console.error(`❌ ${build.name} install failed:`, err.message);
      process.exit(1);
    }
  } else {
    console.log(`✅ ${build.name} — dependencies present`);
  }
}

// ── PHASE 2: Clean output directory ──────────────────────────────────────────
if (fs.existsSync(rootDist)) {
  console.log('\n🧹 Cleaning root dist/...');
  fs.rmSync(rootDist, { recursive: true, force: true });
}
fs.mkdirSync(rootDist);

// ── PHASE 3: Build each portal ────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════');
console.log('PHASE 2: Building portals...');
console.log('══════════════════════════════════════════════════');

for (const build of builds) {
  console.log(`\n── ${build.name} (base: ${build.basePath}) ──`);

  const buildDir = path.join(__dirname, build.dir);
  if (!fs.existsSync(buildDir)) {
    console.warn(`⚠️  Directory not found: ${build.dir} — skipping`);
    continue;
  }

  try {
    execSync('npm run build', {
      cwd: buildDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        NODE_ENV:              'production',
        VITE_BASE_PATH:        build.basePath,
        VITE_STUDENT_API_URL:  STUDENT_API_URL,
        VITE_ADMIN_API_URL:    ADMIN_API_URL,
        VITE_SUPERVISOR_API_URL: SUPERVISOR_API_URL,
        VITE_CENTER_API_URL:   CENTER_API_URL,
        VITE_API_URL:          `${STUDENT_API_URL}/api`,
        // Portal dashboard: admin redirect target (same domain in prod)
        VITE_ADMIN_FE_URL:     '',   // empty → same origin, Nginx handles /admin
      },
    });

    const buildOutput = path.join(buildDir, 'dist');
    const destFolder  = path.join(rootDist, build.dest);

    if (build.dest) {
      fs.mkdirSync(destFolder, { recursive: true });
      fs.cpSync(buildOutput, destFolder, { recursive: true });
    } else {
      fs.cpSync(buildOutput, rootDist, { recursive: true });
    }

    console.log(`✅ ${build.name} → dist/${build.dest || '(root)'}`);
  } catch (err) {
    console.error(`❌ ${build.name} build failed:`, err.message);
    process.exit(1);
  }
}

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n══════════════════════════════════════════════════');
console.log('🎉 All portals built into dist/');
console.log('══════════════════════════════════════════════════');
console.log('  dist/               → Portal Dashboard');
console.log('  dist/admin/         → Admin Panel   (/admin)');
console.log('  dist/student/       → Student Portal (/student)');
console.log('  dist/supervisor/    → Supervisor Portal (/supervisor)');
console.log('  dist/center/        → Center Portal (/center)');
if (domainArg || isProduction) {
  console.log('\n📋 Deploy: copy dist/ to /var/www/phd-portal/dist/ on your server');
  console.log('   then run: sudo systemctl reload nginx');
}
