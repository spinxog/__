// Puppeteer script to generate PNG screenshots from HTML templates
// Usage: node scripts/screenshot.js <input.html> <output.png>

const puppeteer = require('puppeteer');
const path = require('path');

async function screenshot(inputPath, outputPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Set viewport to 1920x1080 for consistent screenshots
  await page.setViewport({
    width: 1920,
    height: 1080,
    deviceScaleFactor: 1,
  });

  // Load the HTML file
  const fileUrl = `file://${path.resolve(inputPath)}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // Take screenshot
  await page.screenshot({
    path: outputPath,
    fullPage: true,
    type: 'png'
  });

  await browser.close();
  console.log(`Screenshot saved to ${outputPath}`);
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('Usage: node scripts/screenshot.js <input.html> <output.png>');
    process.exit(1);
  }

  const [inputPath, outputPath] = args;
  screenshot(inputPath, outputPath).catch(console.error);
}

module.exports = { screenshot };
