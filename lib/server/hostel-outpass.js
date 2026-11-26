import 'server-only';

export async function listHostelOutpassRequests(
    supabase,
    { blockIds = null, hostellerUserId = null, allRequests = false } = {},
) {
    if (!hostellerUserId && !Array.isArray(blockIds) && !allRequests) {
        throw new Error('A hosteller or assigned-block filter is required.');
    }

    let requestQuery = supabase
        .from('hostel_outpass_requests')
        .select('id, hosteller_user_id, block_id, room_number, destination, purpose, departure_at, return_by, status, created_at, updated_at, reviewed_at, exited_at, entered_at')
        .order('created_at', { ascending: false })
        .limit(100);

    if (hostellerUserId) {
        requestQuery = requestQuery.eq('hosteller_user_id', hostellerUserId);
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
    const requestBlockIds = [...new Set(requests.map((request) => request.block_id))];
    const hostellerIds = [...new Set(requests.map((request) => request.hosteller_user_id))];
    const [updatesResult, blocksResult, profilesResult] = await Promise.all([
        supabase
            .from('hostel_outpass_updates')
            .select('id, request_id, status, message, actor_role, actor_name, created_at')
            .in('request_id', requestIds)
            .order('created_at', { ascending: true }),
        supabase
            .from('hostel_blocks')
            .select('id, name')
            .in('id', requestBlockIds),
        supabase
            .from('profiles')
            .select('user_id, roll_number, display_name, full_name')
            .in('user_id', hostellerIds),
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
        const profile = profiles.get(request.hosteller_user_id);
        return {
            id: request.id,
            destination: request.destination,
            purpose: request.purpose,
            departureAt: request.departure_at,
            returnBy: request.return_by,
            status: request.status,
            createdAt: request.created_at,
            updatedAt: request.updated_at,
            reviewedAt: request.reviewed_at,
            exitedAt: request.exited_at,
            enteredAt: request.entered_at,
            blockName: blockNames.get(request.block_id) || 'Unknown block',
            roomNumber: request.room_number,
            hosteller: {
                rollNumber: profile?.roll_number || '',
                name: profile?.display_name || profile?.full_name || profile?.roll_number || 'Hosteller',
            },
            timeline: updatesByRequest.get(request.id) || [],
        };
    });
}
