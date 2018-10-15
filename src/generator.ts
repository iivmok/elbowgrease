import {Column, DBColumn, Table} from "./dialects";
import {parse as urlParse} from "url";
import {Options} from "./options";

export type ITransformColumn = ((column: DBColumn) => Column);

export enum ForceCase
{
    None = 'none',
    Camel = 'camel',
    Snake = 'snake',
    Pascal = 'pascal',
}

export class Generator
{
    protected static indent = '    ';
    options: Options;

    constructor(options: Options)
    {
        this.options = options;
    }

    static camelCase(text: string)
    {
        return text.split(/[^a-z]/i).filter(x => x).map((v, i) => {
            return i ? v.charAt(0).toUpperCase() + v.substr(1) : v;
        }).join('');
    }

    protected getHost()
    {
        if (this.options.connectionData)
        {
            if (typeof this.options.connectionData === 'string')
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
        output += `export ${o.exportKeyword} ${table.name}`;
        if (o.extends)
        {
            output += ` extends ${o.extends}`;
        }

        output += lf + '{' + lf;
        let attribute = o.attribute ? o.indent + o.attribute + lf : '';

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
        if (o.header)
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
        if (o.prepend)
        {
            output += o.prepend + lflf;
        }

        output += tables.map(table => this.generateClass(table)).join(lflf);

        if (o.append)
        {
            output += lflf + o.append;
        }
        return output;
    }
}