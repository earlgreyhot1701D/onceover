import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(express.json({ limit: '500kb' }));

// Initialize Google GenAI client (server-side only)
const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY || '',
  httpOptions: {
    headers: {
      'User-Agent': 'aistudio-build',
    },
  },
});

// Banned words check (compliant, compliance, certified, safe, passed, fix, lawsuit)
const BANNED_WORDS = ['compliant', 'compliance', 'certified', 'safe', 'passed', 'fix', 'lawsuit'];
const BANNED_WORDS_REGEX = new RegExp(`\\b(${BANNED_WORDS.join('|')})\\b`, 'i');

function containsBannedWords(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  return BANNED_WORDS_REGEX.test(text);
}

// POST /api/explain endpoint - Accepts metadata only
app.post('/api/explain', async (req, res) => {
  try {
    const { ruleId, description, impact, targetCount, wcagCriterion } = req.body || {};

    if (!ruleId && !description) {
      return res.status(400).json({ explanation: null, error: 'Missing issue metadata.' });
    }

    if (!process.env.GEMINI_API_KEY) {
      return res.json({ explanation: null });
    }

    const systemPrompt = `You are an empathetic, clear web accessibility advisor writing for small business owners (e.g. bakery, cafe, boutique, local service).
Explain this specific web accessibility barrier concisely and clearly.
CRITICAL CONSTRAINT: You are strictly forbidden from using any of the following words or variations in any part of your output:
- compliant
- compliance
- certified
- safe
- passed
- fix
- lawsuit
Do NOT make any legal claims or guarantees. Frame advice around customer access, inclusion, and usability.`;

    const userPrompt = `Rule ID: ${ruleId}
Description: ${description}
Severity Impact: ${impact}
Affected Element Count: ${targetCount}
WCAG Criterion: ${wcagCriterion || 'N/A'}`;

    try {
      // 10000 ms timeout per requirements
      const timeoutPromise = new Promise<{ text: string }>((_, reject) => {
        setTimeout(() => reject(new Error('AI explanation timed out')), 10000);
      });

      const generatePromise = (async () => {
        const response = await ai.models.generateContent({
          model: 'gemini-2.5-flash',
          contents: userPrompt,
          config: {
            systemInstruction: systemPrompt,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                plain_summary: {
                  type: Type.STRING,
                  description: 'Plain-language summary of what was found in 1-2 clear sentences.',
                },
                functional_impact: {
                  type: Type.STRING,
                  description: 'Functional impact on real customers or users with disabilities.',
                },
                possible_ways_to_address: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.STRING,
                  },
                  description: 'List of 2-3 possible ways to address this issue for human review.',
                },
              },
              required: ['plain_summary', 'functional_impact', 'possible_ways_to_address'],
            },
            temperature: 0.2,
          },
        });
        return { text: response.text || '' };
      })();

      const result = await Promise.race([generatePromise, timeoutPromise]);
      const rawText = result.text.trim();

      // If raw output contains ANY banned word, discard the whole explanation and return null
      if (containsBannedWords(rawText)) {
        console.warn('Explanation contained banned word in raw JSON. Discarding output.');
        return res.json({ explanation: null });
      }

      const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
      const parsed = JSON.parse(cleanJson);

      // Verify each individual field for banned words
      if (
        containsBannedWords(parsed.plain_summary) ||
        containsBannedWords(parsed.functional_impact) ||
        (Array.isArray(parsed.possible_ways_to_address) &&
          parsed.possible_ways_to_address.some((item: string) => containsBannedWords(item)))
      ) {
        console.warn('Explanation field contained banned word. Discarding output.');
        return res.json({ explanation: null });
      }

      return res.json({
        explanation: {
          plain_summary: parsed.plain_summary || '',
          functional_impact: parsed.functional_impact || '',
          possible_ways_to_address: Array.isArray(parsed.possible_ways_to_address)
            ? parsed.possible_ways_to_address
            : [],
        },
      });
    } catch (apiErr) {
      console.warn('Gemini generateContent error or timeout:', apiErr);
      return res.json({ explanation: null });
    }
  } catch (err: any) {
    console.error('Error in /api/explain:', err);
    return res.json({ explanation: null });
  }
});

// Serve public directory statically (social card, assets)
app.use(express.static(path.resolve(__dirname, 'public')));

// Serve sample-bakery.html directly from root path
app.get('/sample-bakery.html', (_req, res) => {
  res.sendFile(path.resolve(__dirname, 'sample-bakery.html'));
});

// Mount Vite or serve static files
async function startServer() {
  try {
    if (process.env.NODE_ENV !== 'production') {
      const { createServer: createViteServer } = await import('vite');
      const vite = await createViteServer({
        server: { middlewareMode: true },
        appType: 'spa',
      });
      app.use(vite.middlewares);
    } else {
      app.use(express.static(path.resolve(__dirname, 'dist')));
      app.get('*', (_req, res) => {
        res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
      });
    }

    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Onceover server running on port ${PORT}`);
    });
  } catch (serverErr) {
    console.error('Failed to start server:', serverErr);
  }
}

startServer();
