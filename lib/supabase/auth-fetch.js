export async function createSupabaseAuthHeaders(supabase, headers = {}) {
    const nextHeaders = new Headers(headers);

    // Prefer a verified current user call so we do not send stale JWTs from
    // local storage to Next route handlers after the session has rotated.
    const { data: userData, error: userError } = await supabase.auth.getUser();
    if (userError) {
        throw userError;
    }

    let { data: sessionData } = await supabase.auth.getSession();
    let accessToken = sessionData?.session?.access_token;

    if (!accessToken && userData?.user) {
        const { data: refreshedData, error: refreshError } = await supabase.auth.refreshSession();
        if (refreshError) {
            throw refreshError;
        }
        sessionData = refreshedData;
        accessToken = refreshedData?.session?.access_token;
    }

    if (accessToken && !nextHeaders.has('Authorization')) {
        nextHeaders.set('Authorization', `Bearer ${accessToken}`);
    }
    return nextHeaders;
}
