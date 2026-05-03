/**
 * RAG Pipeline Diagnostic Script
 * Run: node scripts/test-rag.mjs
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

try {
  const envFile = readFileSync('.env.local', 'utf8');
  for (const line of envFile.split('\n')) {
    const [key, ...vals] = line.split('=');
    if (key && vals.length) process.env[key.trim()] = vals.join('=').trim();
  }
} catch { /* .env.local not found */ }

const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY      = process.env.SUPABASE_SERVICE_ROLE_KEY;
const HF_KEY           = process.env.HUGGINGFACE_API_KEY;
const HF_MODEL         = 'sentence-transformers/all-MiniLM-L6-v2';
const HF_URL           = `https://router.huggingface.co/hf-inference/models/${HF_MODEL}/pipeline/feature-extraction`;

const ok  = (msg) => console.log(`  ✅ ${msg}`);
const err = (msg) => console.log(`  ❌ ${msg}`);
const info = (msg) => console.log(`  ℹ️  ${msg}`);

console.log('\n========= RAG DIAGNOSTIC =========\n');

// ── Step 1: Env vars ─────────────────────────────────────────────────────────
console.log('STEP 1: Environment variables');
if (SUPABASE_URL)  ok(`SUPABASE_URL = ${SUPABASE_URL}`);
else               err('NEXT_PUBLIC_SUPABASE_URL not set');
if (SERVICE_KEY)   ok('SUPABASE_SERVICE_ROLE_KEY is set');
else               err('SUPABASE_SERVICE_ROLE_KEY not set');
if (HF_KEY && HF_KEY !== 'PASTE_YOUR_HF_TOKEN_HERE') ok(`HUGGINGFACE_API_KEY = ${HF_KEY.slice(0,8)}...`);
else err('HUGGINGFACE_API_KEY not set or is placeholder');

if (!SUPABASE_URL || !SERVICE_KEY || !HF_KEY) {
  console.log('\n❌ Missing env vars — cannot continue.\n');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

// ── Step 2: knowledge_chunks table ───────────────────────────────────────────
console.log('\nSTEP 2: knowledge_chunks table');
const { count, error: tableErr } = await supabase
  .from('knowledge_chunks')
  .select('*', { count: 'exact', head: true });

if (tableErr?.code === '42P01') {
  err('Table does NOT exist — run rag_schema.sql in Supabase SQL Editor');
  process.exit(1);
} else if (tableErr) {
  err(`Table error: ${tableErr.message}`);
} else {
  ok(`Table exists — ${count} chunks stored`);
  if (count === 0) info('Knowledge base is EMPTY — upload documents via Admin → Knowledge Base');
}

// Show recent chunks
const { data: samples } = await supabase
  .from('knowledge_chunks')
  .select('id, source, title, category, chunk_index, created_at')
  .order('created_at', { ascending: false })
  .limit(5);

if (samples?.length) {
  console.log('\n  Recent chunks:');
  samples.forEach(c => console.log(`    - [${c.category}] "${c.title || c.source}" (chunk ${c.chunk_index}) @ ${c.created_at}`));
} else {
  info('No chunks in database');
}

// ── Step 3: HuggingFace embedding ────────────────────────────────────────────
console.log('\nSTEP 3: HuggingFace embedding generation');
const testQuery = 'attendance rules campus policy';
let embedding = null;

try {
  console.log(`  Calling HuggingFace API for: "${testQuery}"...`);
  const res = await fetch(HF_URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${HF_KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ inputs: testQuery, options: { wait_for_model: true } }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const txt = await res.text();
    err(`HF API returned ${res.status}: ${txt.slice(0, 200)}`);
  } else {
    const data = await res.json();
    embedding = Array.isArray(data[0]) ? data[0] : data;
    if (Array.isArray(embedding) && embedding.length === 384) {
      ok(`Embedding generated — 384 dims, first 3 values: [${embedding.slice(0,3).map(v=>v.toFixed(5)).join(', ')}]`);
    } else {
      err(`Unexpected embedding shape — got ${Array.isArray(embedding) ? embedding.length : typeof embedding} dims`);
      embedding = null;
    }
  }
} catch (e) {
  err(`HF API exception: ${e.message}`);
}

if (!embedding) {
  console.log('\n❌ Cannot test retrieval without a valid embedding.\n');
  process.exit(1);
}

// ── Step 4: match_knowledge_chunks RPC at threshold=0 ────────────────────────
console.log('\nSTEP 4: match_knowledge_chunks RPC (threshold=0.0 — returns ALL)');
const { data: allChunks, error: rpcErr0 } = await supabase.rpc('match_knowledge_chunks', {
  query_embedding: embedding,
  match_threshold: 0.0,
  match_count: 5,
});

if (rpcErr0?.code === '42883') {
  err('Function match_knowledge_chunks does NOT exist — run rag_schema.sql');
  process.exit(1);
} else if (rpcErr0) {
  err(`RPC error: ${rpcErr0.code} — ${rpcErr0.message}`);
} else {
  ok(`RPC works — returned ${allChunks?.length ?? 0} chunks at threshold=0`);
  if (allChunks?.length) {
    console.log('  Top similarities:');
    allChunks.forEach((c, i) => console.log(`    [${i+1}] similarity=${c.similarity?.toFixed(4)} source="${c.source}" title="${c.title}"`));
  }
}

// ── Step 5: Test at production threshold ─────────────────────────────────────
console.log('\nSTEP 5: match_knowledge_chunks RPC (threshold=0.25 — production)');
const { data: prodChunks, error: rpcErr1 } = await supabase.rpc('match_knowledge_chunks', {
  query_embedding: embedding,
  match_threshold: 0.25,
  match_count: 5,
});

if (!rpcErr1) {
  const n = prodChunks?.length ?? 0;
  if (n > 0) ok(`${n} chunks retrieved — RAG is WORKING ✓`);
  else       err(`0 chunks at threshold=0.25 — similarity scores are below threshold`);
}

// ── Step 6: Test at old threshold ────────────────────────────────────────────
console.log('\nSTEP 6: match_knowledge_chunks RPC (threshold=0.45 — old value)');
const { data: oldChunks } = await supabase.rpc('match_knowledge_chunks', {
  query_embedding: embedding,
  match_threshold: 0.45,
  match_count: 5,
});
const oldN = oldChunks?.length ?? 0;
if (oldN > 0) ok(`${oldN} chunks at 0.45 — threshold was fine`);
else          info(`0 chunks at 0.45 — this was why retrieval was failing (too high)`);

// ── Summary ───────────────────────────────────────────────────────────────────
console.log('\n========= SUMMARY =========');
if ((allChunks?.length ?? 0) === 0) {
  console.log('❌ Knowledge base is empty or match_knowledge_chunks not working');
  console.log('   → Upload knowledge documents first via Admin → Knowledge Base');
} else if ((prodChunks?.length ?? 0) === 0) {
  console.log('⚠️  Chunks exist but similarity is below 0.25 threshold');
  console.log('   → Re-ingest documents or lower threshold further');
} else {
  console.log('✅ RAG pipeline is fully operational');
  console.log(`   → ${prodChunks.length} chunks retrieved for test query`);
}
console.log('');
