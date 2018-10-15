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

    static normalizeWords(text: string): Array<string>
    {
        // someThing => some Thing
        text = text.replace(/([A-Z][a-z0-9]*)/g, ' $1');
        // some_thing or some-thing => some thing
        text = text.replace(/[_-]/g, ' ');

        // " Some Thing " => [some, thing]
        let words = text.split(' ').filter(x => x).map(x => x.toLowerCase());
        return words;
    }

    static capitalize(text: string)
    {
        if (text.length === 1)
        {
            return text.toUpperCase;
        }
        else
        {
            return text.charAt(0).toUpperCase() + text.substr(1);
        }
    }

    static camelCase(text: string)
    {
        let words = this.normalizeWords(text);
        return words.map((word, i) => i ? this.capitalize(word) : word).join('');
    }

    static pascalCase(text: string)
    {
        let words = this.normalizeWords(text);
        return words.map(word => this.capitalize(word)).join('');
    }

    static snakeCase(text: string)
    {
        let words = this.normalizeWords(text);
        return words.join('_');
    }

    protected getHost()
    {
        let data = this.options.connectionData;
        if (data)
        {
            if (typeof data === 'string')
            {
                return urlParse(data).host
            }
            else
            {
                return data.host;
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
        let opt = this.options;
        let lf = opt.lineFeed;
        let output = '';
        output += `export ${opt.exportKeyword} ${table.name}`;
        if (opt.extends)
        {
            output += ` extends ${opt.extends}`;
        }

        output += lf + '{' + lf;
        let attribute = opt.attribute ? opt.indent + opt.attribute + lf : '';

        table.columns.map(column => {
            output += attribute;
            output += `${opt.indent}${column.name}: ${this.generateType(column)};${lf}`;
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