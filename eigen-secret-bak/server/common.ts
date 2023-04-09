export async function upsert(modelObj: any, newItem: any, condition: any, connection: any) {
    const found = await modelObj.findOne({ where: condition });
    if (!found) {
        const item = await modelObj.create(newItem, connection);
        return { item, created: true };
    }
    const item = modelObj.update(newItem, { where: condition }, connection);
    return { item, created: false };
}
