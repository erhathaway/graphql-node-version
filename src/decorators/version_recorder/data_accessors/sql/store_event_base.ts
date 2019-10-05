import Knex from 'knex';
import {
    ITableAndColumnNames,
    IEventInterfaceTypesToIdsMap,
    ISqlEventTable,
    EventInfo,
    ISqlEventImplementorTypeTable
} from 'types';
import {
    isEventNodeChangeInfo,
    isEventNodeFragmentChangeInfo,
    isEventLinkChangeInfo
} from 'type_guards';
import {EVENT_IMPLEMENTOR_TYPES} from 'enums';
import {getTxInsertId} from './utils';

/**
 * Write the event to the base event table in the database
 */
export default async (
    knex: Knex,
    transaction: Knex.Transaction,
    {table_names}: ITableAndColumnNames,
    eventImplementorTypesToIdsMap: IEventInterfaceTypesToIdsMap,
    eventInfo: EventInfo
) => {
    let implementorTypeId;
    if (isEventNodeChangeInfo(eventInfo)) {
        implementorTypeId = eventImplementorTypesToIdsMap[EVENT_IMPLEMENTOR_TYPES.NODE_CHANGE];
    } else if (isEventNodeFragmentChangeInfo(eventInfo)) {
        implementorTypeId =
            eventImplementorTypesToIdsMap[EVENT_IMPLEMENTOR_TYPES.NODE_FRAGMENT_CHANGE];
    } else if (isEventLinkChangeInfo(eventInfo)) {
        implementorTypeId = eventImplementorTypesToIdsMap[EVENT_IMPLEMENTOR_TYPES.LINK_CHANGE];
    }

    // Get the id for event implementor EVENT_NODE_CHANGE
    await transaction
        .table<ISqlEventTable>(table_names.event)
        .insert<ISqlEventImplementorTypeTable>({
            created_at: eventInfo.createdAt,
            user_id: eventInfo.userId,
            node_name: eventInfo.nodeName,
            node_id: eventInfo.nodeId as string,
            resolver_operation: eventInfo.resolverOperation,
            implementor_type_id: implementorTypeId
        });

    return await getTxInsertId(knex, transaction);
};
