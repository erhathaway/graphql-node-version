import { DateTime } from 'luxon';
import { ConnectionManager } from '@social-native/snpkg-snapi-connections';
import Bluebird from 'bluebird';

/**
 * Sets the names for tables and columns that revisions will be stored in
 *
 * Allows users to specify their own column and table names. If none are specified, the defaults will be used.
 */
var DEFAULT_TABLE_NAMES;
(function (DEFAULT_TABLE_NAMES) {
    DEFAULT_TABLE_NAMES["revision"] = "revision";
    DEFAULT_TABLE_NAMES["revisionRole"] = "revision_role";
    DEFAULT_TABLE_NAMES["revisionUserRole"] = "revision_user_roles";
    DEFAULT_TABLE_NAMES["revisionNodeSnapshot"] = "revision_node_snapshot";
    DEFAULT_TABLE_NAMES["revisionEdge"] = "revision_edge";
    DEFAULT_TABLE_NAMES["revisionFragment"] = "revision_fragment";
})(DEFAULT_TABLE_NAMES || (DEFAULT_TABLE_NAMES = {}));
var DEFAULT_COLUMN_NAMES;
(function (DEFAULT_COLUMN_NAMES) {
    // revision table
    DEFAULT_COLUMN_NAMES["revisionId"] = "id";
    DEFAULT_COLUMN_NAMES["revisionTime"] = "revision_created_at";
    DEFAULT_COLUMN_NAMES["userId"] = "user_id";
    DEFAULT_COLUMN_NAMES["revisionData"] = "revision";
    DEFAULT_COLUMN_NAMES["nodeName"] = "node_name";
    DEFAULT_COLUMN_NAMES["nodeSchemaVersion"] = "node_schema_version";
    DEFAULT_COLUMN_NAMES["nodeId"] = "node_id";
    DEFAULT_COLUMN_NAMES["resolverOperation"] = "resolver_operation";
    // revision node snapshot table
    DEFAULT_COLUMN_NAMES["snapshotId"] = "id";
    DEFAULT_COLUMN_NAMES["snapshotTime"] = "snapshot_created_at";
    DEFAULT_COLUMN_NAMES["snapshotData"] = "previous_node_version_snapshot";
    // revision role table
    DEFAULT_COLUMN_NAMES["roleId"] = "id";
    DEFAULT_COLUMN_NAMES["roleName"] = "role_name";
    // revision user roles
    DEFAULT_COLUMN_NAMES["userRoleId"] = "id";
    // revision edge
    DEFAULT_COLUMN_NAMES["revisionEdgeId"] = "id";
    DEFAULT_COLUMN_NAMES["revisionEdgeTime"] = "created_at";
    DEFAULT_COLUMN_NAMES["edgeNodeNameA"] = "node_name_a";
    DEFAULT_COLUMN_NAMES["edgeNodeIdA"] = "node_id_a";
    DEFAULT_COLUMN_NAMES["edgeNodeNameB"] = "node_name_b";
    DEFAULT_COLUMN_NAMES["edgeNodeIdB"] = "node_id_b";
    // revision fragment
    DEFAULT_COLUMN_NAMES["revisionFragmentId"] = "id";
    DEFAULT_COLUMN_NAMES["revisionFragmentTime"] = "created_at";
    DEFAULT_COLUMN_NAMES["fragmentParentNodeId"] = "parent_node_id";
    DEFAULT_COLUMN_NAMES["fragmentParentNodeName"] = "parent_node_name";
})(DEFAULT_COLUMN_NAMES || (DEFAULT_COLUMN_NAMES = {}));
const setNames = ({ tableNames, columnNames }) => ({
    tableNames: {
        ...DEFAULT_TABLE_NAMES,
        ...tableNames
    },
    columnNames: {
        ...DEFAULT_COLUMN_NAMES,
        ...columnNames
    }
});
//# sourceMappingURL=sqlNames.js.map

