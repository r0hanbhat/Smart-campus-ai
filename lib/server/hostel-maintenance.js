import 'server-only';

export async function listHostelMaintenanceRequests(supabase, { blockIds = null, reporterUserId = null } = {}) {
    if (!reporterUserId && !Array.isArray(blockIds)) {
        throw new Error('A hosteller or assigned-block filter is required.');
    }

    let requestQuery = supabase
        .from('hostel_maintenance_requests')
        .select('id, reporter_user_id, block_id, room_number, category, title, description, status, created_at, updated_at, resolved_at')
        .order('created_at', { ascending: false });

    if (reporterUserId) {
        requestQuery = requestQuery.eq('reporter_user_id', reporterUserId);
    } else if (Array.isArray(blockIds)) {
        if (blockIds.length === 0) {
            return [];
        }
        requestQuery = requestQuery.in('block_id', blockIds);
    }

    const { data: requests, error: requestsError } = await requestQuery;
    if (requestsError) {
        throw requestsError;
    }
    if (!requests?.length) {
        return [];
    }

    const requestIds = requests.map((request) => request.id);
    const blockIdsInRequests = [...new Set(requests.map((request) => request.block_id))];
    const reporterIds = [...new Set(requests.map((request) => request.reporter_user_id))];
    const [updatesResult, blocksResult, profilesResult] = await Promise.all([
        supabase
            .from('hostel_maintenance_updates')
            .select('id, request_id, status, message, actor_role, actor_name, created_at')
            .in('request_id', requestIds)
            .order('created_at', { ascending: true }),
        supabase
            .from('hostel_blocks')
            .select('id, name')
            .in('id', blockIdsInRequests),
        supabase
            .from('profiles')
            .select('user_id, roll_number, display_name, full_name')
            .in('user_id', reporterIds),
    ]);

    const queryError = [updatesResult, blocksResult, profilesResult].find((result) => result.error)?.error;
    if (queryError) {
        throw queryError;
    }

    const blockNames = new Map((blocksResult.data || []).map((block) => [block.id, block.name]));
    const profiles = new Map((profilesResult.data || []).map((profile) => [profile.user_id, profile]));
    const updatesByRequest = new Map();
    for (const update of updatesResult.data || []) {
        const updates = updatesByRequest.get(update.request_id) || [];
        updates.push({
            id: update.id,
            status: update.status,
            message: update.message,
            actorRole: update.actor_role,
            actorName: update.actor_name,
            createdAt: update.created_at,
        });
        updatesByRequest.set(update.request_id, updates);
    }

    return requests.map((request) => {
        const profile = profiles.get(request.reporter_user_id);
        return {
            id: request.id,
            title: request.title,
            description: request.description,
            category: request.category,
            status: request.status,
            blockName: blockNames.get(request.block_id) || 'Unknown block',
            roomNumber: request.room_number,
            createdAt: request.created_at,
            updatedAt: request.updated_at,
            resolvedAt: request.resolved_at,
            reporter: {
                rollNumber: profile?.roll_number || '',
                name: profile?.display_name || profile?.full_name || profile?.roll_number || 'Hosteller',
            },
            timeline: updatesByRequest.get(request.id) || [],
        };
    });
}
