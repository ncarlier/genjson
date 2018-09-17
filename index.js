#!/usr/bin/env node

'use strict'

const packageInfo = require('./package.json')
const process = require('process')
const bunyan = require('bunyan')
const program = require('commander')
const Rx = require('rxjs/Rx')
const jsf = require('json-schema-faker')
const request = require('request')
const fs = require('fs')
const assert = require('assert')
const validUrl = require('valid-url')

const logger = bunyan.createLogger({name: packageInfo.name})

jsf.extend('faker', () => require('./custom-faker'))
jsf.option({
  alwaysFakeOptionals: true
})

function parseURL (val) {
  if (val === 'stdout' || validUrl.isUri(val)) {
    return val
  }
  return false
}

function parseNumber (val) {
  const i = parseInt(val, 10)
  return isNaN(i) ? false : i
}

function exit (msg) {
  if (ws) {
    ws.close()
  }
  if (msg instanceof Error) {
    console.error(JSON.stringify(msg))
    process.exit(2)
  }
  console.log(msg)
}

// CLI definition.
program
  .version(packageInfo.version)
  .description('Produce JSON stream using JSON schema and fake data generator.')
  .option('-o --output <url>', 'Output URL (http:// or file:// or stdout)', parseURL, 'stdout')
  .option('-s --schema <schema>', 'JSON schema use to generate fake events')
  .option('-i --interval [ms]', 'Interval between events creation', parseNumber, 100)
  .option('-c --count [nb]', 'Number of event to create', parseNumber, 1)
  .option('-d --debug', 'Output debug messages', false)
  .parse(process.argv)

// Validate CLI parameters...
try {
  assert(program.output, 'invalid output URL parameter')
  assert(program.schema, 'invalid schema file parameter')
  assert(program.interval, 'invalid interval parameter')
  assert(program.count, 'invalid count parameter')
} catch (err) {
  console.error(err.toString())
  program.outputHelp()
  process.exit(1)
}

// Set logger level
if (program.debug) {
  logger.level('debug')
}

// Loading JSON schema file...
let schema
try {
  schema = JSON.parse(fs.readFileSync(program.schema, 'utf8'))
} catch (err) {
  console.error(err.toString())
  program.outputHelp()
  process.exit(1)
}

// Configuring output provider
let writeJSON, ws
switch (true) {
  case program.output.startsWith('https://'):
  case program.output.startsWith('http://'):
    const request$ = Rx.Observable.bindNodeCallback(request, res => res)
    writeJSON = json => request$({ method: 'POST', url: program.output, json }).timeout(2000).retry(2)
    break
  case program.output.startsWith('file://'):
    ws = fs.createWriteStream(program.output.substring(7), {flags: 'a'})
    writeJSON = json => Rx.Observable.of(ws.write(JSON.stringify(json) + '\n')).mapTo({body: 'ok'})
    break
  default:
    writeJSON = json => Rx.Observable.of(JSON.stringify(json)).do(console.log).mapTo({body: 'ok'})
}

logger.debug(`Producing ${program.count} events each ${program.interval}ms to ${program.output} using ${program.schema} as schema...`)

// Create observable objects form standard callback or promise functions.
const json$ = Rx.Observable.defer(() => jsf.resolve(schema))

// Define the complete stream processing:
// Alternative: random delay between each event
// const stream$ = Rx.Observable.of(null).concatMap(() => json$.delay(Math.random() * 1000))
const stream$ = json$
  .delay(program.interval)
  // .do(json => console.log('Produce:', json))
  .flatMap(writeJSON)
  // .do(res => console.log('Status code:', res.statusCode))
  // .map(res => res.body)
  .repeat().take(program.count)

// Start the streaming process:
stream$.subscribe(
  res => logger.debug(res.body),
  err => exit(err),
  () => logger.debug('done')
)
