export const MESS_DAYS = [
    { value: 0, label: 'Sunday' },
    { value: 1, label: 'Monday' },
    { value: 2, label: 'Tuesday' },
    { value: 3, label: 'Wednesday' },
    { value: 4, label: 'Thursday' },
    { value: 5, label: 'Friday' },
    { value: 6, label: 'Saturday' },
];

export const MESS_MEALS = [
    { value: 'breakfast', label: 'Breakfast' },
    { value: 'lunch', label: 'Lunch' },
    { value: 'snacks', label: 'Snacks' },
    { value: 'dinner', label: 'Dinner' },
];

const VALID_MEAL_TYPES = new Set(MESS_MEALS.map((meal) => meal.value));

export function normalizeMessMenuItems(value) {
    if (!Array.isArray(value) || value.length > MESS_DAYS.length * MESS_MEALS.length) {
        return null;
    }

    const items = [];
    const seen = new Set();
    for (const entry of value) {
        const dayOfWeek = entry?.dayOfWeek;
        const mealType = entry?.mealType;
        const menuText = typeof entry?.menuText === 'string' ? entry.menuText.trim() : '';
        if (!Number.isInteger(dayOfWeek) || dayOfWeek < 0 || dayOfWeek > 6 || !VALID_MEAL_TYPES.has(mealType)) {
            return null;
        }
        const key = `${dayOfWeek}:${mealType}`;
        if (seen.has(key)) {
            return null;
        }
        seen.add(key);
        if (!menuText) {
            continue;
        }
        if (menuText.length > 1000) {
            return null;
        }
        items.push({ dayOfWeek, mealType, menuText });
    }
    return items;
}

export function isValidMessDate(value) {
    if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
        return false;
    }
    const parsedDate = new Date(`${value}T00:00:00.000Z`);
    return !Number.isNaN(parsedDate.getTime()) && parsedDate.toISOString().slice(0, 10) === value;
}

export function summarizeMessRatings(rows, byDay = false) {
    const summaries = new Map();
    for (const row of rows || []) {
        if (
            !VALID_MEAL_TYPES.has(row?.meal_type)
            || !Number.isInteger(row?.rating)
            || row.rating < 1
            || row.rating > 5
        ) {
            continue;
        }
        const dayOfWeek = byDay && isValidMessDate(row.meal_date)
            ? new Date(`${row.meal_date}T00:00:00.000Z`).getUTCDay()
            : null;
        const key = byDay ? `${dayOfWeek}:${row.meal_type}` : row.meal_type;
        const summary = summaries.get(key) || { dayOfWeek, mealType: row.meal_type, total: 0, count: 0 };
        summary.total += row.rating;
        summary.count += 1;
        summaries.set(key, summary);
    }

    return [...summaries.values()].map(({ total, ...summary }) => ({
        ...summary,
        average: Math.round((total / summary.count) * 10) / 10,
    }));
}
