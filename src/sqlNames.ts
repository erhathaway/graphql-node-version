import {INamesConfig} from './types';

/**
 * Sets the names for tables and columns that revisions will be stored in
 *
 * Allows users to specify their own column and table names. If none are specified, the defaults will be used.
 */

enum DEFAULT_TABLE_NAMES {
    revision = 'revision',
    revisionRole = 'revision_role',
    revisionUserRole = 'revision_user_roles',
    revisionNodeSnapshot = 'revision_node_snapshot'
}

enum DEFAULT_COLUMN_NAMES {
    id = 'id',
    userId = 'user_id',
    // userRoles = 'user_roles',
    revisionData = 'revision',
    revisionTime = 'created_at',
    nodeSchemaVersion = 'node_schema_version',
    nodeName = 'node_name',
    nodeId = 'node_id',
    roleName = 'role_name',
    resolverName = 'resolver_name',
    snapshot = 'previous_node_version_snapshot'
}

export const setNames = ({tableNames, columnNames}: INamesConfig) => ({
    tableNames: {
        ...DEFAULT_TABLE_NAMES,
        ...tableNames
    },
    columnNames: {
        ...DEFAULT_COLUMN_NAMES,
        ...columnNames
    }
});
