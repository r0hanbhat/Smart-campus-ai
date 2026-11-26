import { createSupabaseServiceRoleClient } from './supabase.js';
import { buildRAGContextSection, formatRAGSources } from './rag-context.js';

export { buildRAGContextSection };

const STOP_WORDS = new Set('a an and are as at be by can do does for from how i in is it me my of on or our please tell that the their this to what when where which who with'.split(' '));

export async function retrieveContext(query, { topK = 5, category = '' } = {}) {
    const empty = { chunks: [], sources: [], contextBlock: '', hasContext: false };
    const words = query.toLowerCase().match(/[\p{L}\p{N}]+/gu) || [];
    const terms = [...new Set(words.filter(word => !STOP_WORDS.has(word)))].slice(0, 16);
    if (!terms.length) return empty;

    try {
        const db = createSupabaseServiceRoleClient();
        // Count how many distinct query terms PostgreSQL matches in each passage.
        const matches = new Map();
        await Promise.all(terms.map(async term => {
            const pageSize = 500;
            for (let offset = 0; ; offset += pageSize) {
                let search = db.from('knowledge_chunks').select('id')
                    .textSearch('content', term, { config: 'english', type: 'plain' })
                    .order('id').range(offset, offset + pageSize - 1);
                if (category) search = search.eq('category', category);
                const { data, error } = await search;
                if (error) throw error;
                for (const { id } of data) matches.set(id, (matches.get(id) || 0) + 1);
                if (data.length < pageSize) break;
            }
        }));
        const best = [...matches].sort(([a, countA], [b, countB]) => countB - countA || a.localeCompare(b)).slice(0, topK);
        if (!best.length) return empty;
        const { data, error } = await db.from('knowledge_chunks')
            .select('id, content, source, category, title, chunk_index, metadata')
            .in('id', best.map(([id]) => id));
        if (error) throw error;
        const byId = new Map(data.map(row => [row.id, row]));
        const chunks = best.filter(([id]) => byId.has(id)).map(([id, count]) => ({
            ...byId.get(id), similarity: count / terms.length,
        }));
        if (!chunks.length) return empty;
        const sources = formatRAGSources(chunks);

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
 * Split a document into overlapping text chunks for storage.
 *
 * @param {string} text         — raw document text
 * @param {number} chunkSize    — target chars per chunk (default 500)
 * @param {number} overlap      — overlap between adjacent chunks (default 80)
 * @returns {string[]}
 */
export function chunkDocument(text, chunkSize = 500, overlap = 80) {
    chunkSize = Math.max(1, Math.trunc(chunkSize) || 500);
    overlap = Math.max(0, Math.min(Math.trunc(overlap) || 0, chunkSize - 1));
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

        if (slice.trim()) {
            chunks.push(slice);
        }

        if (end >= normalized.length) break;
        start += Math.max(1, (slice.length || chunkSize) - overlap);
    }

    return chunks;
}
