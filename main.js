/**
 * main.js
 * Single responsibility: Wires gate checkbox, validation, secure file upload, export report, sample fetch, 200 KB limit check, and execution flow.
 * Strict adherence to try/catch on every async boundary and no innerHTML.
 */

import { sanitizeHtml } from './sanitize.js';
import { runAxeScan } from './scanner.js';
import { getIssueExplanation } from './geminiClient.js';
import { renderStatus, renderResults, clearContainer } from './render.js';

const MAX_INPUT_BYTES = 200 * 1024; // 200 KB max input check

// DOM Elements
const gateCheckbox = document.getElementById('gate-checkbox');
const htmlInput = document.getElementById('html-input');
const charCounter = document.getElementById('char-counter');
const runBtn = document.getElementById('run-btn');
const uploadBtn = document.getElementById('upload-btn');
const fileUpload = document.getElementById('file-upload');
const sampleBtn = document.getElementById('sample-btn');
const clearBtn = document.getElementById('clear-btn');
const exportBtn = document.getElementById('export-btn');
const statusBanner = document.getElementById('status-banner');
const resultsContainer = document.getElementById('results-container');

let mappingData = null;
let lastViolations = [];
let lastExplanationsMap = new Map();

/**
 * Loads WCAG 2.2 mapping data from mapping.json.
 */
async function loadMappingData() {
  try {
    const res = await fetch('./mapping.json');
    if (res.ok) {
      mappingData = await res.json();
    }
  } catch (err) {
    console.warn('Failed to load mapping.json:', err);
  }
}

/**
 * Updates the byte counter display and validates input length.
 */
function updateCounter() {
  try {
    const text = htmlInput.value || '';
    const bytes = new Blob([text]).size;
    const kb = (bytes / 1024).toFixed(1);

    charCounter.textContent = `${kb} KB / 200 KB`;

    if (bytes > MAX_INPUT_BYTES) {
      charCounter.style.color = '#E85A1F';
    } else {
      charCounter.style.color = '';
    }
  } catch (err) {
    console.error('Error updating counter:', err);
  }
}

/**
 * Updates the Run button disabled state based on gate notice checkbox.
 */
function updateRunButtonState() {
  try {
    runBtn.disabled = !gateCheckbox.checked;
  } catch (err) {
    console.error('Error updating run button state:', err);
  }
}

/**
 * Handles loading sample bakery HTML.
 * If sample-bakery.html is empty or missing, shows "Sample page not found."
 */
async function handleLoadSample() {
  try {
    renderStatus(statusBanner, 'Loading sample bakery page...', 'running');
    let loadedText = '';

    try {
      const response = await fetch('./sample-bakery.html');
      if (response.ok) {
        loadedText = await response.text();
      }
    } catch (fetchErr) {
      console.warn('sample-bakery.html fetch failed:', fetchErr);
    }

    // If sample-bakery.html is empty or missing, show exactly "Sample page not found."
    if (!loadedText || loadedText.trim().length === 0) {
      renderStatus(statusBanner, 'Sample page not found.', 'error');
      return;
    }

    htmlInput.value = loadedText;
    updateCounter();
    renderStatus(
      statusBanner,
      'Sample bakery page loaded. Ensure gate notice is acknowledged, then click Run first look.',
      'idle'
    );
  } catch (err) {
    console.error('Error loading sample:', err);
    renderStatus(statusBanner, 'Sample page not found.', 'error');
  }
}

/**
 * Handles clearing all inputs and results.
 */
function handleClear() {
  try {
    htmlInput.value = '';
    if (fileUpload) {
      fileUpload.value = '';
    }
    updateCounter();
    clearContainer(resultsContainer);
    lastViolations = [];
    lastExplanationsMap = new Map();
    if (exportBtn) {
      exportBtn.style.display = 'none';
    }
    renderStatus(
      statusBanner,
      'Cleared. Paste HTML code or load the sample bakery page to begin.',
      'idle'
    );
  } catch (err) {
    console.error('Error clearing:', err);
  }
}

/**
 * Handles secure HTML file upload.
 * Security defenses:
 * 1. File Type Validation (.html or .htm)
 * 2. Byte Throttling (<= 200 KB)
 * 3. Text-Only Reading via file.text() as plain string
 */
