import {parse as urlParse} from 'url';

export enum DialectType
{
    PostgreSQL = 'postgres',
    MySQL = 'mysql'
}
enum ForceCase
{
    None = 'none',
    Camel = 'camel',
    Snake = 'snake',
    Pascal = 'pascal',
}

export interface Options
{
    excludeTables?: Array<string>
    schema?: string
    extends?: string | object
    dialect?: DialectType
    exportKeyword?: string
    attribute?: string
    indent?: string
    forceMemberCase?: ForceCase
    forceTypeCase?: ForceCase
    prepend?: string
    append?: string
    lineFeed?: string
    header?: boolean
    connectionData?: ConnectionData
    additional_info: any
}

let defaultOptions =
    {
        excludeTables: [],
        schema: 'public',
        extends: '',
        dialect: DialectType.PostgreSQL,
        exportKeyword: 'class',
        attribute: '',
        indent: '    ',
        forceMemberCase: ForceCase.None,
        forceTypeCase: ForceCase.None,
        prepend: '',
        append: '',
        lineFeed: '\n',
        header: true,
        additional_info: {},
    } as Options;

export interface Column
{
    name: string
    type: string
    nullable: boolean
}

export interface Table
{
    name: string
    columns: Array<Column>
}

export interface ConnectionDataObject
{
    user?: string;
    database?: string;
    password?: string;
    port?: number;
    host?: string;
    connectionString?: string;
}

type ConnectionData = string | ConnectionDataObject;

type DBColumn = { column_name, data_type, is_nullable };

type ITransformColumn = ((column: DBColumn) => Column);

type QueryResult = { rows: Array<any>, error: any };

interface IClient
{
    query: ((string) => Promise<QueryResult>)
    options: Options
}

class Dialect
{
    connectionData: ConnectionData;
    options: Options;

    constructor(connectionData, options)
    {
        this.connectionData = connectionData;
        this.options = options;
    }

    protected client: IClient;
    protected real_client: any;

    //abstract transformColumn(column: DBColumn): Column;

    getClient(): Promise<IClient>
    {
        return null;
    }

    getMapping(): { [type: string]: Array<string>; }
    {
        return null
    }

    mapColumn(column_type: string): string
    {
        let type = 'any';
        let mapping = this.getMapping();
        for (let t in mapping)
        {
            if ((mapping[t] as Array<string>).indexOf(column_type) !== -1)
            {
                type = t;
                break;
            }
        }
        return type;
    }

    transformColumn(column: DBColumn): Column
    {
        let name = column.column_name;
        name = Generator.camelCase(name);
        return {
            name: name,
            type: this.mapColumn(column.data_type),
            nullable: column.is_nullable === 'YES',
        }
    }
    async getTableNames()
    {
        let client = await this.getClient();
        return (await client.query(`
            select distinct table_name 
            from information_schema.columns 
            where table_schema = '${this.options.schema}'
        `)).rows.map(row => row.table_name);
    };
}

export class PostgresDialect extends Dialect
{
    async getClient()
    {
        if (this.client) return this.client;
        let pg = await import('pg');
        let client = this.real_client = new pg.Client(this.connectionData);

        await client.connect();
        this.options.additional_info.ip = (client as any).connection.stream.remoteAddress;
        return this.client = {
            async query(statement)
            {
                let res = (await client.query(statement));
                return {
                    rows: res.rows,
                    error: res.errno
                };
            }
        } as IClient;
    }

    getMapping()
    {
        return {
            number: ['int2', 'int4', 'int8', 'float4', 'float8', 'numeric', 'money', 'oid'],
            string: ['bpchar', 'char', 'varchar', 'text', 'citext', 'uuid', 'bytea', 'inet', 'time', 'timetz', 'interval', 'name'],
            boolean: ['bool'],
            Object: ['json', 'jsonb'],
            Date: ['date', 'timestamp', 'timestampz'],

        };
    }


}

export class MySQLDialect extends Dialect
{
    async getClient()
    {
        if (this.client) return this.client;
        let mysql = await import('mysql');
        let client = mysql.createConnection(this.connectionData);

        await new Promise<void>( resolve => { client.connect(resolve) });

        this.options.additional_info.ip = (client as any)._socket.remoteAddress;
        let query = function promise_query(q) {
            return new Promise((resolve) => {
                client.query(q, ((err, results) => {
                    resolve({
                        rows: results,
                        error: err
                    })
                }))
            })
        };
        if (typeof this.connectionData === 'string')
        {
            this.options.schema = urlParse(this.connectionData).pathname.substr(1)
        }

        return this.client = {
            query: query
        } as IClient;
    }

