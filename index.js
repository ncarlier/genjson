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
  alwaysFakeOptionals: false
})

const parseOutputOption = (val) => (val === 'stdout' || validUrl.isUri(val)) ? val : false
const parseErrorOption = (val) => (val === 'exit' || val === 'stdout' || validUrl.isUri(val)) ? val : false
const parseNumberOption = (val) => {
  const i = parseInt(val, 10)
  return isNaN(i) ? false : i
}


function exit (msg) {
  if (ws) {
    ws.close()
  }
  if (errWs) {
    errWs.close()
  }
  if (msg instanceof Error) {
    logger.error(msg.message)
    process.exit(2)
  }
  logger.debug(msg)
}

// CLI definition.
program
  .version(packageInfo.version)
  .description('Produce JSON stream using JSON schema and fake data generator.')
  .option('-o --output <url>', 'Output URL (http:// or file:// or stdout)', parseOutputOption, 'stdout')
  .option('-s --schema <schema>', 'JSON schema use to generate fake events')
  .option('-i --interval [ms]', 'Interval between events creation', parseNumberOption, 100)
  .option('-c --count [nb]', 'Number of event to create', parseNumberOption, 0)
  .option('-d --debug', 'Output debug messages', false)
  .option('-e --on-error <action>', 'Error output file (file:// or stdout or exit)', parseErrorOption, 'exit')
  .parse(process.argv)

// Set logger level
if (program.debug) {
  logger.level('debug')
}

// Validate CLI parameters...
try {
  assert(program.output, 'invalid output URL parameter')
  assert(program.schema, 'invalid schema file parameter')
  assert(program.interval, 'invalid interval parameter')
} catch (err) {
  logger.error(err.toString())
  program.outputHelp()
  process.exit(1)
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

// Configuring error handler
let errorHandler, errWs
switch (true) {
  case program.onError.startsWith('file://'):
    errWs = fs.createWriteStream(program.onError.substring(7), {flags: 'a'})
    errorHandler = res => Rx.Observable.of(errWs.write(JSON.stringify(res.body) + '\n')).mapTo(res.statusMessage)
    break
  case program.onError === 'stdout':
    errorHandler = res => Rx.Observable.of(JSON.stringify(res.body)).do(console.error).mapTo(res.statusMessage)
    break
  default:
    errorHandler = res => Rx.Observable.throw(new Error(res.statusMessage))
}

// Configuring output provider
let writeJSON, ws
switch (true) {
  case program.output.startsWith('https://'):
  case program.output.startsWith('http://'):
    const request$ = Rx.Observable.bindNodeCallback(request, res => res)
    writeJSON = json => request$({
      method: 'POST',
      url: program.output,
      json
    }).timeout(2000).retry(2).flatMap(res => {
      if (res.statusCode >= 200 && res.statusCode < 299) {
        return Rx.Observable.of(res)
      } else {
        return errorHandler(res)
      }
    })
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
let stream$ = json$
  .delay(program.interval)
  // .do(json => console.log('Produce:', json))
  .flatMap(writeJSON)
  // .do(res => console.log('Status code:', res.statusCode))
  // .map(res => res.body)
  .repeat()

if (program.count) {
  stream$ = stream$.take(program.count)
}

// Start the streaming process:
stream$.subscribe(
  res => logger.debug(res),
  err => exit(err),
  () => exit('done')
)
