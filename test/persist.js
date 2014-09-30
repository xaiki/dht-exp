var common = require('./common')
var DHT = require('../dht')
var DHTStore = require('../dhtStore')
var test = require('tape')

test('DHT: persist dht', function (t) {
  t.plan(1)

  var dht1 = new DHT({ bootstrap: false })
  common.failOnWarningOrError(t, dht1)

  for (var i = 0; i < DHT.K; i++) {
    dht1.addNode(common.randomAddr(), common.randomId())
  }

  dht1.on('ready', function () {
    var bootstrap = dht1.toArray()
    var dht2 = new DHT({ bootstrap: bootstrap })

    dht2.on('ready', function () {
      t.deepEqual(dht2.toArray(), dht1.toArray())
      dht1.destroy()
      dht2.destroy()
    })
  })

})

test('DHTStore: persist dht', function (t) {
  t.plan(1)

  var dht1 = new DHTStore(__dirname, { bootstrap: false })
  common.failOnWarningOrError(t, dht1)

  for (var i = 0; i < DHT.K; i++) {
    dht1.addNode(common.randomAddr(), common.randomId())
  }

  dht1.on('ready', function () {
    var bootstrap = dht1.toArray()
    var dht2 = new DHT({ bootstrap: bootstrap })

    dht2.on('ready', function () {
      t.deepEqual(dht2.toArray(), dht1.toArray())
      dht1.destroy()
      dht2.destroy()
    })
  })
})