/**
 * Logic:
 * 1. Get all revisions in range of connection
 * 2. Calculate full nodes for all revisions in range
 * 3. Get revisions in connection (filters may apply etc)
 */
var versionConnection = (extractors, config) => {
    return (_target, _property, descriptor) => {
        const nodeToSqlNameMappings = setNames(config || {});
        const { value } = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }
        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient = extractors.knex && extractors.knex(...args);
            const [parent, ar, ctx, info] = args;
            const latestNode = (await value(parent, ar, ctx, info));
            // Step 1. Get all versions for the connection
            // console.log('ARRRRR', ar);
            // if (
            //     ((ar as IInputArgs).first && ar.first <= 1) ||
            //     (ar.first === undefined && ar.last === undefined)
            // ) {
            //     console.log('RETURNING PLAIN NODE', '')
            //     return node;
            // }
            const revisionsOfInterest = await getRevisionsOfInterest(args, localKnexClient, nodeToSqlNameMappings, extractors);
            // Step 2. Get all the revisions + snapshots used to calculate the oldest revision in
            // the `revisionsOfInterest` array.
            console.log('REVISIONS OF INTEREST', revisionsOfInterest.edges);
            if (revisionsOfInterest.edges.length === 0) {
                return revisionsOfInterest;
            }
            // console.log('WAHHTT', nodesAndRevisionsOfInterest);
            const a = await getFirstRevisionNumberWithSnapshot(revisionsOfInterest, 
            // ar,
            localKnexClient, nodeToSqlNameMappings
            // extractors
            );
            console.log('hi', a);
            const maxRevisionNumber = revisionsOfInterest.edges[0].node.revisionId;
            const minRevisionNumber = a;
            const { nodeId, nodeName } = revisionsOfInterest.edges[0].node;
            const revisionsInRange = await getRevisionsInRange(maxRevisionNumber, minRevisionNumber, nodeId, nodeName, localKnexClient, nodeToSqlNameMappings);
            console.log('INNNNN RANGE', revisionsInRange);
            const nodesInRange = revisionsInRange.reduce((nodes, revision, index) => {
                console.log('-----------------------------');
                const { revisionId, snapshotData, revisionData } = revision;
                if (index === 0 || snapshotData) {
                    console.log('Using snapshot for', revisionId);
                    nodes[revisionId] =
                        typeof snapshotData === 'string'
                            ? JSON.parse(snapshotData)
                            : snapshotData;
                }
                else {
                    console.log('Calculating node for', revisionId);
                    const previousRevision = revisionsInRange[index - 1];
                    const calculatedNode = extractors.nodeBuilder(nodes[previousRevision.revisionId], revision);
                    console.log('Calculated node', calculatedNode);
                    console.log('Calculated diff', revisionData);
                    nodes[revisionId] = calculatedNode;
                }
                return nodes;
            }, {});
            const latestCalculatedNode = nodesInRange[nodesInRange.length - 1];
            console.log('Comparing nodes', latestCalculatedNode, latestNode);
            console.log('NODES IN RANGE', nodesInRange);
            const newEdges = revisionsOfInterest.edges.map(edge => {
                const { revisionData, userId, nodeName: nn, nodeSchemaVersion, resolverOperation, revisionTime, revisionId, userRoles } = edge.node;
                const version = {
                    revisionData,
                    userId,
                    nodeName: nn,
                    nodeSchemaVersion,
                    resolverOperation,
                    revisionTime,
                    revisionId,
                    userRoles
                };
                const calculatedNode = nodesInRange[edge.node.revisionId];
                return { ...edge, node: calculatedNode, version };
            });
            return { pageInfo: revisionsOfInterest.pageInfo, edges: newEdges };
        });
        return descriptor;
    };
};
/**
 * Gets the closest revision with a snapshot to the oldest revision of interest
 * This will be the initial snapshot that full nodes are calculated off of
 */
