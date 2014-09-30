var DHTStore    = require('./dhtStore');

var dhtStore = new DHTStore('./data', {
        bootstrap: ['core.evilgiggle.com:6881'],
        pubkey: 'pubkey.pem'
});

dhtStore.listen(20000, function () {
        console.log('now listening');
});

dhtStore.on('ready', function () {
  // DHTSTORE is ready to use (i.e. the routing table contains at least K nodes, discovered
  // via the bootstrap nodes)

  // find peers for the given torrent info hash
});

dhtStore.on('peer', function (addr, hash, from) {
        console.log('found potential peer ' + addr + ' through ' + from);
});


dhtStore.on('node', function (peer) {
        console.log("found another node", peer);
});

