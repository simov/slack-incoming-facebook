#!/usr/bin/env node

var argv = require('minimist')(process.argv.slice(2))

if (argv.help) {
  console.log('--env development|staging|production')
  console.log('--config path/to/config.json')
  console.log('--db path/to/db.json')
  process.exit()
}

if (!argv.config) {
  console.error('Specify --config file')
  process.exit()
}

if (!argv.db) {
  console.error('Specify --db file')
  process.exit()
}

var hook = require('../')

hook.init()
hook.check()
  .then((responses) => responses && responses.forEach(([res, body]) =>
    console.log(new Date().toString(), res.statusCode, body)
  ))
  .catch((err) =>
    console.error(new Date().toString(), err))
