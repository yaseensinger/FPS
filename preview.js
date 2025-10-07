console.log('Preview: Initializing');

function fetchDataUrl(attempt = 1, maxAttempts = 5) {
  console.log('Preview: Fetching dataUrl, attempt:', attempt);
  chrome.runtime.sendMessage({ type: 'getDataUrl' }, (response) => {
    console.log('Preview: Received response:', response);
    const preview = document.getElementById('preview');
    if (response && response.dataUrl && response.dataUrl.startsWith('data:image/')) {
      console.log('Preview: Set image src, dataUrl length:', response.dataUrl.length);
      preview.src = response.dataUrl;
    } else if (attempt < maxAttempts) {
      console.error('Preview: No valid dataUrl received, retrying attempt', attempt);
      setTimeout(() => fetchDataUrl(attempt + 1, maxAttempts), 1000);
    } else {
      console.error('Preview: No valid dataUrl received after', maxAttempts, 'attempts');
      preview.alt = 'Error: Could not load screenshot. Please try again.';
      document.getElementById('errorMessage').textContent = 'Error: Could not load screenshot. Please try again.';
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

// Update quality value for accessibility
document.getElementById('quality').addEventListener('input', (e) => {
  const qualityValue = document.getElementById('qualityValue');
  qualityValue.textContent = e.target.value;
  e.target.setAttribute('aria-valuenow', e.target.value);
});

// Show/hide quality slider based on format
document.getElementById('format').addEventListener('change', (e) => {
  const qualityInput = document.getElementById('quality');
  qualityInput.style.display = e.target.value === 'jpeg' ? 'inline-block' : 'none';
});

// Set default filename with date
document.getElementById('filename').value = `screenshot-${new Date().toISOString().split('T')[0]}`;

// Download logic
function handleDownload() {
  console.log('Preview: Download button clicked');
  const img = document.getElementById('preview');
  const format = document.getElementById('format').value;
  const quality = parseFloat(document.getElementById('quality').value);
  let filename = document.getElementById('filename').value.trim();
  if (!filename) {
    filename = 'screenshot';
  }
  const date = new Date().toISOString().split('T')[0];

  if (!img.src || !img.src.startsWith('data:image/')) {
    console.error('Preview: No valid image source');
    document.getElementById('errorMessage').textContent = 'Error: No screenshot available to download. Please try again.';
    return;
  }

  if (format === 'pdf') {
    if (!window.jspdf || !window.jspdf.jsPDF) {
      console.error('Preview: jsPDF not loaded');
      document.getElementById('errorMessage').textContent = 'Error: PDF generation library not loaded. Please try again.';
      return;
    }
    console.log('Preview: Generating PDF');
    const { jsPDF } = window.jspdf;
    const pdf = new jsPDF({
      orientation: img.naturalWidth > img.naturalHeight ? 'landscape' : 'portrait',
      unit: 'px',
      format: [img.naturalWidth, img.naturalHeight]
    });
    pdf.addImage(img.src, 'PNG', 0, 0, img.naturalWidth, img.naturalHeight);
    pdf.save(`${filename}-${date}.pdf`);
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
        document.getElementById('errorMessage').textContent = 'Error: Could not download file. Please try again.';
      } else {
        console.log('Preview: Download initiated');
      }
    });
  }
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
  ctx.drawImage(img, 0, 0);
  return canvas.toDataURL('image/jpeg', quality);
}