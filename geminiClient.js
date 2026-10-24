/**
 * geminiClient.js
 * Single responsibility: Server-side API call passing ONLY metadata, plus client-side banned-word filter.
 * Returns structured { plain_summary, functional_impact, possible_ways_to_address } or null.
 */

const BANNED_WORDS = ['compliant', 'compliance', 'certified', 'safe', 'passed', 'fix', 'lawsuit'];
const BANNED_WORDS_REGEX = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'i');

/**
 * Checks if a string contains any banned words.
 * @param {string} text
 * @returns {boolean}
 */
export function hasBannedWords(text) {
  if (!text || typeof text !== 'string') return false;
  return BANNED_WORDS_REGEX.test(text);
}

/**
 * Requests an AI explanation for an accessibility issue from the server.
 * Pass ONLY structured metadata: ruleId, description, impact, targetCount, wcagCriterion.
 * If text contains any banned word or fails, returns null.
 * 
 * @param {Object} metadata - Issue metadata.
 * @param {string} metadata.ruleId - Rule identifier.
 * @param {string} metadata.description - Plain description of the rule.
 * @param {string} metadata.impact - Impact severity.
 * @param {number} metadata.targetCount - Number of affected elements.
 * @param {string} [metadata.wcagCriterion] - Associated WCAG 2.2 criterion.
 * @returns {Promise<{ plain_summary: string, functional_impact: string, possible_ways_to_address: string[] }|null>}
 */
export async function getIssueExplanation(metadata) {
  try {
    const safePayload = {
      ruleId: String(metadata?.ruleId || 'unknown-rule').slice(0, 100),
      description: String(metadata?.description || '').slice(0, 300),
      impact: String(metadata?.impact || 'moderate').slice(0, 50),
      targetCount: Number(metadata?.targetCount) || 1,
      wcagCriterion: String(metadata?.wcagCriterion || '').slice(0, 50)
    };

    const response = await fetch('/api/explain', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(safePayload)
    });

    if (!response.ok) {
      return null;
    }

    const data = await response.json();
    const explanation = data?.explanation;

    if (!explanation || typeof explanation !== 'object') {
      return null;
    }

    const { plain_summary, functional_impact, possible_ways_to_address } = explanation;

    if (!plain_summary || typeof plain_summary !== 'string') {
      return null;
    }

    // If client detects any banned words, discard the whole explanation and return null
    if (
      hasBannedWords(plain_summary) ||
      hasBannedWords(functional_impact) ||
      (Array.isArray(possible_ways_to_address) && possible_ways_to_address.some(hasBannedWords))
    ) {
      console.warn('Discarding explanation: contains banned word.');
      return null;
    }

    return {
      plain_summary: plain_summary.trim(),
      functional_impact: typeof functional_impact === 'string' ? functional_impact.trim() : '',
      possible_ways_to_address: Array.isArray(possible_ways_to_address)
        ? possible_ways_to_address.map(s => String(s).trim()).filter(Boolean)
        : []
    };
  } catch (err) {
    console.warn('Issue explanation request failed:', err);
    return null;
  }
}
