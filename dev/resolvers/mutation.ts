import {getTxInsertId} from '../utils';
import {Resolver, IUserNode} from '../types';
import query from './query';

import {
    decorate,
    versionRecorderDecorator as unconfiguredVersionRecorder,
    IVersionRecorderExtractors
} from '../../src';

const versionRecorder = unconfiguredVersionRecorder({
    logOptions: {level: 'debug', prettyPrint: true, base: null}
});

export interface ITeamCreationMutationInput {
    name: string;
}

export interface ITeamUpdateMutationInput {
    id: number;
    name?: string;
}

export interface ITeamDeleteMutationInput {
    id: number;
}

export interface ITeamUserCreationMutationInput {
    userId: number;
    teamId: number;
}

export interface ITeamUserDeleteMutationInput {
    userId: number;
    teamId: number;
}

export interface ITodoListCreationMutationInput {
    userId: number;
    usage: string;
}
export interface ITodoListUpdateMutationInput {
    id: number;
    usage: string;
}
export interface ITodoListDeleteMutationInput {
    id: number;
}
export interface ITodoItemCreationMutationInput {
    todoListId: number;
    note: string;
    order: number;
}

export interface ITodoItemUpdateMutationInput {
    id: number;
    note: string;
    order: number;
}

export interface ITodoItemDeleteMutationInput {
    id: number;
}

export interface IUserCreationMutationInput {
    username: string;
    firstname: string;
    lastname?: string;
    age?: number;
    haircolor?: string;
    bio?: string;
}

export interface IUserUpdateMutationInput {
    id: string;
    username?: string;
    firstname?: string;
    lastname?: string;
    age?: number;
    haircolor?: string;
    bio?: string;
}

export interface IUserDeleteMutationInput {
    id: string;
}

type MutationTeamCreate = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    ITeamCreationMutationInput
>;

type MutationTeamUpdate = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    ITeamUpdateMutationInput
>;

type MutationTeamDelete = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    ITeamDeleteMutationInput
>;

type MutationTeamUserCreate = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    ITeamUserCreationMutationInput
>;

type MutationTeamUserDelete = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    ITeamUserDeleteMutationInput
>;

type MutationTodoListCreate = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    ITodoListCreationMutationInput
>;
type MutationTodoListUpdate = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    ITodoListUpdateMutationInput
>;
type MutationTodoListDelete = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    ITodoListDeleteMutationInput
>;
type MutationTodoItemCreate = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    ITodoItemCreationMutationInput
>;
type MutationTodoItemUpdate = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    ITodoItemUpdateMutationInput
>;
type MutationTodoItemDelete = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    ITodoItemDeleteMutationInput
>;

type MutationUserCreateResolver = Resolver<
    Promise<IUserNode>,
    undefined,
    IUserCreationMutationInput
>;
type MutationUserUpdateResolver = Resolver<Promise<IUserNode>, undefined, IUserUpdateMutationInput>;

