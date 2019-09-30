import {getTxInsertId} from '../utils';
import {Resolver, IUserNode} from '../types';
import knex from 'knex';
import {development as developmentConfig} from '../../knexfile.mysql';
const knexClient = knex(developmentConfig);

import query from './query';

import {
    decorate,
    versionRecorderDecorator as versionRecorder,
    IRevisionConnection
} from '../../src/index';

interface ITeamCreationMutationInput {
    name: string;
}

interface ITeamUpdateMutationInput {
    id: number;
    name?: string;
}

interface ITeamDeleteMutationInput {
    id: number;
}

interface ITeamUserCreationMutationInput {
    userId: number;
    teamId: number;
}

interface ITeamUserDeleteMutationInput {
    userId: number;
    teamId: number;
}

interface ITodoListCreationMutationInput {
    userId: number;
    usage: string;
}
interface ITodoListUpdateMutationInput {
    id: number;
    usage: string;
}
interface ITodoListDeleteMutationInput {
    id: number;
}
interface ITodoItemCreationMutationInput {
    todoListId: number;
    note: string;
    order: number;
}

interface ITodoItemUpdateMutationInput {
    id: number;
    note: string;
    order: number;
}

interface ITodoItemDeleteMutationInput {
    id: number;
}

interface IUserCreationMutationInput {
    username: string;
    firstname: string;
    lastname?: string;
    age?: number;
    haircolor?: string;
    bio?: string;
}

interface IUserUpdateMutationInput {
    id: string;
    username?: string;
    firstname?: string;
    lastname?: string;
    age?: number;
    haircolor?: string;
    bio?: string;
}

interface IUserDeleteMutationInput {
    id: string;
}

type MutationTeamCreate = Resolver<
    {id: number | undefined},
    undefined,
    ITeamCreationMutationInput & {transaction?: knex.Transaction<any, any>}
>;

type MutationTeamUpdate = Resolver<
    {id: number | undefined},
    undefined,
    ITeamUpdateMutationInput & {transaction?: knex.Transaction<any, any>}
>;

type MutationTeamDelete = Resolver<
    {id: number | undefined},
    undefined,
    ITeamDeleteMutationInput & {transaction?: knex.Transaction<any, any>}
>;

type MutationTeamUserCreate = Resolver<
    {id: number | undefined},
    undefined,
    ITeamUserCreationMutationInput & {transaction?: knex.Transaction<any, any>}
>;

type MutationTeamUserDelete = Resolver<
    {id: number | undefined},
    undefined,
    ITeamUserDeleteMutationInput & {transaction?: knex.Transaction<any, any>}
>;

type MutationTodoListCreate = Resolver<
    {id: number | undefined},
    undefined,
    ITodoListCreationMutationInput & {transaction?: knex.Transaction<any, any>}
>;
type MutationTodoListUpdate = Resolver<
    {id: number | undefined},
    undefined,
    ITodoListUpdateMutationInput & {transaction?: knex.Transaction<any, any>}
>;
type MutationTodoListDelete = Resolver<
    {id: number | undefined},
    undefined,
    ITodoListDeleteMutationInput & {transaction?: knex.Transaction<any, any>}
>;
type MutationTodoItemCreate = Resolver<
    {id: number | undefined},
    undefined,
    ITodoItemCreationMutationInput & {transaction?: knex.Transaction<any, any>}
>;
type MutationTodoItemUpdate = Resolver<
    {id: number | undefined},
    undefined,
    ITodoItemUpdateMutationInput & {transaction?: knex.Transaction<any, any>}
>;
type MutationTodoItemDelete = Resolver<
    {id: number | undefined},
    undefined,
    ITodoItemDeleteMutationInput & {transaction?: knex.Transaction<any, any>}
>;

type MutationUserCreateResolver = Resolver<
    IUserNode,
    undefined,
    IUserCreationMutationInput & {transaction?: knex.Transaction<any, any>}
>;
type MutationUserUpdateResolver = Resolver<
    IUserNode,
    undefined,
    IUserUpdateMutationInput & {transaction?: knex.Transaction<any, any>}
>;

type MutationUserDeleteResolver = Resolver<
    {id: number | undefined},
    undefined,
    IUserDeleteMutationInput & {transaction?: knex.Transaction<any, any>}
>;

