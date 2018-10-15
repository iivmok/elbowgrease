import {parse as urlParse} from "url";
import {ConnectionData} from "./elbowgrease";
import {ForceCase, Generator} from "./generator";
import {Options} from "./options";

export type DBColumn = { column_name, data_type, is_nullable };

type QueryResult = { rows: Array<any>, error: any };

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

export enum DialectType
{
    PostgreSQL = 'postgres',
    MySQL = 'mysql'
}

interface IClient
{
    query: ((string) => Promise<QueryResult>)
    options: Options
}

export class Dialect
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
        let opt = this.options;
        let name = column.column_name;
        if(opt.memberCase && opt.memberCase !== ForceCase.None)
        {
            name = Generator[opt.memberCase + 'Case'](name);
        }
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

    async getColumns(table)
    {
        let client = await this.getClient();
        return (await client.query(`
            select column_name, data_type, is_nullable
            from information_schema.columns
            where table_schema = '${this.options.schema}' and table_name = '${table}'
        `));
    }

    async getTables()
    {
        let opt = this.options;
        let table_names = await this.getTableNames();

        let table_promises = [];

        let tables: any = [];

        for (let i in table_names)
        {
            let promise = this.getColumns(table_names[i]);
            table_promises.push(promise);
            promise.then(result => {
                let name = table_names[i];
                if(opt.typeCase && opt.typeCase !== ForceCase.None)
                {
                    name = Generator[opt.typeCase + 'Case'](name);
                }

                tables.push({
                    name: name,
                    raw_columns: result.rows,
                    columns: result.rows.map(col => this.transformColumn(col))
                })
            });
        }
        await Promise.all(table_promises);
        return tables;
    }
}

export class PostgresDialect extends Dialect
{
    async getClient()
    {
        if (this.client) return this.client;
        // @ts-ignore
        let pg = await import('pg');
        let client = this.real_client = new pg.Client(this.connectionData);

        try
        {
            await client.connect();
        }
        catch (e)
        {
            console.error('Could not connect: ' + e.message);
            process.exit(1);
        }
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


    async getColumns(table)
    {
        let client = await this.getClient();
        return (await client.query(`
            select column_name, udt_name as data_type, is_nullable
            from information_schema.columns
            where table_schema = '${this.options.schema}' and table_name = '${table}'
        `));
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
        // @ts-ignore
        let mysql = await import('mysql');
        let client = mysql.createConnection(this.connectionData);

        await new Promise<void>(resolve => {
            client.connect((err /*: MysqlError*/, ...args: any[]) => {
                if(err)
                {
                    console.log(`Could not connect: [${err.sqlState}] ${err.sqlMessage}`);
                    process.exit(1);
                }
                resolve();
            })
        });

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