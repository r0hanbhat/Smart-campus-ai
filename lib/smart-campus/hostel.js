export function normalizeWardenId(value) {
    return typeof value === 'string' ? value.trim().toUpperCase() : '';
}

export function normalizeHostelBlockName(value) {
    return typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
}

export const HOSTEL_MAINTENANCE_CATEGORIES = ['Plumbing', 'Electrical', 'WiFi', 'Cleanliness', 'Other'];
export const HOSTEL_MAINTENANCE_STATUSES = ['submitted', 'in_progress', 'awaiting_student', 'resolved'];

export function normalizeHostelMaintenanceCategory(value) {
    return HOSTEL_MAINTENANCE_CATEGORIES.includes(value) ? value : '';
}

export function normalizeHostelMaintenanceStatus(value) {
    return HOSTEL_MAINTENANCE_STATUSES.includes(value) ? value : '';
}

export function validateHostelMaintenanceReport({ title, description, category }) {
    if (
        typeof title !== 'string'
        || typeof description !== 'string'
        || !title.trim()
        || !description.trim()
        || !HOSTEL_MAINTENANCE_CATEGORIES.includes(category)
    ) {
        return 'Title, description, and a valid category are required.';
    }
    if (title.trim().length > 120 || description.trim().length > 2000) {
        return 'Keep the title under 120 characters and the description under 2,000 characters.';
    }
    return '';
}
