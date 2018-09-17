'use strict'

const path = require('path')
const faker = require('faker')

function bindAll (obj) {
  Object.keys(obj).forEach(function (meth) {
    if (typeof obj[meth] === 'function') {
      obj[meth] = obj[meth].bind(obj)
    }
  })
  return obj
}

// Dynamic loading custom fakes...
require('fs').readdirSync(__dirname).forEach((file) => {
  if (/^[a-z_]+\.fake\.js$/.test(file)) {
    const name = path.basename(file, '.fake.js')
    // console.log(`Loading ${name} custom fakes...`)
    const CustomFake = require(path.join(__dirname, file))
    faker[name] = bindAll(new CustomFake(faker))
  }
})

module.exports = faker
