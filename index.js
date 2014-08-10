var DHT    = require('bittorrent-dht');

var dht = new DHT();

dht.on('node', function (peer) {
        console.log("found another node", peer);
});

dht.on('peer', function (addr, hash) {
  console.log('Found peer at ' + addr + '!');
});

dht.on('message', function (data, rinfo) {
        console.log('Got message ', data, rinfo, '!');
});

dht.on('error', function (err) {
        console.log ('Got error', err);
});

dht.setInfoHash({
        "xt": "urn:btih:d2474e86c95b19b8bcfdb92bc12c9d44667cfa36",
        "dn": "Leaves of Grass by Walt Whitman.epub",
        "tr": [
                "udp://tracker.openbittorrent.com:80",
                "udp://tracker.publicbt.com:80",
                "udp://tracker.istole.it:6969",
                "udp://tracker.ccc.de:80",
                "udp://open.demonii.com:1337"
        ],
});

var port = 20000;
dht.listen(port, function (port) {
  console.log("Now listening on port " + port);
});

dht.findPeers();
