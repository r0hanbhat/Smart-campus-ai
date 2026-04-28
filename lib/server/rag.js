/**
 * RAG (Retrieval-Augmented Generation) helpers
 *
 * retrieveContext()        — embed query → search pgvector → return chunks + contextBlock
 * buildRAGContextSection() — format retrieved chunks for the system prompt
 * chunkDocument()          — split raw text into overlapping chunks for ingestion
 */

import { createSupabaseServiceRoleClient } from './supabase.js';
import { generateEmbedding } from './embeddings.js';

const DEFAULT_THRESHOLD = 0.45; // cosine similarity cutoff (0–1)
const DEFAULT_TOP_K = 5;        // max chunks to inject

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

    const empty = { chunks: [], sources: [], contextBlock: '', hasContext: false };

    try {
        const embedding = await generateEmbedding(query);
        if (!embedding) return empty;

        const serviceClient = createSupabaseServiceRoleClient();

        const rpcParams = {
            query_embedding: embedding,
            match_threshold: threshold,
            match_count: topK,
        };

        const { data: chunks, error } = await serviceClient.rpc(
            'match_knowledge_chunks',
            rpcParams,
        );

        if (error) {
            // Table/function may not exist yet — fail silently
            if (error.code === '42883' || error.code === '42P01') {
                console.warn('[RAG] match_knowledge_chunks RPC not found — run rag_schema.sql');
            } else {
                console.error('[RAG] RPC error:', error.message);
            }
            return empty;
        }

        if (!chunks?.length) return empty;

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
The sections below were retrieved from the official campus knowledge base.

GROUNDING RULES (follow strictly):
• Answer institution-specific questions ONLY using the context provided below.
• If the answer is clearly present in the context, respond precisely and cite the source name.
• If the context does NOT cover what the user asked, say exactly:
  "I don't have confirmed campus information about this. Please verify with the administration or check the official notice board."
• Do NOT invent, assume, or extrapolate attendance percentages, exam dates, fee amounts,
  hostel rules, registration deadlines, or administrative policies beyond what is stated below.
• General academic help (explanations, code, research) is NOT subject to these restrictions.

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
