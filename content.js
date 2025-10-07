(async function captureFullPage() {
  console.log('Starting full page capture');
  try {
    const originalScrollY = window.scrollY;
    const originalOverflow = document.documentElement.style.overflow;
    const url = window.location.href;
    const captureDate = new Date().toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
    console.log('URL:', url);
    console.log('Capture date:', captureDate);
    console.log('Original scroll position:', originalScrollY);

    // Temporarily hide scrollbars
    document.documentElement.style.overflow = 'hidden';
    console.log('Scrollbars hidden');

    // Find navbars
    const navbars = document.querySelectorAll('header, nav, .navbar, .nav, [role="navigation"], [style*="position: fixed"], [style*="position: sticky"]');
    const originalDisplayStyles = [];
    navbars.forEach((navbar, index) => {
      originalDisplayStyles[index] = navbar.style.display;
      console.log(`Found navbar ${index}:`, navbar);
    });

    // Get full dimensions
    const body = document.body;
    const html = document.documentElement;
    let fullHeight = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
    const viewportHeight = window.innerHeight;
    const viewportWidth = window.innerWidth;
    console.log('Full height:', fullHeight, 'Viewport height:', viewportHeight, 'Viewport width:', viewportWidth);

    // Config
    const overlap = 50;
    const scrollStep = viewportHeight - overlap;
    const scrollDelay = 1500;
    const captures = [];
    const maxIterations = 50;
    console.log('Config - Overlap:', overlap, 'Scroll step:', scrollStep, 'Scroll delay:', scrollDelay, 'Max iterations:', maxIterations);

    // Scroll and capture in chunks
    let currentY = 0;
    let iteration = 0;
    let lastCapturedY = -1;
    while (currentY < fullHeight && iteration < maxIterations) {
      if (currentY === lastCapturedY) {
        console.log(`Already captured y=${currentY}, exiting loop`);
        break;
      }
      console.log(`Iteration ${iteration}: Scrolling to y=${currentY}`);

      // Hide navbars only for captures after the first (y > 0)
      if (currentY > 0) {
        navbars.forEach((navbar, index) => {
          navbar.style.display = 'none';
          console.log(`Hid navbar ${index} for y=${currentY}`);
        });
      }

      window.scrollTo(0, currentY);

      // Wait for dynamic content
      console.log(`Waiting ${scrollDelay}ms for dynamic content`);
      await new Promise(resolve => setTimeout(resolve, scrollDelay));

      // Recheck height in case dynamic content loaded
      const newFullHeight = Math.max(body.scrollHeight, body.offsetHeight, html.clientHeight, html.scrollHeight, html.offsetHeight);
      if (newFullHeight > fullHeight) {
        console.log('Height increased to:', newFullHeight);
        fullHeight = newFullHeight;
      }

      // Request capture
      console.log(`Requesting capture at y=${currentY}`);
      const response = await new Promise((resolve, reject) => {
        chrome.runtime.sendMessage({ type: 'capture' }, (response) => {
          if (chrome.runtime.lastError) {
            console.error('Capture error:', chrome.runtime.lastError.message);
            reject(chrome.runtime.lastError);
          } else {
            console.log('Capture received');
            resolve(response);
          }
        });
      });
      captures.push({ dataUrl: response.dataUrl, y: currentY });
      console.log(`Captured segment at y=${currentY}`);
      lastCapturedY = currentY;

      // Restore navbars after capture
      if (currentY > 0) {
        navbars.forEach((navbar, index) => {
          navbar.style.display = originalDisplayStyles[index] || '';
          console.log(`Restored navbar ${index} after capture at y=${currentY}`);
        });
      }

      currentY += scrollStep;
      if (currentY + viewportHeight > fullHeight) {
        console.log('Adjusting final scroll to:', fullHeight - viewportHeight);
        currentY = fullHeight - viewportHeight;
      }
      iteration++;
    }
    console.log('Finished capturing. Total captures:', captures.length, 'Final height:', fullHeight);

    // Restore original state
    window.scrollTo(0, originalScrollY);
    document.documentElement.style.overflow = originalOverflow;
    navbars.forEach((navbar, index) => {
      navbar.style.display = originalDisplayStyles[index] || '';
      console.log(`Restored navbar ${index} for cleanup`);
    });
    console.log('Restored original scroll, overflow, and navbars');

    // Stitch images on canvas
    console.log('Creating canvas for stitching');
    const canvas = document.createElement('canvas');
    canvas.width = viewportWidth;
    canvas.height = fullHeight + 100;
    const ctx = canvas.getContext('2d');

    // Set white background
    console.log('Setting white background on canvas');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw URL and date
    console.log('Drawing URL and date on canvas');
    ctx.fillStyle = '#000';
    ctx.font = '16px Arial';
    ctx.fillText(`URL: ${url}`, 10, 20);
    ctx.fillText(`Captured on: ${captureDate}`, 10, 40);

    // Draw captures
    console.log('Stitching captures');
    for (const { dataUrl, y } of captures) {
      console.log(`Drawing capture at y=${y}`);
      const img = await new Promise(resolve => {
        const image = new Image();
        image.onload = () => {
          console.log(`Image loaded for y=${y}`);
          resolve(image);
        };
        image.onerror = () => console.error(`Failed to load image at y=${y}`);
        image.src = dataUrl;
      });
      const drawY = y + 100;
      const cropHeight = (y + viewportHeight > fullHeight) ? (fullHeight - y) : viewportHeight;
      ctx.drawImage(img, 0, 0, viewportWidth, cropHeight, 0, drawY, viewportWidth, cropHeight);
    }
    console.log('Finished stitching');

    // Navigate to preview page with default format (PNG)
    console.log('Sending dataUrl to background for navigation');
    const finalDataUrl = canvas.toDataURL('image/png');
    console.log('Final dataUrl length:', finalDataUrl.length);
    await new Promise((resolve, reject) => {
      chrome.runtime.sendMessage({
        type: 'navigate',
        dataUrl: finalDataUrl
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error('Navigation error:', chrome.runtime.lastError.message);
          reject(chrome.runtime.lastError);
        } else {
          console.log('Navigation response:', response);
          resolve(response);
        }
      });
    });
    console.log('Navigation request sent');
  } catch (error) {
    console.error('Error in captureFullPage:', error);
  }
})();