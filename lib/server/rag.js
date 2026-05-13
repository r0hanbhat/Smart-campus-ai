/**
 * RAG (Retrieval-Augmented Generation) helpers
 *
 * retrieveContext()        — embed query → search pgvector → return chunks + contextBlock
 * buildRAGContextSection() — format retrieved chunks for the system prompt
 * chunkDocument()          — split raw text into overlapping chunks for ingestion
 */

import { createSupabaseServiceRoleClient } from './supabase.js';
import { generateEmbedding } from './embeddings.js';

const DEFAULT_THRESHOLD = 0.25; // cosine similarity cutoff — lowered from 0.45 for better recall
const DEFAULT_TOP_K = 5;        // max chunks to inject

function parsePgVector(value) {
    if (!value) {
        return [];
    }

    if (Array.isArray(value)) {
        return value.map(Number);
    }

    return String(value)
        .replace(/^\[/, '')
        .replace(/\]$/, '')
        .split(',')
        .map((item) => Number(item.trim()))
        .filter((item) => Number.isFinite(item));
}

function cosineSimilarity(left, right) {
    if (!Array.isArray(left) || !Array.isArray(right) || left.length === 0 || right.length === 0) {
        return 0;
    }

    const size = Math.min(left.length, right.length);
    let dot = 0;
    let leftNorm = 0;
    let rightNorm = 0;

    for (let index = 0; index < size; index++) {
        dot += left[index] * right[index];
        leftNorm += left[index] * left[index];
        rightNorm += right[index] * right[index];
    }

    if (leftNorm === 0 || rightNorm === 0) {
        return 0;
    }

    return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

async function fallbackRetrieveContext(serviceClient, queryEmbedding, { threshold, topK, category }) {
    let query = serviceClient
        .from('knowledge_chunks')
        .select('id, content, source, category, title, chunk_index, metadata, embedding')
        .not('embedding', 'is', null);

    if (category) {
        query = query.eq('category', category);
    }

    const { data, error } = await query.limit(500);
    if (error) {
        console.error('[RAG] Fallback retrieval query failed:', error.code, error.message);
        return [];
    }

    const scoredChunks = (data || [])
        .map((chunk) => ({
            ...chunk,
            similarity: cosineSimilarity(queryEmbedding, parsePgVector(chunk.embedding)),
        }))
        .filter((chunk) => chunk.similarity > threshold)
        .sort((left, right) => right.similarity - left.similarity)
        .slice(0, topK)
        .map((chunk) => {
            const nextChunk = { ...chunk };
            delete nextChunk.embedding;
            return nextChunk;
        });

    console.log(`[RAG] Fallback retrieval returned ${scoredChunks.length} chunks at threshold=${threshold}`);
    return scoredChunks;
}

/**
 * @typedef {Object} KnowledgeChunk
 * @property {string} id
 * @property {string} content
 * @property {string} source
 * @property {string} category
 * @property {string|null} title
 * @property {number} chunk_index
 * @property {object} metadata
 * @property {number} similarity
 */

/**
 * @typedef {Object} RAGResult
 * @property {KnowledgeChunk[]} chunks
 * @property {Array<{title:string,source:string,category:string,similarity:number}>} sources
 * @property {string} contextBlock   — formatted text ready to inject into system prompt
 * @property {boolean} hasContext    — true when at least 1 chunk was retrieved
 */

/**
 * Run retrieval for a user query.
 * Always returns a valid RAGResult — never throws.
 *
 * @param {string} query
 * @param {{ threshold?: number, topK?: number, category?: string }} [options]
 * @returns {Promise<RAGResult>}
 */
export async function retrieveContext(query, options = {}) {
    const threshold = options.threshold ?? DEFAULT_THRESHOLD;
    const topK      = options.topK      ?? DEFAULT_TOP_K;
    const category  = options.category ?? '';

    const empty = { chunks: [], sources: [], contextBlock: '', hasContext: false };

    try {
        console.log(`[RAG] retrieveContext called — query: "${query.slice(0, 80)}"`);
        const embedding = await generateEmbedding(query);
        if (!embedding) {
            console.warn('[RAG] No embedding returned — HuggingFace key missing or model unavailable');
            return empty;
        }
        console.log(`[RAG] Embedding generated (${embedding.length} dims), running similarity search...`);

        const serviceClient = createSupabaseServiceRoleClient();

        const rpcParams = {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: topK,
        };

        if (category) {
            rpcParams.match_category = category;
        }

        let { data: chunks, error } = await serviceClient.rpc(
            'match_knowledge_chunks',
            rpcParams,
        );

        if (error) {
            if (error.code === '42883' || error.code === '42P01') {
                console.warn('[RAG] match_knowledge_chunks RPC not found — run rag_schema.sql in Supabase');
            } else {
                console.error('[RAG] RPC error:', error.code, error.message);
            }
            chunks = await fallbackRetrieveContext(serviceClient, embedding, { threshold, topK, category });
            error = null;
        }

        console.log(`[RAG] Retrieved ${chunks?.length ?? 0} chunks at threshold=${threshold}`);
        if (chunks?.length) {
            chunks.slice(0, 3).forEach((c, i) => console.log(`  [${i+1}] similarity=${c.similarity?.toFixed(3)} source="${c.source}" title="${c.title}"`));
        }
        if (!chunks?.length) {
            console.warn('[RAG] RPC returned 0 chunks — trying exact fallback retrieval');
            chunks = await fallbackRetrieveContext(serviceClient, embedding, { threshold, topK, category });
        }
        if (!chunks?.length) {
            console.warn(`[RAG] 0 chunks returned — threshold ${threshold} may be too high or knowledge base is empty`);
            return empty;
        }

        const sources = chunks.map(c => ({
            title: c.title || c.source,
            source: c.source,
            category: c.category,
            similarity: Math.round(c.similarity * 100) / 100,
        }));

        const contextBlock = chunks
            .map((c, i) =>
                `[${i + 1}] [SOURCE: ${c.title || c.source} | ${c.category.toUpperCase()}]\n${c.content.trim()}`
            )
            .join('\n\n');

        return { chunks, sources, contextBlock, hasContext: true };
    } catch (error) {
        console.error('[RAG] retrieveContext error:', error);
        return empty;
    }
}

/**
 * Formats retrieved chunks into a system-prompt section with grounding instructions.
 * Returns an empty string when no context was retrieved (prompt stays clean).
 *
 * @param {string} contextBlock
 * @returns {string}
 */
export function buildRAGContextSection(contextBlock) {
    if (!contextBlock) return '';

    return `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
CAMPUS KNOWLEDGE BASE — VERIFIED RETRIEVED CONTEXT
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
The following chunks were retrieved from the official campus knowledge base and are VERIFIED facts.

INSTRUCTIONS:
• READ the retrieved context carefully and use it to answer the student's question.
• Interpret the student's intent — they may phrase things informally (e.g. "leverage" means "leniency or exception", "shortfall" means "attendance deficit"). Match meaning, not just words.
• If the context CLEARLY contains the answer (even partially), USE it to give a direct, helpful response and mention the source.
• If the context is genuinely unrelated to what the student asked, only then say: "I don't have confirmed campus information about this. Please verify with the administration."
• Do NOT invent numbers, dates, or rules not present in the context.
• General academic help (code, theory, research) is unrestricted — apply these rules only to campus-specific policy questions.

${contextBlock}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

`;
}

/**
 * Split a document into overlapping text chunks for embedding + storage.
 *
 * @param {string} text         — raw document text
 * @param {number} chunkSize    — target chars per chunk (default 500)
 * @param {number} overlap      — overlap between adjacent chunks (default 80)
 * @returns {string[]}
 */
export function chunkDocument(text, chunkSize = 500, overlap = 80) {
    const normalized = text.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
    const chunks = [];
    let start = 0;

    while (start < normalized.length) {
        const end = Math.min(start + chunkSize, normalized.length);
        let slice = normalized.slice(start, end);

        // Prefer to break at paragraph or sentence boundary
        if (end < normalized.length) {
            const paraBreak = slice.lastIndexOf('\n\n');
            const sentBreak = slice.lastIndexOf('. ');
            const breakAt = paraBreak > chunkSize * 0.6 ? paraBreak
                          : sentBreak  > chunkSize * 0.4 ? sentBreak + 1
                          : slice.length;
            slice = slice.slice(0, breakAt).trim();
        }

        if (slice.length > 40) {
            chunks.push(slice);
        }

        if (end >= normalized.length) break;
        start = start + (slice.length || chunkSize) - overlap;
    }

    return chunks;
}
