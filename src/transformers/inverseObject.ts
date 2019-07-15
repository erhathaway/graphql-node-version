export default <T = any>(obj: object) => {
    const keys = Object.keys(obj) as Array<keyof typeof obj>;
    return keys.reduce(
        (inverseColumnNamesObj, nodeName: keyof typeof obj) => {
            const sqlName = obj[nodeName];
            inverseColumnNamesObj[sqlName] = nodeName;
            return inverseColumnNamesObj;
        },
        {} as {[sqlName: string]: T}
    );
};
