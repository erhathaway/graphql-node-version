import {ConnectionManager, IInputArgs, IQueryResult} from '@social-native/snpkg-snapi-connections';
import {Resolver, IUserNode, ITodoItem, ITodoList} from '../types';

import {
    IVersionConnection,
    versionConnection as unconfiguredCreateRevisionConnection,
    IAllNodeBuilderVersionInfo,
    ILoggerConfig,
    INodeBuilderFragmentNodes,
    typeGuards,
    nodeBuilder as versionNodeBuilder
} from '../../src';

const createRevisionConnection = unconfiguredCreateRevisionConnection({
    logOptions: {level: 'debug', prettyPrint: true, base: null}
});

interface ITeam {
    id: number;
    name: string;
}

type QueryTeamResolver = Resolver<
    IVersionConnection<ITeam | null>,
    undefined,
    {id: string} & IInputArgs
>;
type QueryTodoListResolver = Resolver<
    IVersionConnection<ITodoList | undefined>,
    undefined,
    {id: string} & IInputArgs
>;
type QueryTodoItemResolver = Resolver<
    IVersionConnection<ITodoItem | undefined>,
    undefined,
    {id: string} & IInputArgs
>;
type QueryUsersResolver = Resolver<IQueryResult<IUserNode | null>, undefined, IInputArgs>;
type QueryUserResolver = Resolver<
    IVersionConnection<IUserNode | null>,
    undefined,
    {id: string} & IInputArgs
>;

type KnexQueryResult = Array<{[attributeName: string]: any}>;

const query: {
    team: QueryTeamResolver;
    todoList: QueryTodoListResolver;
    todoItem: QueryTodoItemResolver;
    user: QueryUserResolver;
    users: QueryUsersResolver;
} = {
    async team(parent, args, ctx, info) {
        const currentNode = (await ctx.sqlClient
            .from('team')
            .where({id: args.id})
            .first()) as {id: number; name: string};

        return await createRevisionConnection(currentNode, [parent, args, ctx, info], {
            knex: ctx.sqlClient,
            nodeBuilder,
            nodeId: args.id,
            nodeName: 'team'
        });
    },
    async todoList(parent, args, ctx, info) {
        const currentNode = await ctx.sqlClient
            .from('todo_list')
            .where({'todo_list.id': args.id})
            .first();

        return await createRevisionConnection(currentNode, [parent, args, ctx, info], {
            knex: ctx.sqlClient,
            nodeBuilder,
            nodeId: args.id,
            nodeName: 'todoList'
        });
    },
    async todoItem(parent, args, ctx, info) {
        const currentNode = await ctx.sqlClient
            .from('todo_item')
            .where({id: args.id})
            .first();

        return await createRevisionConnection(currentNode, [parent, args, ctx, info], {
            knex: ctx.sqlClient,
            nodeBuilder,
            nodeId: args.id,
            nodeName: 'todoItem'
        });
    },
    async user(parent, args, ctx, info) {
        const currentNode = await ctx.sqlClient
            .table('user')
            .where({id: args.id})
            .first();

        return await createRevisionConnection(currentNode, [parent, args, ctx, info], {
            knex: ctx.sqlClient,
            nodeBuilder,
            nodeId: args.id,
            nodeName: 'user'
        });
    },
    async users(_, inputArgs, {sqlClient}) {
        const queryBuilder = sqlClient.from('user');
        // maps node types to sql column names
        const attributeMap = {
            id: 'id',
            username: 'username',
            firstname: 'firstname',
            age: 'age',
            haircolor: 'haircolor',
            lastname: 'lastname',
            bio: 'bio'
        };

        const nodeConnection = new ConnectionManager<IUserNode>(inputArgs, attributeMap);

        const queryResult = nodeConnection.createQuery(queryBuilder.clone()).select();
        const result = (await queryResult) as KnexQueryResult;

        nodeConnection.addResult(result);

        return {
            pageInfo: nodeConnection.pageInfo,
            edges: nodeConnection.edges
        };
    }
};

const nodeBuilder = <Node extends any, FragmentNode extends object>(
    previousNode: Node,
    versionInfo: IAllNodeBuilderVersionInfo,
    fragmentNodes?: INodeBuilderFragmentNodes<FragmentNode>,
    _logger?: ILoggerConfig['logger']
): Node => {
    if (typeGuards.isNodeBuilderNodeChangeVersionInfo(versionInfo)) {
        return versionNodeBuilder.computeNodeFromNodeChange(previousNode, versionInfo);
    } else if (
        typeGuards.isNodeBuilderNodeFragmentChangeVersionInfo(versionInfo) &&
        fragmentNodes
    ) {
        const computeNode = (pNode: Node, fragments: FragmentNode[]) => ({
            ...pNode,
            items: fragments || []
        });
        return versionNodeBuilder.computeNodeFromNodeChangeFragment<Node, FragmentNode>(
            previousNode,
            fragmentNodes,
            computeNode
        );
    } else {
        throw new Error('Unknown versionInfo type. Could not build node');
    }
};

export default query;