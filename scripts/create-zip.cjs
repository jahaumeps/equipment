const AdmZip = require('adm-zip');
const fs = require('fs');
const path = require('path');

if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

console.log('Packaging project into ZIP...');
try {
  const zip = new AdmZip();

  function addDirectory(dir, zipPath) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
      if (file === 'node_modules' || file === 'dist' || file === '.git' || file.endsWith('.zip') || file.endsWith('.tar.gz')) {
        continue;
      }
      
      const fullPath = path.join(dir, file);
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        addDirectory(fullPath, path.join(zipPath, file));
      } else {
        zip.addLocalFile(fullPath, zipPath);
      }
    }
  }

  addDirectory('.', '');
  zip.writeZip('public/meps-system-source.zip');
  console.log('Successfully created archive at public/meps-system-source.zip');
} catch (error) {
  console.error('Failed to create ZIP archive:', error.message);
}
