var DHT = require('./dht');

DHT.K =20;

var nodes = [];
for (var i = 0; i < DHT.K; i++) {
  nodes.push(new DHT({ bootstrap: false }));
}

for (i = 0; i < DHT.K; i++) {
  var node = nodes[i];
  node.listen (function (port) {
    for (var j = 0; j < DHT.K; j++) {
      if (nodes[j] === node) {
        return;
      }
      nodes[j].addNode ('localhost:' + port, node.nodeId, 'localhost:' + port);
    }
  });
}


for (i = 0; i < DHT.K; i++) {
  nodes[i].announce('caca', nodes[i].port + 10000);
}
