import { createClient } from '@supabase/supabase-js';

function readOption(name) {
    const flag = `--${name}`;
    const args = process.argv.slice(2);
    const flagIndex = args.indexOf(flag);
    if (flagIndex >= 0) {
        return args[flagIndex + 1]?.trim() || '';
    }
    return '';
}

function readRequiredValue(name, envKey) {
    const cliValue = readOption(name);
    const envValue = `${process.env[envKey] || ''}`.trim();
    const value = cliValue || envValue;
    if (!value) {
        throw new Error(`Missing ${name}. Provide --${name} or set ${envKey}.`);
    }
    return value;
}

function buildUsername(email, userId) {
    const emailPrefix = email.split('@')[0]?.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'admin';
    return `${emailPrefix}-${userId.slice(0, 4)}`;
}

async function findUserByEmail(supabase, email) {
    let page = 1;
    while (true) {
        const { data, error } = await supabase.auth.admin.listUsers({
            page,
            perPage: 200,
        });
        if (error) {
            throw new Error(`Failed to list users: ${error.message}`);
        }
        const users = data?.users || [];
        const match = users.find((user) => `${user.email || ''}`.toLowerCase() === email.toLowerCase());
        if (match) {
            return match;
        }
        if (users.length < 200) {
            return null;
        }
        page += 1;
    }
}

async function upsertProfile(supabase, { userId, email, adminId, fullName }) {
    const username = buildUsername(email, userId);
    const displayName = fullName || email.split('@')[0] || 'Admin';
    const { error } = await supabase.from('profiles').upsert({
        user_id: userId,
        username,
        display_name: displayName,
        full_name: fullName || null,
        email,
        role: 'admin',
        verification_status: 'approved',
        admin_id: adminId,
        is_online: false,
    }, { onConflict: 'user_id' });

    if (error) {
        throw new Error(`Failed to upsert admin profile: ${error.message}`);
    }
}

async function main() {
    const supabaseUrl = `${process.env.NEXT_PUBLIC_SUPABASE_URL || ''}`.trim();
    const serviceRoleKey = `${process.env.SUPABASE_SERVICE_ROLE_KEY || ''}`.trim();
    if (!supabaseUrl || !serviceRoleKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment.');
    }

    const email = readRequiredValue('email', 'ADMIN_EMAIL');
    const password = readRequiredValue('password', 'ADMIN_PASSWORD');
    const adminId = readRequiredValue('admin-id', 'ADMIN_ID');
    const fullName = readOption('name') || `${process.env.ADMIN_NAME || ''}`.trim() || 'System Admin';

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });

    const existingUser = await findUserByEmail(supabase, email);
    const userMetadata = {
        name: fullName,
        role: 'admin',
        adminId,
        verification_status: 'approved',
    };

    let userId;
    if (existingUser) {
        userId = existingUser.id;
        const { error } = await supabase.auth.admin.updateUserById(existingUser.id, {
            email,
            password,
            email_confirm: true,
            user_metadata: {
                ...existingUser.user_metadata,
                ...userMetadata,
            },
        });
        if (error) {
            throw new Error(`Failed to update admin user: ${error.message}`);
        }
    }
    else {
        const { data, error } = await supabase.auth.admin.createUser({
            email,
            password,
            email_confirm: true,
            user_metadata: userMetadata,
        });
        if (error || !data.user) {
            throw new Error(`Failed to create admin user: ${error?.message || 'Unknown error.'}`);
        }
        userId = data.user.id;
    }

    await upsertProfile(supabase, {
        userId,
        email,
        adminId,
        fullName,
    });

    console.log(`Admin account ready for ${email} with admin ID ${adminId}.`);
}

main().catch((error) => {
    const message = error instanceof Error ? error.message : 'Unknown provisioning error.';
    console.error(message);
    process.exitCode = 1;
});