async function handleFileSelected(event) {
  try {
    const file = event.target.files && event.target.files[0];
    if (!file) return;

    // Defense 1: File Type Validation
    const lowerName = file.name.toLowerCase();
    if (!lowerName.endsWith('.html') && !lowerName.endsWith('.htm')) {
      renderStatus(statusBanner, 'Invalid file type. Please upload an .html or .htm file.', 'error');
      fileUpload.value = '';
      return;
    }

    // Defense 2: Byte Throttling
    if (file.size > MAX_INPUT_BYTES) {
      renderStatus(statusBanner, 'File exceeds the 200 KB limit. Please select a smaller snippet.', 'error');
      fileUpload.value = '';
      return;
    }

    // Defense 3: Text-Only Reading
    const textContent = await file.text();
    htmlInput.value = textContent;
    updateCounter();

    renderStatus(
      statusBanner,
      `File loaded: ${file.name}. Ensure gate notice is acknowledged, then click Run first look.`,
      'idle'
    );

    // Reset so the same file can be re-selected if cleared
    fileUpload.value = '';
  } catch (err) {
    console.error('Error reading uploaded file:', err);
    renderStatus(statusBanner, 'Error reading file. Please try pasting the HTML directly.', 'error');
    if (fileUpload) fileUpload.value = '';
  }
}

/**
 * Compiles and exports the diagnostic findings as a plain-text (.txt) report.
 */
