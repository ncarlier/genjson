'use strict'

function Timestamp (faker) {
  this.now = function () {
    return Date.now()
  }

  this.iso = function () {
    return new Date().toISOString()
  }

  this.recent = function () {
    return faker.date.recent().getTime()
  }

  this.future = function () {
    return faker.date.future().getTime()
  }
}

module['exports'] = Timestamp
