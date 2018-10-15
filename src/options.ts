import {DialectType} from "./dialects";
import {ForceCase} from "./generator";
import {ConnectionData} from "./elbowgrease";

type Option = string | Function | object

export interface Options
{
    excludeTables?: Array<string>
    schema?: string
    extends?: Option
    dialect?: DialectType
    exportKeyword?: Option
    attribute?: Option
    indent?: string
    memberCase?: ForceCase
    typeCase?: ForceCase
    prepend?: string
    append?: string
    lineFeed?: string
    header?: boolean
    connectionData?: ConnectionData
    additional_info: any
}

export const defaultOptions =
{
    excludeTables: [],
    schema: 'public',
    extends: '',
    dialect: DialectType.PostgreSQL,
    exportKeyword: 'class',
    attribute: '',
    indent: '    ',
    memberCase: ForceCase.None,
    typeCase: ForceCase.None,
    prepend: '',
    append: '',
    lineFeed: '\n',
    header: true,
    additional_info: {},
} as Options;