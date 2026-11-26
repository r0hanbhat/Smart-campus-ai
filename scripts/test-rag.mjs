import dotenv from 'dotenv';
import { retrieveContext } from '../lib/server/rag.js';

dotenv.config({ path: '.env.local', quiet: true });
const query = process.argv.slice(2).join(' ') || 'attendance policy';
const result = await retrieveContext(query);
console.log(JSON.stringify({ query, sources: result.sources }, null, 2));
if (!result.hasContext) process.exitCode = 1;