const getFirstRevisionNumberWithSnapshot = async (revisionsOfInterest, knex, nodeToSqlNameMappings) => {
    const firstRevisionInRange = revisionsOfInterest.edges[revisionsOfInterest.edges.length - 1];
    const hasSnapshotData = !!firstRevisionInRange.node.snapshotData;
    if (hasSnapshotData) {
        return firstRevisionInRange.node.revisionId;
    }
    const { nodeId, revisionId: lastRevisionId } = firstRevisionInRange.node;
    const result = (await knex
        .queryBuilder()
        .from(nodeToSqlNameMappings.tableNames.revision)
        .leftJoin(nodeToSqlNameMappings.tableNames.revisionNodeSnapshot, `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`)
        .where({
        [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId}`]: nodeId
    })
        .whereNotNull(`${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotId}` // tslint:disable-line
    )
        .andWhere(`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`, '<', `${lastRevisionId} `)
        .select(`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId} as revisionId` // tslint:disable-line
    )
        .orderBy(`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`, 'desc')
        .first());
    return result.revisionId;
};
const getRevisionsInRange = async (maxRevisionNumber, minRevisionNumber, nodeId, nodeName, knex, nodeToSqlNameMappings) => {
    const query = (await knex
        .queryBuilder()
        .table(nodeToSqlNameMappings.tableNames.revision)
        .leftJoin(nodeToSqlNameMappings.tableNames.revisionNodeSnapshot, `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`)
        .where({
        [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId}`]: nodeId,
        [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName}`]: nodeName // tslint:disable-line
    })
        .andWhere(`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`, '<=', `${maxRevisionNumber} `)
        .andWhere(`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`, '>=', `${minRevisionNumber} `)
        .select(`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionData} as revisionData`, // tslint:disable-line
    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime} as revisionTime`, // tslint:disable-line
    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeSchemaVersion} as nodeSchemaVersion`, // tslint:disable-line
    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName} as nodeName`, // tslint:disable-line
    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId} as nodeId`, // tslint:disable-line
    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.resolverOperation} as resolverOperation`, // tslint:disable-line
    `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId} as revisionId`, // tslint:disable-line
    `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotData} as snapshotData` // tslint:disable-line
    )
        .orderBy(`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`, 'asc'));
    return query;
};
const castUnixToDateTime = (filter) => {
    console.log('!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!');
    if (filter.field === 'revisionTime') {
        const date = parseInt(filter.value, 10);
        const value = unixSecondsToSqlTimestamp(date);
        console.log(`Changing revision time from ${filter.value}, to: ${value}`);
        return {
            ...filter,
            value
        };
    }
    return filter;
};
const castDateTimeToUnixSecs = (node) => {
    const { revisionTime } = node;
    const newRevisionTime = castDateToUTCSeconds(revisionTime);
    console.log('~~~~~~~~~~~', `from: ${revisionTime}`, 'to :', newRevisionTime);
    return {
        ...node,
        revisionTime: newRevisionTime
    };
};
const getRevisionsOfInterest = async (resolverArgs, knex, nodeToSqlNameMappings, extractors) => {
    const attributeMap = {
        ...nodeToSqlNameMappings.columnNames,
        id: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
        revisionId: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`,
        revisionTime: `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime}`,
        userRoles: `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleName}`
    };
    // force orderDir to be 'desc' b/c last is most recent in versions
    // const newInputArgs = {...inputArgs, orderDir: 'desc'};
    const nodeConnection = new ConnectionManager(resolverArgs[1], attributeMap, {
        builderOptions: {
            filterTransformer: castUnixToDateTime
        },
        resultOptions: {
            nodeTransformer: castDateTimeToUnixSecs
        }
    });
    const nodeId = extractors.nodeId(...resolverArgs);
    const nodeName = extractors.nodeName(...resolverArgs);
    const query = knex
        .queryBuilder()
        .from(function () {
        // const {roleName, snapshot: unusedSnapshot, ...attributes} = attributeMap;
        const queryBuilder = this.table(nodeToSqlNameMappings.tableNames.revision)
            .leftJoin(nodeToSqlNameMappings.tableNames.revisionNodeSnapshot, `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`)
            .leftJoin(nodeToSqlNameMappings.tableNames.revisionUserRole, `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`)
            .leftJoin(nodeToSqlNameMappings.tableNames.revisionRole, `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revisionRole}_${nodeToSqlNameMappings.columnNames.roleId}`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleId}`)
            .where({
            [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId}`]: nodeId,
            [`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName}`]: nodeName // tslint:disable-line
        })
            .select(`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId} as revisionId`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionTime} as revisionTime`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionData} as revisionData`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeName} as nodeName`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeSchemaVersion} as nodeSchemaVersion`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.nodeId} as nodeId`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.resolverOperation} as resolverOperation`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.userId} as userId`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotData} as snapshotData`, // tslint:disable-line
        `${nodeToSqlNameMappings.tableNames.revisionNodeSnapshot}.${nodeToSqlNameMappings.columnNames.snapshotTime} as snapshotTime` // tslint:disable-line
        )
            .orderBy(`${nodeToSqlNameMappings.tableNames.revision}.${nodeToSqlNameMappings.columnNames.revisionId}`, 'desc');
        nodeConnection.createQuery(queryBuilder).as('main');
        console.log('QUERY', queryBuilder.toSQL());
    })
        .leftJoin(nodeToSqlNameMappings.tableNames.revisionUserRole, `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revision}_${nodeToSqlNameMappings.columnNames.revisionId}`, // tslint:disable-line
    `main.revisionId`)
        .leftJoin(nodeToSqlNameMappings.tableNames.revisionRole, `${nodeToSqlNameMappings.tableNames.revisionUserRole}.${nodeToSqlNameMappings.tableNames.revisionRole}_${nodeToSqlNameMappings.columnNames.roleId}`, // tslint:disable-line
    `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleId}`)
        .select('revisionId', // tslint:disable-line
    'revisionTime', // tslint:disable-line
    'revisionData', // tslint:disable-line
    'nodeName', // tslint:disable-line
    'nodeSchemaVersion', // tslint:disable-line
    'nodeId', // tslint:disable-line
    'resolverOperation', // tslint:disable-line
    'userId', // tslint:disable-line
    'snapshotData', // tslint:disable-line
    'snapshotTime', // tslint:disable-line
    `${nodeToSqlNameMappings.tableNames.revisionRole}.${nodeToSqlNameMappings.columnNames.roleName} as roleName` // tslint:disable-line
    );
    const nodeResult = await query;
    const uniqueVersions = aggregateVersionsById(nodeResult);
    nodeConnection.addResult(uniqueVersions);
    const { pageInfo, edges } = nodeConnection;
    return { pageInfo, edges };
};
/**
 * B/c user roles are 1:many with a revision we have duplicates of revisions
 * for each user role. Thus, we need to combine user roles together into an array for
 * each duplicate of a revision.
 */
const aggregateVersionsById = (nodeVersions) => {
    // extract all the user roles for the version
    const rolesByRevisionId = nodeVersions.reduce((rolesObj, { revisionId, roleName }) => {
        const roleNames = rolesObj[revisionId] || [];
        rolesObj[revisionId] = roleNames.includes(roleName)
            ? roleNames
            : [...roleNames, roleName];
        return rolesObj;
    }, {});
    // map over the versions
    // - aggregate by version id
    // - serialize revision data to json if its not already
    // - add user roles
    const versions = nodeVersions.reduce((uniqueVersions, version) => {
        if (uniqueVersions[version.revisionId]) {
            return uniqueVersions;
        }
        uniqueVersions[version.revisionId] = {
            ...version,
            userRoles: rolesByRevisionId[version.revisionId],
            revisionData: typeof version.revisionData === 'string'
                ? version.revisionData
                : JSON.stringify(version.revisionData)
        };
        return uniqueVersions;
    }, {});
    // make sure versions are returned in the same order as they came in
    return [...new Set(nodeVersions.map(({ revisionId }) => revisionId))].map(id => versions[id]);
};
const castDateToUTCSeconds = (date) => {
    return isDate(date) ? DateTime.fromJSDate(date, { zone: 'local' }).toSeconds() : null;
};
const isDate = (date) => {
    return date instanceof Date;
};
const unixSecondsToSqlTimestamp = (unixSeconds) => {
    return DateTime.fromSeconds(unixSeconds)
        .toUTC()
        .toSQL({ includeOffset: true, includeZone: true });
};
//# sourceMappingURL=versionConnection.js.map

var nodeToSql = (nodeToSqlNameMappings, nodeData) => {
    const { columnNames } = nodeToSqlNameMappings;
    const nodeNames = Object.keys(columnNames);
    return nodeNames.reduce((sqlData, nodeName) => {
        const sqlName = columnNames[nodeName];
        const data = nodeData[nodeName];
        if (data) {
            sqlData[sqlName] = data;
        }
        return sqlData;
    }, {});
};
//# sourceMappingURL=nodeToSql.js.map

const findOrCreateKnexTransaction = async (knex) => {
    return await knex.transaction();
};
const createRevisionTransaction = (config) => async (transaction, input) => {
    const nodeToSqlNameMappings = setNames(config || {});
    const { userRoles, ...mainTableInput } = input;
    const sqlData = nodeToSql(nodeToSqlNameMappings, mainTableInput);
    const revisionId = (await transaction
        .table(nodeToSqlNameMappings.tableNames.revision)
        .insert(sqlData)
        .returning('id'))[0];
    const roles = userRoles || [];
    // calculate which role are missing in the db
    const foundRoleNames = await transaction
        .table(nodeToSqlNameMappings.tableNames.revisionRole)
        .whereIn(nodeToSqlNameMappings.columnNames.roleName, roles);
    const foundRoles = foundRoleNames.map((n) => n[nodeToSqlNameMappings.columnNames.roleName]);
    const missingRoles = roles.filter(i => foundRoles.indexOf(i) < 0);
    // insert the missing roles
    await transaction.table(nodeToSqlNameMappings.tableNames.revisionRole).insert(missingRoles.map((role) => ({
        [nodeToSqlNameMappings.columnNames.roleName]: role
    })));
    // select the role ids
    const ids = (await transaction
        .table(nodeToSqlNameMappings.tableNames.revisionRole)
        .whereIn(nodeToSqlNameMappings.columnNames.roleName, roles));
    // insert roles ids associated with the revision id
    await transaction.table(nodeToSqlNameMappings.tableNames.revisionUserRole).insert(ids.map(({ id }) => ({
        [`${nodeToSqlNameMappings.tableNames.revisionRole}_id`]: id,
        [`${nodeToSqlNameMappings.tableNames.revision}_id`]: revisionId
    })));
    setTimeout(async () => {
        await transaction.rollback();
        // throw new Error('Detected an orphaned transaction');
    }, ((config && config.transactionTimeoutSeconds) || 10) * 1000);
    return revisionId;
};
const getResolverOperation = (extractors, property) => {
    const rawResolverOperation = extractors.resolverOperation
        ? extractors.resolverOperation
        : property;
    return typeof rawResolverOperation === 'symbol'
        ? rawResolverOperation.toString()
        : rawResolverOperation;
};
var versionRecorder = (extractors, config) => {
    return (_target, property, descriptor) => {
        const { tableNames, columnNames } = setNames(config || {});
        const { value } = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }
        // tslint:disable-next-line
        descriptor.value = (async (...args) => {
            const localKnexClient = extractors.knex(args[0], args[1], args[2], args[3]);
            const userId = extractors.userId(args[0], args[1], args[2], args[3]);
            const revisionData = extractors.revisionData(args[0], args[1], args[2], args[3]);
            const nodeSchemaVersion = extractors.nodeSchemaVersion;
            const nodeName = extractors.nodeName;
            const snapshotFrequency = extractors.currentNodeSnapshotFrequency
                ? extractors.currentNodeSnapshotFrequency
                : 1;
            const userRoles = extractors.userRoles
                ? extractors.userRoles(args[0], args[1], args[2], args[3])
                : [];
            const revisionTime = extractors.revisionTime
                ? extractors.revisionTime(args[0], args[1], args[2], args[3])
                : new Date()
                    .toISOString()
                    .split('Z')
                    .join('');
            const resolverOperation = getResolverOperation(extractors, property);
            const edgesToRecord = extractors.edges
                ? extractors.edges(args[0], args[1], args[2], args[3])
                : undefined;
            const transaction = await findOrCreateKnexTransaction(localKnexClient);
            const [parent, ar, ctx, info] = args;
            let newArgs = {};
            if (extractors.passThroughTransaction && extractors.passThroughTransaction === true) {
                newArgs = { ...ar, transaction };
            }
            else {
                newArgs = { ...ar };
            }
            const node = (await value(parent, newArgs, ctx, info));
            const nodeId = extractors.nodeId(node, args[0], args[1], args[2], args[3]);
            if (nodeId === undefined) {
                throw new Error(`Unable to extract node id in version recorder for node ${nodeName}`);
            }
            const revisionInput = {
                userId,
                userRoles,
                revisionData,
                revisionTime,
                nodeSchemaVersion,
                nodeName,
                nodeId,
                resolverOperation
            };
            const revTxFn = createRevisionTransaction(config);
            const revisionId = await revTxFn(transaction, revisionInput);
            const shouldStoreSnapshot = await findIfShouldStoreSnapshot({ tableNames, columnNames }, snapshotFrequency, transaction, nodeId, nodeName, nodeSchemaVersion);
            if (shouldStoreSnapshot) {
                let currentNodeSnapshot;
                try {
                    currentNodeSnapshot = await extractors.currentNodeSnapshot(nodeId, args);
                }
                catch (e) {
                    console.log('EERRRROR', e);
                }
                await storeCurrentNodeSnapshot({ tableNames, columnNames }, currentNodeSnapshot, revisionId, transaction);
            }
            if (edgesToRecord) {
                await Bluebird.each(edgesToRecord, async (edge) => {
                    return await storeEdge({ tableNames, columnNames }, edge, revisionInput, transaction);
                });
            }
            await transaction.commit();
            return node;
        });
        return descriptor;
    };
};
const storeEdge = async ({ tableNames, columnNames }, edgesToRecord, revisionInput, transaction) => {
    const inputFirst = {
        [columnNames.revisionEdgeTime]: revisionInput.revisionTime,
        [columnNames.resolverOperation]: revisionInput.resolverOperation,
        [columnNames.edgeNodeIdA]: revisionInput.nodeId,
        [columnNames.edgeNodeNameA]: revisionInput.nodeName,
        [columnNames.edgeNodeIdB]: edgesToRecord.nodeId,
        [columnNames.edgeNodeNameB]: edgesToRecord.nodeName
    };
    // switch A and B nodes for faster sql querying
    const inputSecond = {
        [columnNames.revisionEdgeTime]: revisionInput.revisionTime,
        [columnNames.resolverOperation]: revisionInput.resolverOperation,
        [columnNames.edgeNodeIdB]: revisionInput.nodeId,
        [columnNames.edgeNodeNameB]: revisionInput.nodeName,
        [columnNames.edgeNodeIdA]: edgesToRecord.nodeId,
        [columnNames.edgeNodeNameA]: edgesToRecord.nodeName
    };
    await transaction.table(tableNames.revisionEdge).insert(inputFirst);
    await transaction.table(tableNames.revisionEdge).insert(inputSecond);
};
/**
 * Write the node snapshot to the database
 */
const storeCurrentNodeSnapshot = async ({ tableNames, columnNames }, currentNodeSnapshot, revisionId, transaction) => {
    await transaction.table(tableNames.revisionNodeSnapshot).insert({
        [`${tableNames.revision}_${columnNames.revisionId}`]: revisionId,
        [columnNames.snapshotData]: JSON.stringify(currentNodeSnapshot) // tslint:disable-line
    });
};
/**
 * Fetch the number of full node snapshots for the node id and node schema version
 * If a snapshot exists within the expected snapshot frequency, then we don't need to take another snapshot
 */
const findIfShouldStoreSnapshot = async ({ tableNames, columnNames }, snapshotFrequency, transaction, nodeId, nodeName, mostRecentNodeSchemaVersion) => {
    const sql = transaction
        .table(tableNames.revision)
        .leftJoin(tableNames.revisionNodeSnapshot, `${tableNames.revision}.${columnNames.revisionId}`, `${tableNames.revisionNodeSnapshot}.${tableNames.revision}_${columnNames.revisionId}`)
        .where({
        [`${tableNames.revision}.${columnNames.nodeName}`]: nodeName,
        [`${tableNames.revision}.${columnNames.nodeId}`]: nodeId,
        [`${tableNames.revision}.${columnNames.nodeSchemaVersion}`]: mostRecentNodeSchemaVersion
    })
        .orderBy(`${tableNames.revision}.${columnNames.revisionTime}`, 'desc')
        .limit(snapshotFrequency)
        .select(`${tableNames.revision}.${columnNames.revisionTime} as revision_creation`, `${tableNames.revisionNodeSnapshot}.${columnNames.snapshotTime} as snapshot_creation`);
    const snapshots = (await sql);
    const snapshotWithinFrequencyRange = !!snapshots.find(data => data.snapshot_creation);
    return !snapshotWithinFrequencyRange;
};
//# sourceMappingURL=versionRecorder.js.map

var generator = (config) => {
    const { tableNames, columnNames } = setNames(config || {});
    const up = async (knex) => {
        const revision = await knex.schema.createTable(tableNames.revision, t => {
            t.increments(columnNames.revisionId)
                .unsigned()
                .primary();
            t.timestamp(columnNames.revisionTime).defaultTo(knex.fn.now());
            t.string(columnNames.userId);
            t.json(columnNames.revisionData);
            t.string(columnNames.nodeName);
            t.integer(columnNames.nodeSchemaVersion);
            t.integer(columnNames.nodeId);
            t.string(columnNames.resolverOperation);
        });
        await knex.schema.createTable(tableNames.revisionNodeSnapshot, t => {
            t.increments(columnNames.snapshotId)
                .unsigned()
                .primary();
            t.timestamp(columnNames.snapshotTime).defaultTo(knex.fn.now());
            t.integer(`${tableNames.revision}_${columnNames.revisionId}`)
                .unsigned()
                .notNullable()
                .references(columnNames.revisionId)
                .inTable(tableNames.revision);
            t.json(columnNames.snapshotData);
        });
        await knex.schema.createTable(tableNames.revisionEdge, t => {
            t.increments(columnNames.revisionEdgeId)
                .unsigned()
                .primary();
            t.timestamp(columnNames.revisionEdgeTime).defaultTo(knex.fn.now());
            t.integer(columnNames.edgeNodeIdA);
            t.string(columnNames.edgeNodeNameA);
            t.integer(columnNames.edgeNodeIdB);
            t.string(columnNames.edgeNodeNameB);
            t.string(columnNames.resolverOperation);
        });
        await knex.schema.createTable(tableNames.revisionFragment, t => {
            t.increments(columnNames.revisionFragmentId)
                .unsigned()
                .primary();
            t.timestamp(columnNames.revisionFragmentTime).defaultTo(knex.fn.now());
            t.integer(columnNames.fragmentParentNodeId);
            t.string(columnNames.fragmentParentNodeName);
            t.integer(`${tableNames.revision}_${columnNames.revisionId}`)
                .unsigned()
                .notNullable()
                .references(columnNames.revisionId)
                .inTable(tableNames.revision);
        });
        if (tableNames.revisionRole && tableNames.revisionUserRole) {
            await knex.schema.createTable(tableNames.revisionRole, t => {
                t.increments(columnNames.roleId)
                    .unsigned()
                    .primary();
                t.string(columnNames.roleName)
                    .notNullable()
                    .unique();
            });
            return await knex.schema.createTable(tableNames.revisionUserRole, t => {
                t.increments(columnNames.userRoleId)
                    .unsigned()
                    .primary();
                t.integer(`${tableNames.revision}_${columnNames.revisionId}`)
                    .unsigned()
                    .notNullable()
                    .references(columnNames.revisionId)
                    .inTable(tableNames.revision);
                t.integer(`${tableNames.revisionRole}_${columnNames.roleId}`)
                    .unsigned()
                    .notNullable()
                    .references(columnNames.roleId)
                    .inTable(tableNames.revisionRole);
            });
        }
        else {
            return revision;
        }
    };
    const down = async (knex) => {
        if (tableNames.revisionRole && tableNames.revisionUserRole) {
            await knex.schema.dropTable(tableNames.revisionUserRole);
            await knex.schema.dropTable(tableNames.revisionRole);
            await knex.schema.dropTable(tableNames.revisionEdge);
            await knex.schema.dropTable(tableNames.revisionFragment);
        }
        await knex.schema.dropTable(tableNames.revisionNodeSnapshot);
        return await knex.schema.dropTable(tableNames.revision);
    };
    return { up, down };
};
//# sourceMappingURL=generator.js.map

// tslint:disable
/**
 * **************************************************************
 * https://github.com/mobxjs/mobx/blob/master/src/utils/utils.ts
 * **************************************************************
 */
const OBFUSCATED_ERROR = 'An invariant failed, however the error is obfuscated because this is an production build.';
function invariant(check, message) {
    if (!check) {
        throw new Error('[decorate] ' + (message || OBFUSCATED_ERROR));
    }
}
function isPlainObject(value) {
    if (value === null || typeof value !== 'object') {
        return false;
    }
    const proto = Object.getPrototypeOf(value);
    return proto === Object.prototype || proto === null;
}
function decorate(thing, decorators) {
    process.env.NODE_ENV !== 'production' &&
        invariant(isPlainObject(decorators), 'Decorators should be a key value map');
    const target = (typeof thing === 'function' ? thing.prototype : thing);
    for (let prop in decorators) {
        let propertyDecorators;
        const extractedDecorators = decorators[prop];
        if (!isDecoratorArray(extractedDecorators)) {
            propertyDecorators = [extractedDecorators];
        }
        else {
            propertyDecorators = extractedDecorators;
        }
        process.env.NODE_ENV !== 'production' &&
            invariant(propertyDecorators.every(decorator => typeof decorator === 'function'), `Decorate: expected a decorator function or array of decorator functions for '${prop}'`);
        const descriptor = Object.getOwnPropertyDescriptor(target, prop);
        if (!descriptor) {
            invariant(descriptor, 'Could not find descriptor on object');
            break;
        }
        const newDescriptor = [...propertyDecorators].reduce((accDescriptor, decorator) => decorator(target, prop, accDescriptor), descriptor);
        if (newDescriptor) {
            Object.defineProperty(target, prop, newDescriptor);
        }
    }
    return thing;
}
// tslint:enable
function isDecoratorArray(decorator) {
    return decorator !== undefined && Array.isArray(decorator);
}
//# sourceMappingURL=decorate.js.map

export { generator as createRevisionMigrations, decorate, versionConnection as versionConnectionDecorator, versionRecorder as versionRecorderDecorator };
