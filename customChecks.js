/**
 * customChecks.js
 * Single responsibility: Deterministic vague-link-text check for "click here", "here", "read more", "more".
 * All WCAG citations must be looked up exclusively in mapping.json (no hardcoded wcagCriterion).
 */

const VAGUE_TEXT_SET = new Set(['click here', 'here', 'read more', 'more']);

/**
 * Generates a simple CSS selector for a DOM element.
 * @param {Element} element
 * @returns {string}
 */
function getElementSelector(element) {
  try {
    if (element.id) {
      return `#${element.id}`;
    }
    const tagName = element.tagName.toLowerCase();
    const parent = element.parentElement;
    if (!parent) return tagName;
    const siblings = Array.from(parent.children).filter(child => child.tagName === element.tagName);
    if (siblings.length === 1) {
      return `${getElementSelector(parent)} > ${tagName}`;
    }
    const index = siblings.indexOf(element) + 1;
    return `${getElementSelector(parent)} > ${tagName}:nth-of-type(${index})`;
  } catch (err) {
    return element.tagName ? element.tagName.toLowerCase() : 'a';
  }
}

/**
 * Runs the deterministic vague-link-text check on the provided DOM document or root element.
 * Checks for "click here", "here", "read more", "more" (case-insensitive, normalized whitespace).
 * 
 * @param {Document|Element} rootNode - Document or container element to inspect.
 * @returns {Array<Object>} List of custom check violation objects (empty array if none found).
 */
export function runCustomChecks(rootNode) {
  const violations = [];

  try {
    if (!rootNode) return violations;

    const links = rootNode.querySelectorAll ? rootNode.querySelectorAll('a, [role="link"]') : [];
    const vagueNodes = [];

    for (const link of links) {
      try {
        const textContent = (link.textContent || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const ariaLabel = (link.getAttribute('aria-label') || '').replace(/\s+/g, ' ').trim().toLowerCase();
        const title = (link.getAttribute('title') || '').replace(/\s+/g, ' ').trim().toLowerCase();

        // Effective accessible text considered by users
        const effectiveText = ariaLabel || textContent || title;

        if (VAGUE_TEXT_SET.has(effectiveText) || VAGUE_TEXT_SET.has(textContent)) {
          vagueNodes.push({
            html: link.outerHTML ? link.outerHTML.slice(0, 300) : '<a>',
            target: [getElementSelector(link)],
            failureSummary: `Link text "${effectiveText || textContent}" lacks meaningful context about the link destination.`
          });
        }
      } catch (innerErr) {
        console.warn('Error evaluating link node:', innerErr);
      }
    }

    if (vagueNodes.length > 0) {
      violations.push({
        id: 'vague-link-text',
        impact: 'moderate',
        description: 'Links must have descriptive text that explains their destination without surrounding context.',
        help: 'Replace vague phrases such as "click here", "here", or "read more" with specific descriptive labels (e.g. "View our pastry menu").',
        nodes: vagueNodes
      });
    }
  } catch (err) {
    console.error('Error running custom checks:', err);
  }

  return violations;
}
