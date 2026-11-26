export const FACILITY_RESOURCE_CODES = {
    hostel_laundry: { label: 'Laundry slots', scope: 'hostel' },
    hostel_reading_room: { label: 'Reading room', scope: 'hostel' },
    campus_library_seat: { label: 'Library seat booking', scope: 'campus' },
    campus_cafeteria_seat: { label: 'Cafeteria seat', scope: 'campus' },
};

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export function isValidFacilityDate(value) {
    if (typeof value !== 'string' || !DATE_PATTERN.test(value)) {
        return false;
    }
    const date = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

function getMonthEnd(value) {
    const date = new Date(`${value}T00:00:00.000Z`);
    date.setUTCMonth(date.getUTCMonth() + 1, 0);
    return date.toISOString().slice(0, 10);
}

function toMinutes(value) {
    const match = typeof value === 'string' ? TIME_PATTERN.exec(value) : null;
    return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

export function normalizeFacilitySchedule(input, { resourceCode } = {}) {
    const resourceId = typeof input?.resourceId === 'string' ? input.resourceId.trim() : '';
    const weekdays = input?.weekday === 'every_day'
        ? [0, 1, 2, 3, 4, 5, 6]
        : [Number(input?.weekday)];
    const blockIds = Array.isArray(input?.blockIds)
        ? input.blockIds.filter((blockId) => typeof blockId === 'string').map((blockId) => blockId.trim())
        : [];
    const opensAt = typeof input?.opensAt === 'string' ? input.opensAt.trim() : '';
    const closesAt = typeof input?.closesAt === 'string' ? input.closesAt.trim() : '';
    const slotMinutes = Number(input?.slotMinutes);
    const capacity = Number(input?.capacity);
    const activeFrom = typeof input?.activeFrom === 'string' ? input.activeFrom.trim() : '';
    const activeUntil = typeof input?.activeUntil === 'string' && input.activeUntil.trim()
        ? input.activeUntil.trim()
        : null;
    const openMinutes = toMinutes(opensAt);
    const closeMinutes = toMinutes(closesAt);

    if (!UUID_PATTERN.test(resourceId)) {
        return { error: 'Choose a facility.' };
    }
    if (weekdays.some((weekday) => !Number.isInteger(weekday) || weekday < 0 || weekday > 6)) {
        return { error: 'Choose a valid weekday.' };
    }
    if (openMinutes === null || closeMinutes === null || closeMinutes <= openMinutes) {
        return { error: 'Enter a valid opening and closing time.' };
    }
    if (!Number.isInteger(slotMinutes) || slotMinutes < 15 || slotMinutes > 240) {
        return { error: 'Slot length must be between 15 and 240 minutes.' };
    }
    if ((closeMinutes - openMinutes) % slotMinutes !== 0) {
        return { error: 'The opening window must divide evenly into slots.' };
    }
    if (!Number.isInteger(capacity) || capacity < 1 || capacity > 1000) {
        return { error: 'Capacity must be between 1 and 1,000.' };
    }
    if (!isValidFacilityDate(activeFrom) || (activeUntil && !isValidFacilityDate(activeUntil))) {
        return { error: 'Enter a valid active date range.' };
    }
    if (activeUntil && activeUntil < activeFrom) {
        return { error: 'The end date must be on or after the start date.' };
    }
    if (resourceCode === 'hostel_laundry') {
        const weekStart = new Date(`${activeFrom}T00:00:00.000Z`);
        const weekEnd = activeUntil ? new Date(`${activeUntil}T00:00:00.000Z`) : null;
        if (
            weekdays.length !== 7
            || weekStart.getUTCDay() !== 1
            || !weekEnd
            || weekEnd.getTime() - weekStart.getTime() !== 6 * 24 * 60 * 60 * 1000
        ) {
            return { error: 'Laundry availability must cover one Monday–Sunday week.' };
        }
        if (
            blockIds.length === 0
            || blockIds.some((blockId) => !UUID_PATTERN.test(blockId))
            || new Set(blockIds).size !== blockIds.length
        ) {
            return { error: 'Choose one or more valid hostel blocks for laundry availability.' };
        }
    }
    if (resourceCode === 'hostel_reading_room') {
        const monthStart = new Date(`${activeFrom}T00:00:00.000Z`);
        if (
            weekdays.length !== 7
            || monthStart.getUTCDate() !== 1
            || activeUntil !== getMonthEnd(activeFrom)
            || capacity !== 200
        ) {
            return { error: 'Reading-room availability must cover one calendar month with 200 seats per slot.' };
        }
    }
    if (resourceCode !== 'hostel_laundry' && resourceCode !== 'hostel_reading_room' && blockIds.length > 0) {
        return { error: 'Block-specific publishing is only available for hostel laundry.' };
    }

    return {
        value: {
            resourceId,
            weekdays,
            blockIds,
            opensAt: `${opensAt}:00`,
            closesAt: `${closesAt}:00`,
            slotMinutes,
            capacity,
            activeFrom,
            activeUntil,
        },
    };
}

export function normalizeFacilityBookingInput(input) {
    const scheduleId = typeof input?.scheduleId === 'string' ? input.scheduleId.trim() : '';
    const slotDate = typeof input?.slotDate === 'string' ? input.slotDate.trim() : '';
    const slotStart = typeof input?.slotStart === 'string' ? input.slotStart.trim() : '';
    if (!UUID_PATTERN.test(scheduleId) || !isValidFacilityDate(slotDate) || !/^([01]\d|2[0-3]):[0-5]\d(:[0-5]\d)?$/.test(slotStart)) {
        return { error: 'Choose a valid available slot.' };
    }
    return { value: { scheduleId, slotDate, slotStart } };
}
