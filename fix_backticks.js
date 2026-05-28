const fs = require('fs');
const path = require('path');

const filesToFix = [
  'portal-dashboard/src/pages/LandingPage.jsx',
  'student/frontend/src/pages/LandingPage.jsx',
  'student/frontend/src/pages/Register.jsx',
  'student/frontend/src/pages/VerifyOtp.jsx',
  'student/frontend/src/pages/StudentHome.jsx',
  'student/frontend/src/pages/ResetPassword.jsx',
  'student/frontend/src/pages/Login.jsx',
  'student/frontend/src/pages/HallTicket.jsx',
  'student/frontend/src/pages/ForgotPassword.jsx',
  'student/frontend/src/pages/Dashboard.jsx',
  'student/frontend/src/components/Header.jsx',
  'student/frontend/src/components/layout/Layout.jsx',
  'admin/frontend/src/pages/VerifyOtp.jsx',
  'admin/frontend/src/pages/Settings.jsx',
  'admin/frontend/src/pages/ResetPassword.jsx',
  'admin/frontend/src/pages/PortalHomeManagement.jsx',
  'admin/frontend/src/pages/PartTimeConfigurations.jsx',
  'admin/frontend/src/pages/Login.jsx',
  'admin/frontend/src/pages/JoiningLetterPrint.jsx',
  'admin/frontend/src/pages/HallTicketPrint.jsx',
  'admin/frontend/src/pages/ForgotPassword.jsx'
];

console.log('=== Starting Image URL Literal Backtick Fixes ===\n');

filesToFix.forEach(relPath => {
  const fullPath = path.join(__dirname, relPath);
  if (!fs.existsSync(fullPath)) {
    console.log(`⚠️ File not found, skipping: ${relPath}`);
    return;
  }

  let content = fs.readFileSync(fullPath, 'utf8');
  let originalContent = content;

  // 1. Fix Student portal VITE_STUDENT_API_URL wrappers
  // Replace: `((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '')${settings.logo}`
  // with:    ((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000')) + settings.logo
  content = content.replace(/`\(\(import\.meta\.env\.VITE_STUDENT_API_URL \|\| 'http:\/\/localhost:5000'\) \+ ''\)\$\{([^}]+)\}`/g, 
    "(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + $1");

  // Replace: `((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '')/${cleanPath}`
  // with:    ((import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000')) + '/' + cleanPath
  content = content.replace(/`\(\(import\.meta\.env\.VITE_STUDENT_API_URL \|\| 'http:\/\/localhost:5000'\) \+ ''\)\/\$\{([^}]+)\}`/g, 
    "(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + '/' + $1");

  // Replace: `(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + ''${path}`
  // with:    (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + path
  content = content.replace(/`\(import\.meta\.env\.VITE_STUDENT_API_URL \|\| 'http:\/\/localhost:5000'\) \+ ''\$\{([^}]+)\}`/g, 
    "(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + $1");

  // Replace: `(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + ''${univSettings.logo}`
  // with:    (import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + univSettings.logo
  content = content.replace(/`\(import\.meta\.env\.VITE_STUDENT_API_URL \|\| 'http:\/\/localhost:5000'\) \+ ''\$\{([^}]+)\}`/g, 
    "(import.meta.env.VITE_STUDENT_API_URL || 'http://localhost:5000') + $1");

  // 2. Fix Admin portal VITE_ADMIN_API_URL wrappers
  // Replace: `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001')${settings.logo}`
  // with:    (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + settings.logo
  content = content.replace(/`\(import\.meta\.env\.VITE_ADMIN_API_URL \|\| 'http:\/\/localhost:5001'\)\$\{([^}]+)\}`/g, 
    "(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + $1");

  // Replace: `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/part-time-configurations/global-guidance/preview?token=${...}`
  // with:    (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/part-time-configurations/global-guidance/preview?token=' + ...
  content = content.replace(/`\(import\.meta\.env\.VITE_ADMIN_API_URL \|\| 'http:\/\/localhost:5001'\) \+ '\/api\/part-time-configurations\/global-guidance\/preview\?token=\$\{([^}]+)\}'`/g, 
    "(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/part-time-configurations/global-guidance/preview?token=' + $1");

  // Replace: `(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/portal-home/prospectus/download`
  // with:    (import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/portal-home/prospectus/download'
  content = content.replace(/`\(import\.meta\.env\.VITE_ADMIN_API_URL \|\| 'http:\/\/localhost:5001'\) \+ '\/api\/portal-home\/prospectus\/download`/g, 
    "(import.meta.env.VITE_ADMIN_API_URL || 'http://localhost:5001') + '/api/portal-home/prospectus/download'");

  if (content !== originalContent) {
    fs.writeFileSync(fullPath, content, 'utf8');
    console.log(`✅ Successfully fixed: ${relPath}`);
  } else {
    console.log(`ℹ️ Already clean / no changes needed: ${relPath}`);
  }
});

console.log('\n==================================================');
console.log('🎉 Image URL backtick wrapping corrections complete!');
console.log('==================================================');
