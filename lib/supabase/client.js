import { createBrowserClient } from '@supabase/ssr';
let browserClient = null;
let hasLoggedNetworkWarning = false;
const SUPABASE_FETCH_TIMEOUT_MS = 15000;
export function createClient() {
    if (browserClient) {
        return browserClient;
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase client env vars are missing. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.');
    }
    let parsedUrl;
    try {
        parsedUrl = new URL(supabaseUrl);
    }
    catch {
        throw new Error('NEXT_PUBLIC_SUPABASE_URL is not a valid URL.');
    }
    const createTimedSignal = (signal) => {
        const timeoutController = new AbortController();
        const timeoutId = window.setTimeout(() => {
            timeoutController.abort(new DOMException(`Supabase request timed out after ${SUPABASE_FETCH_TIMEOUT_MS}ms.`, 'TimeoutError'));
        }, SUPABASE_FETCH_TIMEOUT_MS);
        if (!signal) {
            return {
                signal: timeoutController.signal,
                cleanup: () => window.clearTimeout(timeoutId),
                didTimeout: () => timeoutController.signal.aborted,
            };
        }
        if (typeof AbortSignal.any === 'function') {
            return {
                signal: AbortSignal.any([signal, timeoutController.signal]),
                cleanup: () => window.clearTimeout(timeoutId),
                didTimeout: () => timeoutController.signal.aborted,
            };
        }
        const combinedController = new AbortController();
        const abortFromSignal = () => {
            combinedController.abort(signal.reason);
        };
        const abortFromTimeout = () => {
            combinedController.abort(timeoutController.signal.reason);
        };
        if (signal.aborted) {
            abortFromSignal();
        }
        else {
            signal.addEventListener('abort', abortFromSignal, { once: true });
        }
        if (timeoutController.signal.aborted) {
            abortFromTimeout();
        }
        else {
            timeoutController.signal.addEventListener('abort', abortFromTimeout, { once: true });
        }
        return {
            signal: combinedController.signal,
            cleanup: () => {
                window.clearTimeout(timeoutId);
                signal.removeEventListener('abort', abortFromSignal);
                timeoutController.signal.removeEventListener('abort', abortFromTimeout);
            },
            didTimeout: () => timeoutController.signal.aborted,
        };
    };
    const fetchWithGuard = async (input, init) => {
        const { signal, cleanup, didTimeout } = createTimedSignal(init?.signal);
        try {
            return await fetch(input, {
                ...init,
                signal,
            });
        }
        catch (error) {
            const isSupabaseRequest = typeof input === 'string'
                ? input.startsWith(parsedUrl.origin)
                : input instanceof URL
                    ? input.origin === parsedUrl.origin
                    : input instanceof Request
                        ? input.url.startsWith(parsedUrl.origin)
                        : false;
            if (isSupabaseRequest && !hasLoggedNetworkWarning) {
                hasLoggedNetworkWarning = true;
                const reason = didTimeout()
                    ? `the request exceeded ${SUPABASE_FETCH_TIMEOUT_MS}ms`
                    : typeof navigator !== 'undefined' && navigator.onLine === false
                        ? 'the browser appears to be offline'
                        : 'the Supabase project could not be reached';
                console.warn(`Supabase request failed because ${reason}. Check your internet connection, Supabase URL, and project availability.`);
            }
            throw error instanceof Error ? error : new Error('Supabase request failed.');
        }
        finally {
            cleanup();
        }
    };
    browserClient = createBrowserClient(supabaseUrl, supabaseAnonKey, {
        global: {
            fetch: fetchWithGuard,
        },
    });
    return browserClient;
}
