function sqlStringList(items: readonly string[]) {
    return items.map(item => `'${item.replaceAll("'", "''")}'`).join(",");
}

export function sqlSet(items: readonly string[]) {
    return `set(${sqlStringList(items)})`;
}