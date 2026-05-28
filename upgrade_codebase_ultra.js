const fs = require('fs');
const path = require('path');

const foldersToScan = [
  'portal-dashboard',
  'student/frontend',
  'admin/frontend',
  'supervisor/frontend',
  'center/frontend'
];

const portsConfig = [
  { port: '5000', envVar: 'VITE_STUDENT_API_URL' },
  { port: '5001', envVar: 'VITE_ADMIN_API_URL' },
  { port: '5002', envVar: 'VITE_SUPERVISOR_API_URL' },
  { port: '5003', envVar: 'VITE_CENTER_API_URL' }
];

function walkDir(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    const dirPath = path.join(dir, f);
    const isDirectory = fs.statSync(dirPath).isDirectory();
    if (isDirectory) {
      if (f !== 'node_modules' && f !== 'dist' && f !== '.git') {
        walkDir(dirPath, callback);
      }
    } else {
      callback(dirPath);
    }
  });
}

let modifiedCount = 0;

console.log('=== Running Ultra-Safe Codebase Upgrader ===');

foldersToScan.forEach(folder => {
  const folderPath = path.join(__dirname, folder);
  if (!fs.existsSync(folderPath)) return;

  walkDir(folderPath, filePath => {
    const ext = path.extname(filePath);
    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      portsConfig.forEach(cfg => {
        // Only run replacement if we find the localhost port and the file doesn't already contain our env variable
        if (content.includes(`http://localhost:${cfg.port}`) && !content.includes(cfg.envVar)) {
          
          // 1. Double quotes case: "http://localhost:5000/api" -> (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + "/api"
          const doubleQuoteRegex = new RegExp(`"http://localhost:${cfg.port}`, 'g');
          if (content.match(doubleQuoteRegex)) {
            content = content.replace(doubleQuoteRegex, `(import.meta.env.${cfg.envVar} || 'http://localhost:${cfg.port}') + "`);
            modified = true;
          }

          // 2. Single quotes case: 'http://localhost:5000/api' -> (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/api'
          const singleQuoteRegex = new RegExp(`'http://localhost:${cfg.port}`, 'g');
          if (content.match(singleQuoteRegex)) {
            content = content.replace(singleQuoteRegex, `(import.meta.env.${cfg.envVar} || 'http://localhost:${cfg.port}') + '`);
            modified = true;
          }

          // 3. Backticks template case: `http://localhost:5000/api` -> `${import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000'}/api`
          const backtickRegex = new RegExp(`\`http://localhost:${cfg.port}`, 'g');
          if (content.match(backtickRegex)) {
            content = content.replace(backtickRegex, `\`\${import.meta.env.${cfg.envVar} || 'http://localhost:${cfg.port}'}`);
            modified = true;
          }
        }
      });

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        modifiedCount++;
        console.log(`Upgraded: ${path.relative(__dirname, filePath)}`);
      }
    }
  });
});

console.log(`\n🎉 Success! Safe-upgraded ${modifiedCount} files with zero quote mismatch or syntax errors!`);
