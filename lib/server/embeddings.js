/**
 * Embedding generation via HuggingFace Inference API
 * Model: sentence-transformers/all-MiniLM-L6-v2 → 384 dimensions (free, fast)
 *
 * Graceful degradation: if HUGGINGFACE_API_KEY is not set or the API is
 * unreachable, returns null — the chat route continues without RAG.
 */

const HF_MODEL   = 'sentence-transformers/all-MiniLM-L6-v2';
// Fine-grained tokens require the router endpoint (not api-inference.huggingface.co)
const HF_API_URL = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;
const EMBEDDING_DIMS = 384;

/**
 * Generate a 384-dim embedding for a text string.
 * @param {string} text
 * @returns {Promise<number[] | null>}
 */
export async function generateEmbedding(text) {
    const apiKey = process.env.HUGGINGFACE_API_KEY;
    if (!apiKey || apiKey === 'PASTE_YOUR_HF_TOKEN_HERE') {
        console.warn('[RAG] HUGGINGFACE_API_KEY not configured — RAG disabled');
        return null;
    }

    const normalizedText = text.trim().slice(0, 512); // model max input length
    if (!normalizedText) return null;

    try {
        const response = await fetch(HF_API_URL, {
            method: 'POST',
            headers: {
                Authorization: `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                inputs: normalizedText,
                options: { wait_for_model: true },
            }),
            signal: AbortSignal.timeout(10_000), // 10s timeout
        });

        if (response.status === 503) {
            // Model is loading — wait and retry once
            console.warn('[RAG] HuggingFace model is loading, retrying in 5s...');
            await new Promise(r => setTimeout(r, 5000));
            const retry = await fetch(HF_API_URL, {
                method: 'POST',
                headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
                body: JSON.stringify({ inputs: normalizedText, options: { wait_for_model: true } }),
                signal: AbortSignal.timeout(15_000),
            });
            if (!retry.ok) {
                console.error(`[RAG] HuggingFace retry failed ${retry.status}`);
                return null;
            }
            const retryData = await retry.json();
            const retryEmbed = Array.isArray(retryData[0]) ? retryData[0] : retryData;
            return Array.isArray(retryEmbed) && retryEmbed.length === EMBEDDING_DIMS ? retryEmbed : null;
        }

        if (!response.ok) {
            const errText = await response.text().catch(() => '');
            console.error(`[RAG] HuggingFace API error ${response.status}: ${errText}`);
            return null;
        }

        const data = await response.json();

        if (!Array.isArray(data)) {
            console.error('[RAG] Unexpected embedding response shape:', typeof data);
            return null;
        }

        // /models/ endpoint returns [[float, float, ...]] (batch wrapper) — unwrap
        const embedding = Array.isArray(data[0]) ? data[0] : data;

        if (embedding.length !== EMBEDDING_DIMS) {
            console.error(`[RAG] Embedding dim mismatch: expected ${EMBEDDING_DIMS}, got ${embedding.length}`);
            return null;
        }

        return embedding;
    } catch (error) {
        if (error.name === 'TimeoutError') {
            console.warn('[RAG] HuggingFace API timed out — skipping RAG for this request');
        } else {
            console.error('[RAG] generateEmbedding failed:', error);
        }
        return null;
    }
}

export { EMBEDDING_DIMS };
