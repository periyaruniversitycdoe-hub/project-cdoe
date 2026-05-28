const fs = require('fs');
const path = require('path');

const foldersToScan = [
  'portal-dashboard',
  'student/frontend',
  'admin/frontend',
  'supervisor/frontend',
  'center/frontend'
];

const patterns = [
  // Port 5000 (Student)
  {
    targetSingle: /'import\.meta\.env\.VITE_STUDENT_API_URL \|\| 'http:\/\/localhost:5000'([^']*?)'/g,
    targetDouble: /"import\.meta\.env\.VITE_STUDENT_API_URL \|\| 'http:\/\/localhost:5000'([^"]*?)"/g,
    replacement: "`\${import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000'}$1`"
  },
  // Port 5001 (Admin)
  {
    targetSingle: /'import\.meta\.env\.VITE_ADMIN_API_URL \|\| 'http:\/\/localhost:5001'([^']*?)'/g,
    targetDouble: /"import\.meta\.env\.VITE_ADMIN_API_URL \|\| 'http:\/\/localhost:5001'([^"]*?)"/g,
    replacement: "`\${import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001'}$1`"
  },
  // Port 5002 (Supervisor)
  {
    targetSingle: /'import\.meta\.env\.VITE_SUPERVISOR_API_URL \|\| 'http:\/\/localhost:5002'([^']*?)'/g,
    targetDouble: /"import\.meta\.env\.VITE_SUPERVISOR_API_URL \|\| 'http:\/\/localhost:5002'([^"]*?)"/g,
    replacement: "`\${import.meta.env.VITE_SUPERVISOR_API_URL || 'http://localhost:5002'}$1`"
  },
  // Port 5003 (Center)
  {
    targetSingle: /'import\.meta\.env\.VITE_CENTER_API_URL \|\| 'http:\/\/localhost:5003'([^']*?)'/g,
    targetDouble: /"import\.meta\.env\.VITE_CENTER_API_URL \|\| 'http:\/\/localhost:5003'([^"]*?)"/g,
    replacement: "`\${import.meta.env.VITE_CENTER_API_URL || 'http://localhost:5003'}$1`"
  }
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

let fixedCount = 0;

console.log('Fixing mangled quotes in all frontend files...');

foldersToScan.forEach(folder => {
  const folderPath = path.join(__dirname, folder);
  if (!fs.existsSync(folderPath)) return;

  walkDir(folderPath, filePath => {
    const ext = path.extname(filePath);
    if (['.js', '.jsx', '.ts', '.tsx'].includes(ext)) {
      let content = fs.readFileSync(filePath, 'utf8');
      let modified = false;

      patterns.forEach(p => {
        if (content.match(p.targetSingle)) {
          content = content.replace(p.targetSingle, p.replacement);
          modified = true;
        }
        if (content.match(p.targetDouble)) {
          content = content.replace(p.targetDouble, p.replacement);
          modified = true;
        }
      });

      if (modified) {
        fs.writeFileSync(filePath, content, 'utf8');
        fixedCount++;
        console.log(`Fixed: ${path.relative(__dirname, filePath)}`);
      }
    }
  });
});

console.log(`\nFixed ${fixedCount} files successfully!`);
