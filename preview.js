console.log('Preview: Initializing');

function fetchDataUrl(attempt = 1, maxAttempts = 3) {
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
      preview.alt = 'Error: Could not load screenshot';
    }
  });
}

fetchDataUrl();

// Download as PDF
document.getElementById('downloadButton').addEventListener('click', () => {
  console.log('Preview: Download button clicked');
  if (!window.jspdf || !window.jspdf.jsPDF) {
    console.error('Preview: jsPDF not loaded');
    alert('Error: PDF generation library not loaded. Please try again.');
    return;
  }
  const img = document.getElementById('preview');
  if (!img.src || !img.src.startsWith('data:image/')) {
    console.error('Preview: No valid image source for PDF');
    alert('Error: No screenshot available to convert to PDF.');
    return;
  }
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({
    orientation: img.width > img.height ? 'landscape' : 'portrait',
    unit: 'px',
    format: [img.width, img.height]
  });
  pdf.addImage(img.src, 'JPEG', 0, 0, img.width, img.height);
  pdf.save(`screenshot-${new Date().toISOString().split('T')[0]}.pdf`);
});