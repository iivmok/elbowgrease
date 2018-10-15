import {Dialect, DialectType, MySQLDialect, PostgresDialect} from "./dialects";
import {Generator} from "./generator";
import {defaultOptions, Options} from "./options";


export interface ConnectionDataObject
{
    user?: string;
    database?: string;
    password?: string;
    port?: number;
    host?: string;
    connectionString?: string;
}

export type ConnectionData = string | ConnectionDataObject;

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
            console.error('No dialect specified. Quitting.');
            process.exit(1);
    }

    let dialect = new CurrentDialect(connectionString, options);

    let tables: Array<any> = await dialect.getTables();

    let generator = new generatorClass(options);
    let all = generator.generateTables(tables);
    return {
        result: all,
        tables: tables.length,
    };
}