import * as Knex from 'knex';
import Bluebird from 'bluebird';

import {INamesConfig, UnPromisify, INamesForTablesAndColumns} from '../../types';
import {setNames} from '../../sqlNames';
import nodeToSql from '../../transformers/nodeToSql';
import {
    ICreateRevisionTransactionConfig,
    IVersionRecorderExtractors,
    IRevisionInfo,
    INode
} from './types';

export default <ResolverT extends (...args: any[]) => any>(
    extractors: IVersionRecorderExtractors<ResolverT>,
    config?: ICreateRevisionTransactionConfig & INamesConfig
): MethodDecorator => {
    return (_target, property, descriptor: TypedPropertyDescriptor<any>) => {
        const nodeToSqlNameMappings = setNames(config || {});
        const {value} = descriptor;
        if (typeof value !== 'function') {
            throw new TypeError('Only functions can be decorated.');
        }

        console.log('HEREEEEE');

        // tslint:disable-next-line
        descriptor.value = (async (...args: Parameters<ResolverT>) => {
            console.log('1. EXTRACTING INFO');
            const localKnexClient = extractors.knex(args[0], args[1], args[2], args[3]);
            const transaction = await findOrCreateKnexTransaction(localKnexClient, config);
            const resolverOperation = getResolverOperation(extractors, property);
            const revisionInfo = extractRevisionInfo(args, extractors);

            console.log('2. GETTING CURRENT NODE');
            const node = await callDecoratedNode(transaction, value, args, extractors);

            console.log('3. EXTRACTING NODE ID');
            const nodeId = extractors.nodeId(node, args[0], args[1], args[2], args[3]);
            if (nodeId === undefined) {
                throw new Error(
                    `Unable to extract node id in version recorder for node ${revisionInfo.nodeName}`
                );
            }

            console.log('4. STORING REVISION');
            const revisionId = await storeRevision(
                transaction,
                nodeToSqlNameMappings,
                revisionInfo,
                nodeId,
                resolverOperation
            );

            const shouldStoreSnapshot = await findIfShouldStoreSnapshot(
                transaction,
                nodeToSqlNameMappings,
                revisionInfo,
                nodeId
            );

            if (shouldStoreSnapshot) {
                let currentNodeSnapshot;
                try {
                    currentNodeSnapshot = await extractors.currentNodeSnapshot(
                        nodeId,
                        args as Parameters<ResolverT>
                    );
                } catch (e) {
                    console.log('EERRRROR', e);
                }

                await storeCurrentNodeSnapshot(
                    transaction,
                    nodeToSqlNameMappings,
                    currentNodeSnapshot,
                    revisionId
                );
            }

            if (revisionInfo.edgesToRecord) {
                await Bluebird.each(revisionInfo.edgesToRecord, async edge => {
                    return await storeEdge(
                        transaction,
                        nodeToSqlNameMappings,
                        revisionInfo,
                        nodeId,
                        resolverOperation,
                        edge
                    );
                });
            }
            await storeFragment(transaction, nodeToSqlNameMappings, revisionInfo, revisionId);

            await transaction.commit();

            return node;
        }) as ResolverT;

        return descriptor;
    };
};

const findOrCreateKnexTransaction = async (
    knex: Knex,
    config: ICreateRevisionTransactionConfig | undefined
) => {
    const transaction = await knex.transaction();

    setTimeout(async () => {
        await transaction.rollback();
        // throw new Error('Detected an orphaned transaction');
    }, ((config && config.transactionTimeoutSeconds) || 10) * 1000);

    return transaction;
};

