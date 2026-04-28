import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
export async function createSupabaseServerClient() {
    const cookieStore = (await cookies());
    return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
        cookies: {
            get(name) {
                return cookieStore.get(name)?.value;
            },
            set(name, value) {
                cookieStore.set?.(name, value);
            },
            remove(name) {
                cookieStore.delete?.(name);
            },
        },
    });
}
export function createSupabaseServiceRoleClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    }
    return createServerClient(supabaseUrl, serviceRoleKey, {
        cookies: {
            get() {
                return undefined;
            },
            set() { },
            remove() { },
        },
    });
}
export async function getAuthenticatedUser() {
    const supabase = await createSupabaseServerClient();
    const { data: { user }, error, } = await supabase.auth.getUser();
    return { supabase, user, error };
}
