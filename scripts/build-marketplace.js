const fs = require('fs');
const path = require('path');

const EXTENSIONS_DIR = path.join(__dirname, '../extensions');
const OUTPUT_FILE = path.join(__dirname, '../assets/marketplace.gen.json');

/**
 * Registry Builder
 * 
 * This script scans the /extensions directory, reads each extension.json,
 * and compiles them into a single registry for the app.
 */

function buildRegistry() {

  if (!fs.existsSync(EXTENSIONS_DIR)) {
    console.error('❌  Extensions directory not found!');
    return;
  }

  const extensions = [];
  const folders = fs.readdirSync(EXTENSIONS_DIR);

  folders.forEach(folder => {
    const manifestPath = path.join(EXTENSIONS_DIR, folder, 'extension.json');

    if (fs.existsSync(manifestPath)) {
      try {
        const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));

        // Basic validation
        if (!manifest.id || !manifest.title) {
          console.warn(`⚠️  Skipping ${folder}: Missing ID or Title`);
          return;
        }

        extensions.push({
          ...manifest,
          folder // Keep track of the folder for dynamic loading later
        });

      } catch (err) {
        console.error(`❌  Error parsing manifest for ${folder}:`, err.message);
      }
    }
  });

  // Ensure assets dir exists
  const assetsDir = path.dirname(OUTPUT_FILE);
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(extensions, null, 2));
}

buildRegistry();