function handleExportReport() {
  try {
    if (!lastViolations || lastViolations.length === 0) {
      return;
    }

    const lines = [];
    lines.push('================================================================');
    lines.push('ONCEOVER ACCESSIBILITY FIRST-LOOK REPORT');
    lines.push(`Generated: ${new Date().toISOString()}`);
    lines.push('================================================================');
    lines.push('');
    lines.push(`Total Potential Barriers Identified: ${lastViolations.length}`);
    lines.push('');

    lastViolations.forEach((violation, index) => {
      lines.push('----------------------------------------------------------------');
      lines.push(`FINDING ${index + 1}: ${violation.help || violation.id || 'Accessibility Item'}`);
      lines.push(`Severity Impact: ${(violation.impact || 'review').toUpperCase()}`);

      const criterionInfo = mappingData ? mappingData[violation.id] : null;
      if (criterionInfo) {
        lines.push(`WCAG Standard: ${criterionInfo.num} ${criterionInfo.name} (Level ${criterionInfo.level})`);
        lines.push(`Citation URL: ${criterionInfo.url}`);
      } else {
        lines.push(`WCAG Standard: No source found. A human needs to review this.`);
      }

      const explanation = lastExplanationsMap.get(violation.id);
      if (explanation && explanation.plain_summary) {
        lines.push('');
        lines.push('WHAT WAS FOUND:');
        lines.push(explanation.plain_summary);
        if (explanation.functional_impact) {
          lines.push('');
          lines.push('FUNCTIONAL IMPACT:');
          lines.push(explanation.functional_impact);
        }
        if (
          Array.isArray(explanation.possible_ways_to_address) &&
          explanation.possible_ways_to_address.length > 0
        ) {
          lines.push('');
          lines.push('POSSIBLE WAYS TO ADDRESS THIS (FOR HUMAN REVIEW):');
          explanation.possible_ways_to_address.forEach((way) => {
            lines.push(`  * ${way}`);
          });
        }
      } else if (criterionInfo) {
        lines.push('');
        lines.push('Guidance: Plain-language explanation unavailable.');
      }

      if (Array.isArray(violation.nodes) && violation.nodes.length > 0) {
        lines.push('');
        lines.push('Affected Elements:');
        violation.nodes.slice(0, 3).forEach((node, nodeIdx) => {
          const targetSelector = Array.isArray(node.target) ? node.target.join(' ') : (node.target || '');
          lines.push(`  [Element ${nodeIdx + 1}] Target: ${targetSelector}`);
          if (node.html) {
            lines.push(`  Snippet: ${node.html.trim()}`);
          }
          if (node.failureSummary) {
            lines.push(`  Note: ${node.failureSummary}`);
          }
        });
      }
      lines.push('');
    });

    lines.push('================================================================');
    lines.push('Evidence precedes conclusions. AI assisted. Human approved. Powered by NLP');
    lines.push('Automated checks find some problems and miss others. This is a first look,');
    lines.push('not an audit, and not legal advice. A clean scan does not mean a page is');
    lines.push('barrier-free. You are responsible for reviewing the results and your site.');
    lines.push('================================================================');

    const reportText = lines.join('\n');
    const blob = new Blob([reportText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const downloadLink = document.createElement('a');
    downloadLink.href = url;
    downloadLink.download = 'onceover-diagnostic-report.txt';
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    URL.revokeObjectURL(url);
  } catch (err) {
    console.error('Error generating export report:', err);
    renderStatus(statusBanner, 'Failed to export report.', 'error');
  }
}

/**
 * Main execution flow for Onceover scan.
 */
async function handleRunScan() {
  try {
    // Ensure mappingData is loaded before running checks
    if (!mappingData) {
      await loadMappingData();
    }

    // 1. Gate check
    if (!gateCheckbox.checked) {
      renderStatus(
        statusBanner,
        'Please acknowledge the Automated Review Gate Notice before scanning.',
        'error'
      );
      return;
    }

    const rawHtml = htmlInput.value || '';

    // 2. Empty input check
    if (!rawHtml.trim()) {
      renderStatus(
        statusBanner,
        'Please paste an HTML snippet or click "Load sample bakery page" before running Onceover.',
        'error'
      );
      return;
    }

    // 3. 200 KB max input check
    const byteSize = new Blob([rawHtml]).size;
    if (byteSize > MAX_INPUT_BYTES) {
      renderStatus(
        statusBanner,
        `Input exceeds the 200 KB limit (${(byteSize / 1024).toFixed(1)} KB provided). Please provide a smaller HTML sample.`,
        'error'
      );
      return;
    }

    clearContainer(resultsContainer);
    if (exportBtn) exportBtn.style.display = 'none';

    // 4. Sanitize input
    renderStatus(
      statusBanner,
      'Sanitizing input HTML (stripping script tags and inline event handlers)...',
      'running'
    );
    const sanitizedHtml = sanitizeHtml(rawHtml);

    // 5. Run axe scan & custom link check in sandbox directly on iframe.contentDocument
    renderStatus(
      statusBanner,
      'Executing axe-core 4.14.0 inside sandboxed frame and evaluating link purpose...',
      'running'
    );
    const scanResult = await runAxeScan(sanitizedHtml);
    const violations = scanResult.violations || [];

    // 6. Gather small-business plain-language explanations via Gemini ONLY for rules in mapping.json
    const explanationsMap = new Map();
    if (violations.length > 0) {
      renderStatus(
        statusBanner,
        `Analyzing ${violations.length} finding${violations.length === 1 ? '' : 's'} and compiling small-business guidance...`,
        'running'
      );

      const uniqueRules = Array.from(new Set(violations.map(v => v.id)));
      for (const ruleId of uniqueRules) {
        try {
          // If a rule id is not in mapping.json, do not call Gemini for it.
          if (!mappingData || !mappingData[ruleId]) {
            continue;
          }

          const match = violations.find(v => v.id === ruleId);
          const criterionInfo = mappingData[ruleId];
          
          const explanation = await getIssueExplanation({
            ruleId,
            description: match.description || match.help || '',
            impact: match.impact || 'moderate',
            targetCount: (match.nodes || []).length,
            wcagCriterion: criterionInfo?.num || ''
          });

          // Set the explanation (object or null)
          explanationsMap.set(ruleId, explanation);
        } catch (explainErr) {
          console.warn(`Could not fetch explanation for ${ruleId}:`, explainErr);
          explanationsMap.set(ruleId, null);
        }
      }
    }

    // Save state for plain-text export
    lastViolations = violations;
    lastExplanationsMap = explanationsMap;

    // Show export button if findings exist
    if (exportBtn) {
      exportBtn.style.display = violations.length > 0 ? 'inline-block' : 'none';
    }

    // 7. Render results strictly using textContent
    renderResults(resultsContainer, violations, mappingData, explanationsMap);

    renderStatus(
      statusBanner,
      `Scan complete. Evaluated against WCAG 2.2 criteria. Found ${violations.length} potential issue(s).`,
      'complete'
    );
  } catch (err) {
    console.error('Scan execution failure:', err);
    if (exportBtn) exportBtn.style.display = 'none';
    renderStatus(
      statusBanner,
      `Scan error: ${err.message || 'An unexpected error occurred during execution.'}`,
      'error'
    );
  }
}

// Event Listeners
gateCheckbox.addEventListener('change', updateRunButtonState);
htmlInput.addEventListener('input', updateCounter);
sampleBtn.addEventListener('click', handleLoadSample);
clearBtn.addEventListener('click', handleClear);
runBtn.addEventListener('click', handleRunScan);

if (uploadBtn && fileUpload) {
  uploadBtn.addEventListener('click', () => {
    try {
      fileUpload.click();
    } catch (err) {
      console.error('Error opening file upload dialog:', err);
    }
  });
  fileUpload.addEventListener('change', handleFileSelected);
}

if (exportBtn) {
  exportBtn.addEventListener('click', handleExportReport);
}

// Initialize
updateRunButtonState();
updateCounter();
loadMappingData();
