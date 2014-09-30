var common = require('./common')
var DHT = require('../')
var test = require('tape')

test('we download data dht', function (t) {
  var nodes = [];
  for (var i = 0; i < DHT.K; i++) {
    nodes.push(new DHT({ bootstrap: false }))
  }

  for (var i = 0; i < DHT.K; i++) {
    nodes[i].on('ready', function () {
      for (var j = 0; j < DHT.K; j++) {
        if (i == j)
          continue;

        nodes[j].addNode ('localhost', nodes[i].port);
      }
    });
  }

  var dht = nodes[0];
  common.failOnWarningOrError(t, dht)

  t.end()

})
