// Puppeteer script to generate PDF from HTML templates
// Usage: node scripts/render_pdf.js <input.html> <output.pdf>

const puppeteer = require('puppeteer');
const path = require('path');

async function renderPDF(inputPath, outputPath) {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();

  // Load the HTML file
  const fileUrl = `file://${path.resolve(inputPath)}`;
  await page.goto(fileUrl, { waitUntil: 'networkidle0' });

  // Generate PDF
  await page.pdf({
    path: outputPath,
    format: 'Letter',
    printBackground: true,
    margin: {
      top: '0.5in',
      right: '0.5in',
      bottom: '0.5in',
      left: '0.5in'
    }
  });

  await browser.close();
  console.log(`PDF saved to ${outputPath}`);
}

// CLI interface
if (require.main === module) {
  const args = process.argv.slice(2);
  if (args.length !== 2) {
    console.error('Usage: node scripts/render_pdf.js <input.html> <output.pdf>');
    process.exit(1);
  }

  const [inputPath, outputPath] = args;
  renderPDF(inputPath, outputPath).catch(console.error);
}

module.exports = { renderPDF };