type MutationUserDeleteResolver = Resolver<
    Promise<{id: number | undefined}>,
    undefined,
    IUserDeleteMutationInput
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
    teamCreate: async (_, {name}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
        try {
            await tx.table('team').insert({name});
            const teamId = await getTxInsertId(sqlClient, tx);
            await tx.commit();
            return {id: teamId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    teamUpdate: async (_, {id, ...updates}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
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
    teamDelete: async (_, {id}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
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
    teamUserCreate: async (_, {userId, teamId}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
        try {
            await tx.table('team_user').insert({user_id: userId, team_id: teamId});
            const teamUserId = await getTxInsertId(sqlClient, tx);
            await tx.commit();
            return {id: teamUserId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    teamUserDelete: async (_, {userId, teamId}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
        try {
            await tx
                .table('team_user')
                .where({user_id: userId, team_id: teamId})
                .del();
            const teamUserId = await getTxInsertId(sqlClient, tx);
            await tx.commit();
            return {id: teamUserId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    todoListCreate: async (_, {usage, userId}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
        try {
            await tx.table('todo_list').insert({usage});
            const todoListId = await getTxInsertId(sqlClient, tx);
            await tx.table('user_todo_list').insert({user_id: userId, todo_list_id: todoListId});
            await tx.commit();
            return {id: todoListId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    todoListUpdate: async (_, {id, ...updates}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
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
    todoListDelete: async (_, {id}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
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
    todoItemCreate: async (_, {todoListId, order, note}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
        try {
            await tx.table('todo_item').insert({order, note, todo_list_id: todoListId});
            const todoItemId = await getTxInsertId(sqlClient, tx);
            await tx.commit();
            return {id: todoItemId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    },
    todoItemUpdate: async (_, {id, ...updates}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
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
    todoItemDelete: async (_, {id}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
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
    userCreate: async (_, {...input}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
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
    userUpdate: async (_, {id, ...input}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
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
    userDelete: async (_, {id}, {sqlClient}) => {
        const tx = await sqlClient.transaction();
        try {
            await tx
                .table('user')
                .where({id})
                .del();
            const userId = await getTxInsertId(sqlClient, tx);
            await tx.commit();
            return {id: userId};
        } catch (e) {
            await tx.rollback();
            throw e;
        }
    }
};

const commonDecoratorConfig = <T extends Resolver<any, any, any>>() =>
    ({
        knex: (_, __, {sqlClient}) => sqlClient,
        userId: () => '1',
        userRoles: () => ['ethan', 'human'],
        revisionData: (_, args) => args,
        currentNodeSnapshotFrequency: 5
    } as Pick<
        IVersionRecorderExtractors<T>,
        'knex' | 'userId' | 'userRoles' | 'revisionData' | 'currentNodeSnapshotFrequency'
    >);

decorate(mutation, {
    teamCreate: versionRecorder<MutationTeamCreate>({
        ...commonDecoratorConfig<MutationTeamCreate>(),
        nodeName: 'team',
        resolverOperation: 'create',
        nodeId: ({id}) => id,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.team(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        }
    }),
    teamUpdate: versionRecorder<MutationTeamUpdate>({
        ...commonDecoratorConfig<MutationTeamUpdate>(),
        nodeName: 'team',
        resolverOperation: 'update',
        nodeId: (_, __, {id}) => id,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.team(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        }
    }),
    teamDelete: versionRecorder<MutationTeamCreate>({
        ...commonDecoratorConfig<MutationTeamCreate>(),
        nodeName: 'team',
        resolverOperation: 'delete',
        nodeId: ({id}) => id,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.team(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        }
    }),
    userCreate: versionRecorder<MutationUserCreateResolver>({
        ...commonDecoratorConfig<MutationUserCreateResolver>(),
        nodeName: 'user',
        resolverOperation: 'create',
        nodeId: ({id}) => id,
        nodeSchemaVersion: 1,
        // TODO remind users in readme that the resolver type changes and
        // they need to cast it to IRevisionConnection<Node>
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.user(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        }
    }),
    userUpdate: versionRecorder<MutationUserUpdateResolver>({
        ...commonDecoratorConfig<MutationUserUpdateResolver>(),
        nodeName: 'user',
        resolverOperation: 'update',
        nodeId: (_, __, {id}) => id,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.user(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        }
    }),
    userDelete: versionRecorder<MutationUserDeleteResolver>({
        ...commonDecoratorConfig<MutationUserDeleteResolver>(),
        nodeName: 'user',
        resolverOperation: 'delete',
        nodeId: (_, __, {id}) => id,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.user(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        }
    }),
    teamUserCreate: versionRecorder<MutationTeamUserCreate>({
        ...commonDecoratorConfig<MutationTeamUserCreate>(),
        nodeName: 'user',
        resolverOperation: 'edgeCreate',
        nodeId: (_, __, {userId}) => userId,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.user(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        },
        edges: (_node, _parent, {teamId}) => [{nodeId: teamId, nodeName: 'team'}]
    }),
    teamUserDelete: versionRecorder<MutationTeamUserDelete>({
        ...commonDecoratorConfig<MutationTeamUserDelete>(),
        nodeName: 'user',
        resolverOperation: 'edgeDelete',
        nodeId: (_, __, {userId}) => userId,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.user(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        },
        edges: (_node, _parent, {teamId}) => [{nodeId: teamId, nodeName: 'team'}]
    }),
    todoListCreate: versionRecorder<MutationTodoListCreate>({
        ...commonDecoratorConfig<MutationTodoListCreate>(),
        nodeName: 'todoList',
        resolverOperation: 'create',
        nodeId: ({id}) => id,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.todoList(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        },
        edges: (_node, _parent, {userId}) => [{nodeId: userId, nodeName: 'user'}]
    }),
    todoListUpdate: versionRecorder<MutationTodoListUpdate>({
        ...commonDecoratorConfig<MutationTodoListUpdate>(),
        nodeName: 'todoList',
        resolverOperation: 'update',
        nodeId: (_, __, {id}) => id,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.todoList(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        }
    }),
    todoListDelete: versionRecorder<MutationTodoListDelete>({
        ...commonDecoratorConfig<MutationTodoListDelete>(),
        nodeName: 'todoList',
        resolverOperation: 'delete',
        nodeId: (_, __, {id}) => id,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.todoList(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        }
    }),
    todoItemCreate: versionRecorder<MutationTodoItemCreate>({
        ...commonDecoratorConfig<MutationTodoItemCreate>(),
        nodeName: 'todoItem',
        resolverOperation: 'create',
        nodeId: ({id}) => id,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.todoItem(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        },
        parentNode: (_, __, {todoListId}) => ({nodeName: 'todoList', nodeId: todoListId})
    }),
    todoItemUpdate: versionRecorder<MutationTodoItemUpdate>({
        ...commonDecoratorConfig<MutationTodoItemUpdate>(),
        nodeName: 'todoItem',
        resolverOperation: 'update',
        nodeId: (_, __, {id}) => id,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.todoItem(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        }
    }),
    todoItemDelete: versionRecorder<MutationTodoItemDelete>({
        ...commonDecoratorConfig<MutationTodoItemDelete>(),
        nodeName: 'todoItem',
        resolverOperation: 'delete',
        nodeId: (_, __, {id}) => id,
        nodeSchemaVersion: 1,
        currentNodeSnapshot: async (nodeId, args) => {
            const connectionResult = await query.todoItem(
                undefined,
                {id: nodeId as string},
                args[2],
                args[3]
            );
            return connectionResult.edges[0].node;
        }
    })
});

export default mutation;
