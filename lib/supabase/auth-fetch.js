export async function createSupabaseAuthHeaders(supabase, headers = {}) {
    const nextHeaders = new Headers(headers);
    const { data } = await supabase.auth.getSession();
    const accessToken = data?.session?.access_token;
    if (accessToken && !nextHeaders.has('Authorization')) {
        nextHeaders.set('Authorization', `Bearer ${accessToken}`);
    }
    return nextHeaders;
}
