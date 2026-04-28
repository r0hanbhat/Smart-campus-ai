export function getMissingSchemaColumn(error) {
    const message = error?.message;
    if (typeof message !== 'string') {
        return null;
    }
    const postgrestMatch = message.match(/Could not find the '([^']+)' column/i);
    if (postgrestMatch?.[1]) {
        return postgrestMatch[1];
    }
    const postgresMatch = message.match(/column\s+(?:"?[\w-]+"?\.)?"?([\w-]+)"?\s+does not exist/i);
    return postgresMatch?.[1] ?? null;
}

export function isMissingSchemaColumnError(error, columnName) {
    return getMissingSchemaColumn(error) === columnName;
}

export function getMissingSchemaTable(error) {
    const message = error?.message;
    if (typeof message !== 'string') {
        return null;
    }
    const match = message.match(/Could not find the table '([^']+)'/i);
    if (!match?.[1]) {
        return null;
    }
    const [, tableName] = match;
    return tableName.includes('.') ? tableName.split('.').at(-1) ?? null : tableName;
}

export function isMissingSchemaTableError(error, tableName) {
    const missingTable = getMissingSchemaTable(error);
    return missingTable === tableName || error?.code === 'PGRST205';
}

function omitColumn(payload, columnName) {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return payload;
    }
    const { [columnName]: omittedValue, ...rest } = payload;
    void omittedValue;
    return rest;
}

export async function withMissingColumnFallback(execute, payload, fallbackColumns = []) {
    const allowedColumns = new Set(fallbackColumns);
    let nextPayload = payload;
    let result = await execute(nextPayload);

    while (result?.error) {
        const missingColumn = getMissingSchemaColumn(result.error);
        if (!missingColumn || !allowedColumns.has(missingColumn)) {
            break;
        }
        allowedColumns.delete(missingColumn);
        nextPayload = omitColumn(nextPayload, missingColumn);
        result = await execute(nextPayload);
    }

    return result;
}

export async function withMissingSelectColumnsFallback(execute, columns, fallbackColumns = []) {
    const allowedColumns = new Set(fallbackColumns);
    let nextColumns = Array.isArray(columns) ? [...columns] : [];
    let result = await execute(nextColumns);

    while (result?.error) {
        const missingColumn = getMissingSchemaColumn(result.error);
        if (!missingColumn || !allowedColumns.has(missingColumn)) {
            break;
        }
        allowedColumns.delete(missingColumn);
        nextColumns = nextColumns.filter((columnName) => columnName !== missingColumn);
        result = await execute(nextColumns);
    }

    return result;
}
