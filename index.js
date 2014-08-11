var DHT    = require('bittorrent-dht');
var magnet = require('magnet-uri');
var uri = 'magnet:?xt=urn:btih:04a8c73349e0fe148557c3a9ba8482e0aa67ad49&dn=Captain+America+The+Winter+Soldier+%282014%29+1080p+BrRip+x264+-+YIF&tr=udp%3A%2F%2Ftracker.openbittorrent.com%3A80&tr=udp%3A%2F%2Ftracker.publicbt.com%3A80&tr=udp%3A%2F%2Ftracker.istole.it%3A6969&tr=udp%3A%2F%2Fopen.demonii.com%3A1337';
var parsed = magnet(uri);

var dht = new DHT({
        bootstrap: ['core.evilgiggle.com:6881']
});

var infoHash = parsed.infoHash;

dht.listen(20000, function () {
  console.log('now listening')
});

dht.on('ready', function () {
  // DHT is ready to use (i.e. the routing table contains at least K nodes, discovered
  // via the bootstrap nodes)

  // find peers for the given torrent info hash
  dht.lookup(parsed.infoHash)
});

dht.on('peer', function (addr, hash, from) {
        console.log('found potential peer ' + addr + ' through ' + from);
});


dht.on('node', function (peer) {
        console.log("found another node", peer);
});

