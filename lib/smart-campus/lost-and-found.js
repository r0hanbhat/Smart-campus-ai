import { getCampusDate } from './event-checkin.js';

const MAX_TITLE_LENGTH = 100;
const MAX_DESCRIPTION_LENGTH = 1500;
const MAX_LOCATION_LENGTH = 160;
const MAX_CLAIM_MESSAGE_LENGTH = 1200;

function normalizeText(value, maxLength) {
    return typeof value === 'string' ? value.trim().slice(0, maxLength) : '';
}

function isValidDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function normalizeLostFoundItemInput(body, today = getCampusDate()) {
    const value = {
        itemType: body?.itemType ?? body?.item_type ?? 'found',
        title: normalizeText(body?.title, MAX_TITLE_LENGTH),
        description: normalizeText(body?.description, MAX_DESCRIPTION_LENGTH),
        location: normalizeText(body?.location ?? body?.foundLocation, MAX_LOCATION_LENGTH),
        date: typeof (body?.date ?? body?.foundDate) === 'string'
            ? body.date ?? body.foundDate
            : '',
    };

    if (!['lost', 'found'].includes(value.itemType)) {
        return { error: 'Choose whether you lost or found the item.' };
    }
    if (value.title.length < 3) {
        return { error: 'Item name must be at least 3 characters.' };
    }
    if (value.description.length < 10) {
        return { error: 'Add a few details to help someone identify the item.' };
    }
    if (value.location.length < 2) {
        return { error: value.itemType === 'lost' ? 'Enter where the item was last seen.' : 'Enter where the item was found.' };
    }
    if (!isValidDate(value.date) || value.date > today) {
        return { error: 'Choose a valid item date that is not in the future.' };
    }

    return { value };
}

export function normalizeLostFoundClaimMessage(value) {
    const message = normalizeText(value, MAX_CLAIM_MESSAGE_LENGTH);
    if (message.length < 10) {
        return { error: 'Add at least 10 characters of private details.' };
    }
    return { value: message };
}

export function normalizeLostFoundResponse(value) {
    const response = normalizeText(value, MAX_CLAIM_MESSAGE_LENGTH);
    return { value: response };
}

export function isValidLostFoundId(value) {
    return typeof value === 'string'
        && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}
