const pendingSessionReads = new WeakMap();

async function getSessionForHeaders(supabase) {
    let pendingRead = pendingSessionReads.get(supabase);
    if (!pendingRead) {
        pendingRead = (async () => {
            const { data, error } = await supabase.auth.getSession();
            if (error) {
                throw error;
            }

            let session = data?.session ?? null;
            if (session?.expires_at && session.expires_at * 1000 <= Date.now() + 30000) {
                const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
                if (refreshError) {
                    throw refreshError;
                }
                session = refreshedData?.session ?? null;
            }
            return session;
        })();
        pendingSessionReads.set(supabase, pendingRead);
    }

    try {
        return await pendingRead;
    } finally {
        if (pendingSessionReads.get(supabase) === pendingRead) {
            pendingSessionReads.delete(supabase);
        }
    }
}

export async function createSupabaseAuthHeaders(supabase, headers = {}) {
    const nextHeaders = new Headers(headers);
    if (nextHeaders.has('Authorization')) {
        return nextHeaders;
    }

    const session = await getSessionForHeaders(supabase);
    if (session?.access_token) {
        nextHeaders.set('Authorization', `Bearer ${session.access_token}`);
    }
    return nextHeaders;
}