const storeRevision = async (
    transaction: Knex.Transaction,
    nodeToSqlNameMappings: INamesForTablesAndColumns,
    revisionInfo: IRevisionInfo,
    nodeId: INode['nodeId'],
    resolverOperation: string
) => {
    const {userRoles, ...mainTableInput} = revisionInfo;
    const sqlData = nodeToSql(nodeToSqlNameMappings, {
        ...mainTableInput,
        nodeId,
        resolverOperation
    });

    const revisionId = ((await transaction
        .table(nodeToSqlNameMappings.tableNames.revision)
        .insert(sqlData)
        .returning('id')) as number[])[0];

    const roles = userRoles || [];

    // calculate which role are missing in the db
    const foundRoleNames = await transaction
        .table(nodeToSqlNameMappings.tableNames.revisionRole)
        .whereIn(nodeToSqlNameMappings.columnNames.roleName, roles);
    const foundRoles = foundRoleNames.map(
        (n: any) => n[nodeToSqlNameMappings.columnNames.roleName]
    );
    const missingRoles = roles.filter(i => foundRoles.indexOf(i) < 0);

    // insert the missing roles
    await transaction.table(nodeToSqlNameMappings.tableNames.revisionRole).insert(
        missingRoles.map((role: string) => ({
            [nodeToSqlNameMappings.columnNames.roleName]: role
        }))
    );

    // select the role ids
    const ids = (await transaction
        .table(nodeToSqlNameMappings.tableNames.revisionRole)
        .whereIn(nodeToSqlNameMappings.columnNames.roleName, roles)) as Array<{id: number}>;

    // insert roles ids associated with the revision id
    await transaction.table(nodeToSqlNameMappings.tableNames.revisionUserRole).insert(
        ids.map(({id}) => ({
            [`${nodeToSqlNameMappings.tableNames.revisionRole}_id`]: id,
            [`${nodeToSqlNameMappings.tableNames.revision}_id`]: revisionId
        }))
    );

    return revisionId;
};

const getResolverOperation = <T extends (...args: any[]) => any>(
    extractors: IVersionRecorderExtractors<T>,
    property: string | symbol
) => {
    const rawResolverOperation = extractors.resolverOperation
        ? extractors.resolverOperation
        : property;

    return typeof rawResolverOperation === 'symbol'
        ? rawResolverOperation.toString()
        : rawResolverOperation;
};

const callDecoratedNode = async <ResolverT extends (...args: any[]) => any>(
    transaction: Knex.Transaction,
    value: (...resolverArgs: any[]) => UnPromisify<ReturnType<ResolverT>>,
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>
) => {
    const [parent, ar, ctx, info] = args;
    let newArgs = {};
    if (extractors.passThroughTransaction && extractors.passThroughTransaction === true) {
        newArgs = {...ar, transaction};
    } else {
        newArgs = {...ar};
    }
    const node = await value(parent, newArgs, ctx, info);

    return node;
};

const extractRevisionInfo = <ResolverT extends (...args: any[]) => any>(
    args: Parameters<ResolverT>,
    extractors: IVersionRecorderExtractors<ResolverT>
): IRevisionInfo => {
    // tslint:disable-next-line
    const userId = extractors.userId(args[0], args[1], args[2], args[3]);
    const revisionData = extractors.revisionData(args[0], args[1], args[2], args[3]);
    const nodeSchemaVersion = extractors.nodeSchemaVersion;
    const nodeName = extractors.nodeName;

    const userRoles = extractors.userRoles
        ? extractors.userRoles(args[0], args[1], args[2], args[3])
        : [];

    const revisionTime = extractors.revisionTime
        ? extractors.revisionTime(args[0], args[1], args[2], args[3])
        : new Date()
              .toISOString()
              .split('Z')
              .join('');

    const edgesToRecord = extractors.edges
        ? extractors.edges(args[0], args[1], args[2], args[3])
        : undefined;

    const edgesToRecordErrors = edgesToRecord
        ? edgesToRecord.filter(node => node.nodeId === undefined || node.nodeName === undefined)
        : [];

    if (edgesToRecordErrors.length > 0) {
        throw new Error(
            `Missing info found in edgesToRecord ${JSON.stringify(edgesToRecordErrors)}`
        );
    }

    const fragmentToRecord = extractors.parentNode
        ? extractors.parentNode(args[0], args[1], args[2], args[3])
        : undefined;

    const fragmentToRecordHasAnError =
        fragmentToRecord &&
        (fragmentToRecord.nodeId === undefined || fragmentToRecord.nodeName === undefined);

    if (fragmentToRecordHasAnError) {
        throw new Error(
            `Missing info found in fragmentToRecord ${JSON.stringify(fragmentToRecord)}`
        );
    }

    const snapshotFrequency = extractors.currentNodeSnapshotFrequency
        ? extractors.currentNodeSnapshotFrequency
        : 1;

    return {
        userId,
        userRoles,
        revisionData,
        revisionTime,
        nodeSchemaVersion,
        nodeName,
        edgesToRecord,
        fragmentToRecord,
        snapshotFrequency
    };
};

