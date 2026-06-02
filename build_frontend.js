const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const rootDist = path.join(__dirname, 'dist');

console.log('=== Starting Consolidated Frontend Build Pipeline ===');

// 1. Clean root dist folder
if (fs.existsSync(rootDist)) {
  console.log('Cleaning up existing root dist folder...');
  fs.rmSync(rootDist, { recursive: true, force: true });
}
fs.mkdirSync(rootDist);

const builds = [
  { name: 'Portal Dashboard', dir: 'portal-dashboard', basePath: '/', dest: '' },
  { name: 'Student Portal', dir: 'student/frontend', basePath: '/student/', dest: 'student' },
  { name: 'Admin Panel', dir: 'admin/frontend', basePath: '/admin/', dest: 'admin' },
  { name: 'Supervisor Portal', dir: 'supervisor/frontend', basePath: '/supervisor/', dest: 'supervisor' },
  { name: 'Center Portal', dir: 'center/frontend', basePath: '/center/', dest: 'center' }
];

// PHASE 1: Install dependencies for ALL portals first.
// This is critical because the Admin Panel references files in Supervisor & Center,
// meaning their respective node_modules folders must be present to resolve imports like 'react'!
console.log('\n==================================================');
console.log('PHASE 1: Installing dependencies for all frontends...');
console.log('==================================================');

builds.forEach(build => {
  const buildDir = path.join(__dirname, build.dir);
  if (!fs.existsSync(buildDir)) return;

  const nodeModulesPath = path.join(buildDir, 'node_modules');
  if (!fs.existsSync(nodeModulesPath)) {
    console.log(`\n📦 Installing dependencies for ${build.name} in ${build.dir}...`);
    try {
      execSync('npm install', {
        cwd: buildDir,
        stdio: 'inherit'
      });
      console.log(`✅ ${build.name} dependencies installed successfully!`);
    } catch (err) {
      console.error(`❌ Error installing dependencies for ${build.name}:`, err.message);
      process.exit(1);
    }
  } else {
    console.log(`✅ ${build.name} dependencies are already present.`);
  }
});

// PHASE 2: Build each frontend portal sequentially
console.log('\n==================================================');
console.log('PHASE 2: Compiling and consolidating frontends...');
console.log('==================================================');

builds.forEach(build => {
  console.log(`\n--- Building ${build.name} (Base path: ${build.basePath}) ---`);

  const buildDir = path.join(__dirname, build.dir);
  if (!fs.existsSync(buildDir)) {
    console.warn(`Warning: Directory ${build.dir} does not exist. Skipping...`);
    return;
  }

  // Execute build command with dynamic environment base path
  try {
    execSync('npm run build', {
      cwd: buildDir,
      stdio: 'inherit',
      env: {
        ...process.env,
        VITE_BASE_PATH: build.basePath,
        VITE_STUDENT_API_URL: 'https://project-cdoe.onrender.com/student',
        VITE_ADMIN_API_URL: 'https://project-cdoe.onrender.com/admin',
        VITE_SUPERVISOR_API_URL: 'https://project-cdoe.onrender.com/supervisor',
        VITE_CENTER_API_URL: 'https://project-cdoe.onrender.com/center',
        VITE_API_URL: 'https://project-cdoe.onrender.com/student/api'
      }
    });

    console.log(`Copying build output to consolidated folder...`);
    const buildOutput = path.join(buildDir, 'dist');
    const destFolder = path.join(rootDist, build.dest);

    if (build.dest) {
      fs.mkdirSync(destFolder, { recursive: true });
      fs.cpSync(buildOutput, destFolder, { recursive: true });
    } else {
      // For the root landing portal-dashboard, copy contents directly to root dist
      fs.cpSync(buildOutput, rootDist, { recursive: true });
    }

    console.log(`✅ ${build.name} build successfully consolidated!`);
  } catch (err) {
    console.error(`❌ Error building ${build.name}:`, err.message);
    process.exit(1);
  }
});

// 3. Create Netlify _redirects file at the root dist
console.log('\nCreating Netlify routing config (_redirects) in dist folder...');
const redirectsContent = `
/student/*  /student/index.html  200
/admin/*    /admin/index.html    200
/supervisor/*  /supervisor/index.html  200
/center/*   /center/index.html   200
/*          /index.html          200
`;
fs.writeFileSync(path.join(rootDist, '_redirects'), redirectsContent.trim(), 'utf8');

console.log('\n🎉 ALL Frontends built and combined into the root "dist/" directory successfully!');
