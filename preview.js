console.log('Preview: Initializing');

function fetchDataUrl(attempt = 1, maxAttempts = 5) {
  console.log('Preview: Fetching dataUrl, attempt:', attempt);
  chrome.runtime.sendMessage({ type: 'getDataUrl' }, (response) => {
    console.log('Preview: Received response:', response);
    const preview = document.getElementById('preview');
    const errorMessage = document.getElementById('errorMessage');
    if (response && response.dataUrl && response.dataUrl.startsWith('data:image/')) {
      console.log('Preview: Set image src, dataUrl length:', response.dataUrl.length);
      preview.src = response.dataUrl;
      errorMessage.textContent = '';
    } else if (attempt < maxAttempts) {
      console.error('Preview: No valid dataUrl received, retrying attempt', attempt);
      setTimeout(() => fetchDataUrl(attempt + 1, maxAttempts), 1000);
    } else {
      console.error('Preview: No valid dataUrl received after', maxAttempts, 'attempts');
      preview.alt = 'Error: Could not load screenshot. Please try again.';
      errorMessage.textContent = 'Error: Could not load screenshot. Please try again.';
    }
  });
}

fetchDataUrl();

// Download handler
document.getElementById('downloadButton').addEventListener('click', () => {
  handleDownload();
});

// Keyboard support for download button
document.getElementById('downloadButton').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    handleDownload();
  }
});

// Keyboard support for format dropdown
document.getElementById('format').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    // Trigger dropdown open (browser handles native select)
  }
});

// Keyboard support for multi-page checkbox
document.getElementById('multiPage').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    e.preventDefault();
    e.target.checked = !e.target.checked;
    console.log('Preview: Multi-page checkbox toggled to:', e.target.checked);
  }
});

// Update quality value for accessibility
document.getElementById('quality').addEventListener('input', (e) => {
  const qualityValue = document.getElementById('qualityValue');
  qualityValue.textContent = e.target.value;
  e.target.setAttribute('aria-valuenow', e.target.value);
});

// Show/hide quality slider and multi-page checkbox based on format
document.getElementById('format').addEventListener('change', (e) => {
  const qualityInput = document.getElementById('quality');
  const qualityValue = document.getElementById('qualityValue');
  const multiPageInput = document.getElementById('multiPage');
  qualityInput.style.display = e.target.value === 'jpeg' ? 'inline-block' : 'none';
  qualityValue.style.display = e.target.value === 'jpeg' ? 'inline-block' : 'none';
  multiPageInput.style.display = e.target.value === 'pdf' ? 'inline-block' : 'none';
});

// Set default filename with date
document.getElementById('filename').value = `screenshot-${new Date().toISOString().split('T')[0]}`;

// Download logic
function handleDownload() {
  console.log('Preview: Download button clicked');
  const img = document.getElementById('preview');
  const format = document.getElementById('format').value;
  const quality = parseFloat(document.getElementById('quality').value);
  const multiPage = document.getElementById('multiPage').checked;
  let filename = document.getElementById('filename').value.trim();
  const errorMessage = document.getElementById('errorMessage');
  if (!filename) {
    filename = 'screenshot';
  }
  const date = new Date().toISOString().split('T')[0];

  if (!img.src || !img.src.startsWith('data:image/')) {
    console.error('Preview: No valid image source');
    errorMessage.textContent = 'Error: No screenshot available to download. Please try again.';
    return;
  }

  console.log('Preview: Image dimensions:', img.naturalWidth, img.naturalHeight);

  if (format === 'pdf') {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      console.error('Preview: jsPDF not loaded');
      errorMessage.textContent = 'Error: PDF generation library not loaded. Please try again.';
      return;
    }
    console.log('Preview: Generating PDF, multiPage:', multiPage);
    generateMultiPagePdf(img, multiPage, filename, date, errorMessage);
  } else {
    console.log('Preview: Initiating download for', format);
    const ext = format === 'jpeg' ? 'jpg' : 'png';
    const dataUrl = format === 'jpeg' ? convertToJpeg(img.src, quality) : img.src;
    chrome.runtime.sendMessage({
      type: 'download',
      dataUrl: dataUrl,
      filename: `${filename}-${date}.${ext}`
    }, (response) => {
      if (response && response.error) {
        console.error('Preview: Download error:', response.error);
        errorMessage.textContent = 'Error: Could not download file. Please try again.';
      } else {
        console.log('Preview: Download initiated');
      }
    });
  }
}