const storeFragment = async (
    transaction: Knex.Transaction,
    {tableNames, columnNames}: INamesForTablesAndColumns,
    revisionInfo: IRevisionInfo,
    revisionId: number
) => {
    if (revisionInfo.fragmentToRecord) {
        const fragment = {
            [columnNames.revisionEdgeTime]: revisionInfo.revisionTime,
            [columnNames.fragmentParentNodeId]: revisionInfo.fragmentToRecord.nodeId,
            [columnNames.fragmentParentNodeName]: revisionInfo.fragmentToRecord.nodeName,
            [`${tableNames.revision}_${columnNames.revisionId}`]: revisionId
        };

        await transaction.table(tableNames.revisionFragment).insert(fragment);
    }
};

const storeEdge = async (
    transaction: Knex.Transaction,
    {tableNames, columnNames}: INamesForTablesAndColumns,
    revisionInfo: IRevisionInfo,
    nodeId: string | number,
    resolverOperation: string,
    edgesToRecord: {nodeId: string | number; nodeName: string}
) => {
    const inputFirst = {
        [columnNames.revisionEdgeTime]: revisionInfo.revisionTime,
        [columnNames.resolverOperation]: resolverOperation,
        [columnNames.edgeNodeIdA]: nodeId,
        [columnNames.edgeNodeNameA]: revisionInfo.nodeName,
        [columnNames.edgeNodeIdB]: edgesToRecord.nodeId,
        [columnNames.edgeNodeNameB]: edgesToRecord.nodeName
    };

    // switch A and B nodes for faster sql querying
    const inputSecond = {
        [columnNames.revisionEdgeTime]: revisionInfo.revisionTime,
        [columnNames.resolverOperation]: resolverOperation,
        [columnNames.edgeNodeIdB]: nodeId,
        [columnNames.edgeNodeNameB]: revisionInfo.nodeName,
        [columnNames.edgeNodeIdA]: edgesToRecord.nodeId,
        [columnNames.edgeNodeNameA]: edgesToRecord.nodeName
    };

    await transaction.table(tableNames.revisionEdge).insert(inputFirst);
    await transaction.table(tableNames.revisionEdge).insert(inputSecond);
};

/**
 * Write the node snapshot to the database
 */
const storeCurrentNodeSnapshot = async (
    transaction: Knex.Transaction,
    {tableNames, columnNames}: INamesForTablesAndColumns,
    currentNodeSnapshot: any,
    revisionId: string | number
) => {
    await transaction.table(tableNames.revisionNodeSnapshot).insert({
        [`${tableNames.revision}_${columnNames.revisionId}`]: revisionId,
        [columnNames.snapshotData]: JSON.stringify(currentNodeSnapshot) // tslint:disable-line
    });
};

/**
 * Fetch the number of full node snapshots for the node id and node schema version
 * If a snapshot exists within the expected snapshot frequency, then we don't need to take another snapshot
 */
const findIfShouldStoreSnapshot = async (
    transaction: Knex.Transaction,
    {tableNames, columnNames}: INamesForTablesAndColumns,
    revisionInfo: IRevisionInfo,
    nodeId: string | number
) => {
    const sql = transaction
        .table(tableNames.revision)
        .leftJoin(
            tableNames.revisionNodeSnapshot,
            `${tableNames.revision}.${columnNames.revisionId}`,
            `${tableNames.revisionNodeSnapshot}.${tableNames.revision}_${columnNames.revisionId}`
        )
        .where({
            [`${tableNames.revision}.${columnNames.nodeName}`]: revisionInfo.nodeName,
            [`${tableNames.revision}.${columnNames.nodeId}`]: nodeId,
            [`${tableNames.revision}.${columnNames.nodeSchemaVersion}`]: revisionInfo.nodeSchemaVersion
        })
        .orderBy(`${tableNames.revision}.${columnNames.revisionTime}`, 'desc')
        .limit(revisionInfo.snapshotFrequency)
        .select(
            `${tableNames.revision}.${columnNames.revisionTime} as revision_creation`,
            `${tableNames.revisionNodeSnapshot}.${columnNames.snapshotTime} as snapshot_creation`
        );

    const snapshots = (await sql) as Array<{
        revision_creation?: string;
        snapshot_creation?: string;
    }>;
    const snapshotWithinFrequencyRange = !!snapshots.find(data => data.snapshot_creation);

    return !snapshotWithinFrequencyRange;
};
