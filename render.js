/**
 * render.js
 * Single responsibility: Renders cards, summary metrics, and status banners strictly via textContent (never innerHTML).
 * Strictly adheres to Clew Labs color rules: Parchment cards (#F1E8D2), text (#17262E), dark teal links (#0E6264).
 */

/**
 * Updates the status banner element strictly using textContent.
 * @param {HTMLElement} bannerElement - The status banner container.
 * @param {string} message - Message to display.
 * @param {'idle'|'running'|'complete'|'error'} [statusType='idle'] - Status category.
 */
export function renderStatus(bannerElement, message, statusType = 'idle') {
  try {
    if (!bannerElement) return;

    bannerElement.className = `status-banner status-${statusType}`;
    bannerElement.textContent = message;
  } catch (err) {
    console.error('Error rendering status:', err);
  }
}

/**
 * Clears all children from an element without using innerHTML.
 * @param {HTMLElement} element
 */
export function clearContainer(element) {
  try {
    if (!element) return;
    while (element.firstChild) {
      element.removeChild(element.firstChild);
    }
  } catch (err) {
    console.error('Error clearing container:', err);
  }
}

/**
 * Renders all accessibility findings into the results container strictly via textContent.
 * @param {HTMLElement} container - The results container.
 * @param {Array<Object>} violations - Array of violation items from axe-core and custom checks.
 * @param {Object} mappingData - WCAG mapping data loaded from mapping.json.
 * @param {Map<string, Object|null>} [explanationsMap] - Map of ruleId -> structured explanation object.
 */