// Generate multi-page PDF with A4 splitting, no distortion, high quality
function generateMultiPagePdf(img, multiPage, filename, date, errorMessage) {
  const { jsPDF } = window.jspdf;
  const a4Width = 595; // A4 width in pixels at 72 DPI
  const a4Height = 842; // A4 height in pixels at 72 DPI
  const margin = 20; // 20px margins like GoFullPage
  const contentWidth = a4Width - 2 * margin; // Width after margins
  const contentHeight = a4Height - 2 * margin; // Height after margins
  const imgWidth = img.naturalWidth;
  const imgHeight = img.naturalHeight;
  const scale = contentWidth / imgWidth; // Scale for width fit, maintain aspect ratio
  const scaledHeight = imgHeight * scale;

  console.log('Preview: Original dimensions:', imgWidth, imgHeight);
  console.log('Preview: Scale:', scale, 'Scaled height:', scaledHeight);
  console.log('Preview: Content dimensions with margins:', contentWidth, contentHeight);

  // Create scaled canvas for the full image at higher resolution
  const dpiScale = 2; // 144 DPI for better quality
  const highResWidth = contentWidth * dpiScale;
  const highResHeight = scaledHeight * dpiScale;
  const scaledCanvas = document.createElement('canvas');
  scaledCanvas.width = highResWidth;
  scaledCanvas.height = highResHeight;
  const scaledCtx = scaledCanvas.getContext('2d');
  scaledCtx.imageSmoothingEnabled = false; // Disable smoothing for sharp edges
  scaledCtx.imageSmoothingQuality = 'high'; // High quality if smoothing is needed
  scaledCtx.drawImage(img, 0, 0, highResWidth, highResHeight); // Draw at higher resolution

  const pdf = new jsPDF({
    orientation: scaledHeight > contentHeight ? 'portrait' : 'landscape',
    unit: 'px',
    format: [a4Width, a4Height]
  });
  pdf.internal.scaleFactor = dpiScale; // Increase DPI for sharper output

  if (multiPage && scaledHeight > contentHeight) {
    console.log('Preview: Generating multi-page PDF');
    const pages = Math.ceil(scaledHeight / contentHeight);
    console.log('Preview: Total pages:', pages);

    for (let i = 0; i < pages; i++) {
      const pageY = i * contentHeight; // Y position in scaled image
      const pageHeight = Math.min(contentHeight, scaledHeight - pageY);

      if (pageHeight <= 0) {
        console.log('Preview: Skipping empty page at index:', i);
        break;
      }

      // Create page-specific canvas for clipping at high resolution
      const pageCanvas = document.createElement('canvas');
      pageCanvas.width = highResWidth;
      pageCanvas.height = pageHeight * dpiScale;
      const pageCtx = pageCanvas.getContext('2d');
      pageCtx.imageSmoothingEnabled = false;
      pageCtx.imageSmoothingQuality = 'high';

      // Clip and draw the page segment from scaled canvas
      pageCtx.drawImage(
        scaledCanvas,
        0, pageY * dpiScale, // Source clip: full width, pageY to pageY + pageHeight
        highResWidth, pageHeight * dpiScale,
        0, 0, // Destination: top-left of page canvas
        highResWidth, pageHeight * dpiScale // Destination size: full content width/height at high res
      );

      console.log('Preview: Adding page', i + 1, 'pageY:', pageY, 'pageHeight:', pageHeight);

      // Generate high-quality PNG data URL
      const pageDataUrl = pageCanvas.toDataURL('image/png', 1.0); // Lossless PNG at full quality

      // Add to PDF with margins and high-quality alias
      pdf.addImage(pageDataUrl, 'PNG', margin, margin, contentWidth, contentHeight, undefined, 'SLOW');

      if (i < pages - 1) {
        pdf.addPage();
      }
    }
  } else {
    console.log('Preview: Generating single-page PDF');
    // For single-page, clip to content height if taller
    const pageHeight = Math.min(contentHeight, scaledHeight);
    const pageCanvas = document.createElement('canvas');
    pageCanvas.width = highResWidth;
    pageCanvas.height = pageHeight * dpiScale;
    const pageCtx = pageCanvas.getContext('2d');
    pageCtx.imageSmoothingEnabled = false;
    pageCtx.imageSmoothingQuality = 'high';
    pageCtx.drawImage(scaledCanvas, 0, 0, highResWidth, pageHeight * dpiScale);
    const pageDataUrl = pageCanvas.toDataURL('image/png', 1.0);
    pdf.addImage(pageDataUrl, 'PNG', margin, margin, contentWidth, contentHeight, undefined, 'SLOW');
  }

  pdf.save(`${filename}-${date}.pdf`);
}

// Convert PNG dataUrl to JPEG with specified quality
function convertToJpeg(dataUrl, quality) {
  console.log('Preview: Converting to JPEG with quality:', quality);
  const canvas = document.createElement('canvas');
  const img = new Image();
  img.src = dataUrl;
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}