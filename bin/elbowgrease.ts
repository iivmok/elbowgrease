#! /usr/bin/env node

import {parse as urlParse} from 'url';
import * as fs from 'fs'
import * as path from 'path'

import {ConnectionDataObject, grease} from "../src/elbowgrease";
import {DialectType} from "../src/dialects";

let connectionData = null;
let output = null;
let args = process.argv.slice(2);
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
    config = fs.realpathSync(config);
    console.log('Loading config from ' + config);
    options = Object.assign(JSON.parse(fs.readFileSync(config, 'utf8')), options);
}
else
{
    console.log(`Config file "${config}" not found.`);
}

if ('connectionData' in options)
{
    connectionData = options.connectionData;
}
if ('output' in options)
{
    output = options.output;
}
if (typeof connectionData === 'string')
{
    options.dialect = urlParse(connectionData).protocol.slice(0, -1);
}

let runningGlobal = false;


try
{
    let firstPath = module.paths[0];
    let up = path.sep + '..';
    fs.realpathSync(firstPath + up + up + up + path.sep + 'npm');
    runningGlobal = true;

} catch { }


function checkModule(dialect, module)
{
    if (options.dialect === dialect)
    {
        try
        {
            require.resolve(module)
        }
        catch (e)
        {
            console.error(`Error: "${dialect}" dialect selected, but module "${module}" not installed.`);
            console.log(`Try running 'npm i ${runningGlobal ? '-g ': ''}${module}'`);
            process.exit(1);
        }
    }
}

checkModule(DialectType.PostgreSQL, 'pg');
checkModule(DialectType.MySQL, 'mysql');

if(!connectionData)
{
    console.error('Error: no connection data specified.');
    process.exit(1)
}
if(!output)
{
    console.error('Error: no output specified.');
    process.exit(1)
}
else
{
    output = fs.realpathSync(output);
}

if(typeof connectionData === 'string')
{
    let c = urlParse(connectionData);
    let auth = c.auth;
    try
    {
        auth = auth ? auth.split(':')[0] + ':*******@' : '';
    }
    catch { }

    let port = c.port ? ':' + c.port : '';

    console.log(`Connecting to ${c.protocol}//${auth}${c.host}${port}${c.path}`);
}
else
{
    let c: ConnectionDataObject = connectionData;
    let port = c.port ? ':' + c.port : '';
    let auth = c.user ? c.user + ':******@' : '';

    console.log(`Connecting to ${options.dialect||'postgres'}://${auth}${c.host}${port}/${c.database}`);
}


let start = process.hrtime();
grease(connectionData, options).then(result => {
    fs.writeFileSync(output, result.result);
    let end = process.hrtime(start);
    //let ms = (end[0] * 1e9 + end[1])/1e6;
    let ms = end[0] * 1e3 + (end[1] / 1e6);
    console.log(`Wrote ${result.tables} definitions to ${output}`);
    console.log(`Generation took ${ms.toFixed(0)}ms`);
    process.exit();
});