const mutation: {
    teamCreate: MutationTeamCreate;
    teamUpdate: MutationTeamUpdate;
    teamDelete: MutationTeamDelete;
    teamUserCreate: MutationTeamUserCreate;
    teamUserDelete: MutationTeamUserDelete;
    todoListCreate: MutationTodoListCreate;
    todoListUpdate: MutationTodoListUpdate;
    todoListDelete: MutationTodoListDelete;
    todoItemCreate: MutationTodoItemCreate;
    todoItemUpdate: MutationTodoItemUpdate;
    todoItemDelete: MutationTodoItemDelete;
    userCreate: MutationUserCreateResolver;
    userUpdate: MutationUserUpdateResolver;
    userDelete: MutationUserDeleteResolver;
} = {
    teamCreate: async (_, {transaction, name}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx.table('team').insert({name});
            const teamId = await getTxInsertId(knexClient, tx);
            await tx.commit();
            return {id: teamId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    teamUpdate: async (_, {transaction, id, ...updates}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            if (updates.name) {
                await tx
                    .table('team')
                    .update({name: updates.name})
                    .where({id});
            }
            await tx.commit();
            return {id};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    teamDelete: async (_, {transaction, id}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx
                .table('team')
                .where({id})
                .del();

            await tx.commit();
            return {id};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    teamUserCreate: async (_, {transaction, userId, teamId}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx.table('team_user').insert({user_id: userId, team_id: teamId});
            const teamUserId = await getTxInsertId(knexClient, tx);
            await tx.commit();
            return {id: teamUserId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    teamUserDelete: async (_, {transaction, userId, teamId}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx
                .table('team_user')
                .where({user_id: userId, team_id: teamId})
                .del();
            const teamUserId = await getTxInsertId(knexClient, tx);
            await tx.commit();
            return {id: teamUserId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    todoListCreate: async (_, {transaction, usage, userId}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx.table('todo_list').insert({usage});
            const todoListId = await getTxInsertId(knexClient, tx);
            await tx.table('user_todo_list').insert({user_id: userId, todo_list_id: todoListId});
            await tx.commit();
            return {id: todoListId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    todoListUpdate: async (_, {transaction, id, ...updates}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            if (updates.usage) {
                await tx.table('todo_list').update({usage: updates.usage});
            }
            await tx.commit();
            return {id};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    todoListDelete: async (_, {transaction, id}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx
                .table('todo_list')
                .where({id})
                .del();
            await tx.commit();
            return {id};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    todoItemCreate: async (_, {transaction, todoListId, order, note}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx.table('todo_item').insert({order, note, todo_list_id: todoListId});
            const todoItemId = await getTxInsertId(knexClient, tx);
            await tx.commit();
            return {id: todoItemId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    todoItemUpdate: async (_, {transaction, id, ...updates}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            if (updates.note || updates.order) {
                await tx
                    .table('todo_item')
                    .update(updates)
                    .where({id});
            }
            await tx.commit();
            return {id};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    todoItemDelete: async (_, {transaction, id}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx
                .table('todo_item')
                .where({id})
                .del();

            await tx.commit();
            return {id};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    userCreate: async (_, {transaction, ...input}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx.table('user').insert(input);
            const user = await tx
                .table('user')
                .orderBy('id', 'desc')
                .first();
            await tx.commit();
            return user as IUserNode;
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    userUpdate: async (_, {id, transaction, ...input}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx
                .table('user')
                .update(input)
                .where({id});
            const user = await tx
                .table('user')
                .where({id})
                .first();
            await tx.commit();
            return user as IUserNode;
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    userDelete: async (_, {transaction, id}) => {
        const tx = transaction || (await knexClient.transaction());
        try {
            await tx
                .table('user')
                .where({id})
                .del();
            const userId = await getTxInsertId(knexClient, tx);
            await tx.commit();
            return {id: userId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    }
};

decorate(mutation, {
    // TODO add ability to differentiate between additions and deletions in revision data
    userCreate: versionRecorder<MutationUserCreateResolver>({
        knex: () => knexClient,
        userId: () => '1',
        userRoles: () => ['operations', 'user', 'billing'],
        nodeIdCreate: ({id}) => id,
        nodeSchemaVersion: () => 1,
        revisionData: (_parent, args) => JSON.stringify(args),
        resolverName: () => 'create',
        nodeName: () => 'user',
        currentNodeSnapshot: async (nodeId, args) => {
            // TODO remind users in readme that the resolver type changes and
            // they need to cast it to IRevisionConnection<Node>
            const r = ((await query.user(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            )) as unknown) as IRevisionConnection<typeof query.user>;
            // todo undo when connection is returning right type
            return r;
            // return r.edges[0] ? r.edges[0].node : undefined;
        }
    }),
    userUpdate: versionRecorder<MutationUserUpdateResolver>({
        knex: () => knexClient,
        userId: () => '1',
        userRoles: () => ['operations', 'user', 'tester'],
        nodeIdUpdate: (_, {id}) => id,
        nodeSchemaVersion: () => 1,
        revisionData: (_parent, args) => JSON.stringify(args),
        resolverName: () => 'update',
        nodeName: () => 'user',
        currentNodeSnapshot: async (nodeId, args) => {
            // TODO remind users in readme that the resolver type changes and
            // they need to cast it to IRevisionConnection<Node>
            const r = ((await query.user(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            )) as unknown) as IRevisionConnection<typeof query.user>;
            // todo undo when connection is returning right type
            return r;
            // return r.edges[0] ? r.edges[0].node : undefined;
        },
        currentNodeSnapshotFrequency: 5
    })
});

export default mutation;