    getMapping()
    {
        return {
            number: ['integer', 'int', 'smallint', 'mediumint', 'bigint', 'double', 'decimal', 'numeric', 'float', 'year'],
            string: ['char', 'varchar', 'text', 'tinytext', 'mediumtext', 'longtext', 'time', 'geometry', 'set', 'enum'],
            boolean: ['tinyint'],
            Object: ['json'],
            Date: ['date', 'datetime', 'timestamp'],
            Buffer: ['tinyblob', 'mediumblob', 'longblob', 'blob', 'binary', 'varbinary', 'bit'],

        };
    }

}

class Generator
{
    protected static indent = '    ';
    options: Options;
    constructor(options: Options)
    {
        this.options = options;
    }
    static camelCase(text: string)
    {
        return text.split(/[^a-z]/i).filter(x => x).map( (v, i) => {
            return i ? v.charAt(0).toUpperCase() + v.substr(1) : v;
        }).join('');
    }
    protected getHost()
    {
        if(this.options.connectionData)
        {
            if(typeof this.options.connectionData === 'string')
            {
                return urlParse(this.options.connectionData).host
            }
            else
            {
                return this.options.connectionData.host;
            }
        }
        return '';
    }
    generateType(column: Column)
    {
        return column.type + (column.nullable ? ' | null' : '');
    }
    generateClass(table: Table)
    {
        let o = this.options;
        let lf = o.lineFeed;
        let output = '';
        let inheritance = o.extends ? ` extends ${o.extends}` : '';
        let attribute = o.attribute ? o.indent + o.attribute + lf : '';
        output += `export ${this.options.exportKeyword} ${table.name}${inheritance}${lf}{${lf}`;
        table.columns.map(column => {
            output += attribute;
            output += `${o.indent}${column.name}: ${this.generateType(column)};${lf}`;
        });
        output += '}';
        return output;
    }
    generateTables(tables: Table[])
    {
        let o = this.options;
        let lf = o.lineFeed;
        let lflf = lf + lf;
        let output = '';
        if(o.header)
        {
            let cleanOptions = Object.assign({}, o);
            delete cleanOptions['connectionData'];
            let header = [
                `Generated on ${(new Date()).toISOString()}`,
                'Host: ' + this.getHost(),
                //'Tables: ' + tables.map(t => t.name).join(', '),
                'Options used:'
            ].concat(JSON.stringify(cleanOptions, null, o.indent).replace('*/', '*//*').split('\n'));

            output += '/**\n * ' + header.join(lf + ' * ') + lf + ' * ' + lf + ' */' + lflf;
        }
        if(o.prepend)
        {
            output += o.prepend + lflf;
        }

        output += tables.map(table => this.generateClass(table)).join(lflf);

        if(o.append)
        {
            output += lflf + o.append;
        }
        return output;
    }
}

export async function grease(connectionString: string | ConnectionData, options: Options = null, generatorClass: typeof Generator = Generator)
{
    options = Object.assign(defaultOptions, options || {});

    let CurrentDialect: typeof Dialect;

    switch (options.dialect)
    {
        case DialectType.PostgreSQL:
            CurrentDialect = PostgresDialect;
            break;
        case DialectType.MySQL:
            CurrentDialect = MySQLDialect;
            break;
        default:
            throw new Error('No dialect specified');
    }

    let dialect = new CurrentDialect(connectionString, options);
    let client = await dialect.getClient();

    async function columns(table: string)
    {
        if (options.dialect == DialectType.MySQL)
        {
            return (await client.query(`
                select column_name, data_type, is_nullable
                from information_schema.columns
                where table_schema = '${options.schema}' and table_name = '${table}'
            `));
        }
        else
        {
            return (await client.query(`
                select column_name, udt_name as data_type, is_nullable
                from information_schema.columns
                where table_schema = '${options.schema}' and table_name = '${table}'
            `));
        }
    }

    let table_names = await dialect.getTableNames();

    let table_promises = [];

    let tables: any = [];

    for (let i in table_names)
    {
        let promise = columns(table_names[i]);
        table_promises.push(promise);
        promise.then(result => {
            tables.push({
                name: table_names[i],
                raw_columns: (result.rows as Array<DBColumn>),
                columns: (result.rows as Array<DBColumn>).map(col => dialect.transformColumn(col))
            })
        });
    }
    await Promise.all(table_promises);

    let generator = new generatorClass(options);
    let all = generator.generateTables(tables);
    return all;
}