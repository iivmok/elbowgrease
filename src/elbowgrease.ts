import {Dialect, DialectType, MySQLDialect, PostgresDialect} from "./dialects";
import {Generator} from "./generator";
import {defaultOptions, Options} from "./options";


interface ConnectionDataObject
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
            throw new Error('No dialect specified');
    }

    let dialect = new CurrentDialect(connectionString, options);

    let tables: any = await dialect.getTables();

    let generator = new generatorClass(options);
    let all = generator.generateTables(tables);
    return all;
}