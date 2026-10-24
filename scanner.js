/**
 * scanner.js
 * Single responsibility: Sandboxed iframe management, injects axe-core 4.14.0 CDN, runs axe on iframe.contentDocument.
 * The pasted page's own <html> tag must be the one scanned directly without any wrapper template.
 */

import { runCustomChecks } from './customChecks.js';

// axe-core 4.14.0 CDN endpoints
const AXE_CDN_URL = 'https://cdn.jsdelivr.net/npm/axe-core@4.14.0/axe.min.js';
const AXE_CDN_FALLBACK = 'https://unpkg.com/axe-core@4.14.0/axe.min.js';

/**
 * Executes accessibility scanning on the provided sanitized HTML string inside a sandboxed iframe.
 * Sets iframe.srcdoc directly to sanitizedHtml (no wrapper template).
 * Runs axe and customChecks directly on iframe.contentDocument.
 * 
 * @param {string} sanitizedHtml - HTML to scan (already sanitized).
 * @returns {Promise<{ violations: Array<Object> }>}
 */
export async function runAxeScan(sanitizedHtml) {
  return new Promise((resolve, reject) => {
    try {
      const iframe = document.createElement('iframe');
      iframe.className = 'sandbox-iframe';
      iframe.setAttribute('title', 'Accessibility Scanner Sandbox');
      iframe.setAttribute('sandbox', 'allow-scripts allow-same-origin');
      iframe.style.position = 'fixed';
      iframe.style.top = '-9999px';
      iframe.style.left = '-9999px';
      iframe.style.width = '1024px';
      iframe.style.height = '768px';
      iframe.style.border = 'none';
      iframe.style.opacity = '0';
      iframe.style.pointerEvents = 'none';

      const scanTimeout = setTimeout(() => {
        cleanup();
        reject(new Error('Scanning timed out after 15 seconds. Please try again.'));
      }, 15000);

      function cleanup() {
        clearTimeout(scanTimeout);
        try {
          if (iframe.parentNode) {
            iframe.parentNode.removeChild(iframe);
          }
        } catch (cleanupErr) {
          console.warn('Sandbox cleanup warning:', cleanupErr);
        }
      }

      // Exact pasted HTML without template wrapper
      iframe.srcdoc = sanitizedHtml;

      iframe.onload = async () => {
        try {
          const iframeDoc = iframe.contentDocument || iframe.contentWindow?.document;
          if (!iframeDoc) {
            throw new Error('Unable to access sandbox iframe document.');
          }

          async function executeScanOnDocument() {
            const axeInstance = iframe.contentWindow?.axe;
            if (!axeInstance || typeof axeInstance.run !== 'function') {
              throw new Error('axe-core 4.14.0 failed to initialize in sandbox.');
            }

            // Run axe directly on iframe.contentDocument (pasted page's own <html> tag)
            const results = await axeInstance.run(iframeDoc, {
              runOnly: {
                type: 'tag',
                values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']
              }
            });

            // Run deterministic custom checks directly on iframe.contentDocument
            const customViolations = runCustomChecks(iframeDoc);

            // Merge violations
            const allViolations = [...(results.violations || []), ...customViolations];

            cleanup();
            resolve({
              violations: allViolations
            });
          }

          // Inject axe-core 4.14.0 script into iframe
          const axeScript = iframeDoc.createElement('script');
          axeScript.src = AXE_CDN_URL;

          const targetHost = iframeDoc.head || iframeDoc.documentElement || iframeDoc.body;
          if (!targetHost) {
            throw new Error('No target element found in iframe document to mount scanner.');
          }

          axeScript.onload = async () => {
            try {
              await executeScanOnDocument();
            } catch (err) {
              cleanup();
              reject(err);
            }
          };

          axeScript.onerror = () => {
            console.warn('Primary axe CDN failed, attempting fallback...');
            const fallbackScript = iframeDoc.createElement('script');
            fallbackScript.src = AXE_CDN_FALLBACK;
            fallbackScript.onload = async () => {
              try {
                await executeScanOnDocument();
              } catch (err) {
                cleanup();
                reject(err);
              }
            };
            fallbackScript.onerror = () => {
              cleanup();
              reject(new Error('Failed to load axe-core 4.14.0 from CDN. Please check your network connection.'));
            };
            targetHost.appendChild(fallbackScript);
          };

          targetHost.appendChild(axeScript);
        } catch (loadErr) {
          cleanup();
          reject(loadErr);
        }
      };

      document.body.appendChild(iframe);
    } catch (outerErr) {
      reject(outerErr);
    }
  });
}
