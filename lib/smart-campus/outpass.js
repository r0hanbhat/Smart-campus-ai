export const HOSTEL_OUTPASS_STATUSES = ['pending', 'approved', 'rejected'];

export function validateHostelOutpassRequest({ destination, purpose, departureAt, returnBy }, now = Date.now()) {
    if (
        typeof destination !== 'string'
        || typeof purpose !== 'string'
        || typeof departureAt !== 'string'
        || typeof returnBy !== 'string'
        || !destination.trim()
        || !purpose.trim()
        || !departureAt
        || !returnBy
    ) {
        return 'Destination, reason, departure time, and expected return time are required.';
    }
    if (destination.trim().length > 160 || purpose.trim().length > 1000) {
        return 'Destination must be under 160 characters and the reason under 1,000 characters.';
    }

    const departureTime = Date.parse(departureAt);
    const returnTime = Date.parse(returnBy);
    if (!Number.isFinite(departureTime) || !Number.isFinite(returnTime)) {
        return 'Enter valid departure and return times.';
    }
    if (departureTime <= now) {
        return 'Departure time must be in the future.';
    }
    if (returnTime <= departureTime) {
        return 'Expected return time must be after departure.';
    }
    return '';
}

export function normalizeHostelOutpassDecision(value) {
    return value === 'approved' || value === 'rejected' ? value : '';
}
