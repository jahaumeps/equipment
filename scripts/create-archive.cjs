const { execSync } = require('child_process');
const fs = require('fs');

if (!fs.existsSync('public')) {
  fs.mkdirSync('public', { recursive: true });
}

console.log('Packaging project...');
try {
  // Using tar since it's universally available on linux containers
  // excluding heavy generated folders
  execSync('tar -czvf public/meps-system-source.tar.gz --exclude=node_modules --exclude=dist --exclude=.git --exclude=public/meps-system-source.tar.gz .');
  console.log('Successfully created archive at public/meps-system-source.tar.gz');
} catch (error) {
  console.error('Failed to create archive:', error.message);
}