export function renderResults(container, violations, mappingData, explanationsMap = new Map()) {
  try {
    if (!container) return;
    clearContainer(container);

    // Eyebrow tag
    const eyebrow = document.createElement('span');
    eyebrow.className = 'section-eyebrow';
    eyebrow.textContent = 'EVALUATION REPORT';
    container.appendChild(eyebrow);

    // Section Header
    const heading = document.createElement('h3');
    heading.className = 'results-header';
    heading.textContent = 'Accessibility First-Look Findings';
    container.appendChild(heading);

    // Summary Metric Row (only potential barriers identified)
    const summaryRow = document.createElement('div');
    summaryRow.className = 'results-summary-row';

    const issuesPill = document.createElement('div');
    issuesPill.className = 'summary-pill';
    issuesPill.textContent = `${violations.length} Potential Barrier${violations.length === 1 ? '' : 's'} Identified`;
    summaryRow.appendChild(issuesPill);

    container.appendChild(summaryRow);

    // If zero findings: exactly "We found nothing on the checks we ran."
    if (violations.length === 0) {
      const emptyCard = document.createElement('div');
      emptyCard.className = 'parchment-card';

      const emptyDesc = document.createElement('p');
      emptyDesc.className = 'card-description';
      emptyDesc.textContent = 'We found nothing on the checks we ran.';
      emptyCard.appendChild(emptyDesc);

      container.appendChild(emptyCard);
      return;
    }

    // Render each violation as a Parchment Card
    // Note: Parchment background is #F1E8D2. All text inside must be #17262E.
    // Links inside are dark teal #0E6264.
    // NO turquoise or orange text permitted on parchment cards!
    violations.forEach((violation, index) => {
      try {
        const card = document.createElement('article');
        card.className = 'parchment-card';

        // Card top row (Title & Severity tag)
        const topRow = document.createElement('div');
        topRow.className = 'card-top-row';

        const title = document.createElement('h4');
        title.className = 'card-title';
        title.textContent = `${index + 1}. ${violation.help || violation.id || 'Accessibility Item'}`;
        topRow.appendChild(title);

        const impactTag = document.createElement('span');
        impactTag.className = 'card-tag';
        impactTag.textContent = (violation.impact || 'review').toUpperCase();
        topRow.appendChild(impactTag);

        card.appendChild(topRow);

        // Look up citation ONLY in mapping.json
        const criterionInfo = mappingData ? mappingData[violation.id] : null;

        if (!criterionInfo) {
          // If a rule id is not in mapping.json, show rule id and exactly:
          // "No source found. A human needs to review this."
          // Do not call Gemini for it.
          const noSourceText = document.createElement('p');
          noSourceText.className = 'card-description';
          noSourceText.textContent = `Rule: ${violation.id} — No source found. A human needs to review this.`;
          card.appendChild(noSourceText);
        } else {
          // Description
          const desc = document.createElement('p');
          desc.className = 'card-description';
          desc.textContent = violation.description || 'No additional rule description provided.';
          card.appendChild(desc);

          // WCAG Criterion citation link
          const criterionRow = document.createElement('p');
          criterionRow.className = 'card-criterion';
          
          const labelPrefix = document.createTextNode('WCAG 2.2 Standard: ');
          criterionRow.appendChild(labelPrefix);

          const criterionLink = document.createElement('a');
          criterionLink.className = 'card-link';
          criterionLink.href = criterionInfo.url;
          criterionLink.target = '_blank';
          criterionLink.rel = 'noopener noreferrer';
          criterionLink.textContent = `${criterionInfo.num} ${criterionInfo.name} (Level ${criterionInfo.level})`;
          criterionRow.appendChild(criterionLink);

          card.appendChild(criterionRow);

          // Plain-language explanation box
          const explanationBox = document.createElement('div');
          explanationBox.className = 'card-explanation-box';

          const explanationObj = explanationsMap.get(violation.id);

          if (explanationObj && explanationObj.plain_summary) {
            // 1. WHAT WAS FOUND
            const foundSubitem = document.createElement('div');
            foundSubitem.className = 'card-explanation-subitem';

            const foundLabel = document.createElement('div');
            foundLabel.className = 'card-explanation-title';
            foundLabel.textContent = 'WHAT WAS FOUND';
            foundSubitem.appendChild(foundLabel);

            const foundText = document.createElement('p');
            foundText.className = 'card-explanation-text';
            foundText.textContent = explanationObj.plain_summary;
            foundSubitem.appendChild(foundText);

            explanationBox.appendChild(foundSubitem);

            // 2. FUNCTIONAL IMPACT
            if (explanationObj.functional_impact) {
              const impactSubitem = document.createElement('div');
              impactSubitem.className = 'card-explanation-subitem';

              const impactLabel = document.createElement('div');
              impactLabel.className = 'card-explanation-title';
              impactLabel.textContent = 'FUNCTIONAL IMPACT';
              impactSubitem.appendChild(impactLabel);

              const impactText = document.createElement('p');
              impactText.className = 'card-explanation-text';
              impactText.textContent = explanationObj.functional_impact;
              impactSubitem.appendChild(impactText);

              explanationBox.appendChild(impactSubitem);
            }

            // 3. POSSIBLE WAYS TO ADDRESS THIS (FOR HUMAN REVIEW)
            if (
              Array.isArray(explanationObj.possible_ways_to_address) &&
              explanationObj.possible_ways_to_address.length > 0
            ) {
              const waysSubitem = document.createElement('div');
              waysSubitem.className = 'card-explanation-subitem';

              const waysLabel = document.createElement('div');
              waysLabel.className = 'card-explanation-title';
              waysLabel.textContent = 'POSSIBLE WAYS TO ADDRESS THIS (FOR HUMAN REVIEW)';
              waysSubitem.appendChild(waysLabel);

              const waysList = document.createElement('ul');
              waysList.className = 'card-explanation-list';
              explanationObj.possible_ways_to_address.forEach((way) => {
                const li = document.createElement('li');
                li.textContent = way;
                waysList.appendChild(li);
              });
              waysSubitem.appendChild(waysList);

              explanationBox.appendChild(waysSubitem);
            }
          } else {
            // If plain_summary is unavailable, show: "Plain-language explanation unavailable."
            const unavailableText = document.createElement('p');
            unavailableText.className = 'card-explanation-text';
            unavailableText.textContent = 'Plain-language explanation unavailable.';
            explanationBox.appendChild(unavailableText);
          }

          card.appendChild(explanationBox);
        }

        // Affected Elements Code Snippets (up to 3 nodes)
        if (Array.isArray(violation.nodes) && violation.nodes.length > 0) {
          const sampleNodes = violation.nodes.slice(0, 3);
          sampleNodes.forEach((node) => {
            const evidenceCard = document.createElement('div');
            evidenceCard.className = 'node-evidence-card';

            // 1. Header (target row)
            const targetRow = document.createElement('div');
            targetRow.className = 'node-target-row';

            const nodeLabel = document.createElement('span');
            nodeLabel.className = 'node-label';
            nodeLabel.textContent = 'SELECTOR';
            targetRow.appendChild(nodeLabel);

            const targetSelector = Array.isArray(node.target) ? node.target.join(' ') : (node.target || '');
            const targetCode = document.createElement('code');
            targetCode.className = 'node-target-code';
            targetCode.textContent = targetSelector;
            targetRow.appendChild(targetCode);

            evidenceCard.appendChild(targetRow);

            // 2. Snippet Box
            const snippetBox = document.createElement('pre');
            snippetBox.className = 'card-code-block';
            snippetBox.textContent = node.html ? node.html.trim() : '';
            evidenceCard.appendChild(snippetBox);

            // 3. Engine Note (if node.failureSummary exists)
            if (node.failureSummary && node.failureSummary.trim()) {
              const failureNote = document.createElement('div');
              failureNote.className = 'node-failure-note';

              const noteLabel = document.createElement('span');
              noteLabel.className = 'node-note-label';
              noteLabel.textContent = 'SCANNER OBSERVATION:';
              failureNote.appendChild(noteLabel);

              const noteText = document.createElement('p');
              noteText.className = 'node-note-text';
              noteText.textContent = node.failureSummary.trim();
              failureNote.appendChild(noteText);

              evidenceCard.appendChild(failureNote);
            }

            card.appendChild(evidenceCard);
          });
        }

        container.appendChild(card);
      } catch (cardErr) {
        console.error('Error rendering individual card:', cardErr);
      }
    });
  } catch (err) {
    console.error('Error rendering results container:', err);
  }
}
