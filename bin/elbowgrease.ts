import {parse as urlParse} from 'url';
import {grease} from "../src/elbowgrease";
import * as fs from 'fs'


let connectionData = process.argv.slice(-2, -1)[0];
let output = process.argv.slice(-1)[0];
let args = process.argv.slice(2, -2);
let options = {} as any;
let config = 'elbowgrease.json';

args.map(arg => {
    let option = /--([a-zA-Z]+)=(.*)/.exec(arg);
    if (option[1] === 'config')
    {
        config = option[2];
    }
    else
    {
        options[option[1]] = option[2];
    }
});

if (fs.existsSync(config))
{
    options = Object.assign(JSON.parse(fs.readFileSync(config, 'utf8')), options);
}

if('connectionData' in options)
{
    connectionData = options.connectionData;
}
if('output' in options)
{
    output = options.output;
}
if(typeof connectionData === 'string')
{
    options.dialect = urlParse(connectionData).protocol.slice(0,-1);
}


grease(connectionData, options).then(outputCode => {
    fs.writeFileSync(output, outputCode);
    process.exit();
});