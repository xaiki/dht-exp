module.exports = DHT

var BTDHT = require ('bittorrent-dht')
,   BTclt = require ('bittorrent-client')
,   debug = require ('debug')('PTDHT')
,   util  = require ('util')
,   zip   = require ('zip')
,   diff  = require ('diff')
;

util.inherits (DHT, BTDHT);

/**
 * We extend on the BitTorrent DHT implementation to announce trackers and diffs.
 * @param {string|Buffer} opts
 */

function DHT (opts) {
        DHT.super_.call (this, opts);

        var self = this;

        if (! opts) opts = {};
        if (! opts.file)   opts.file   = 'index.db';
        if (! opts.pubkey) opts.pubkey = 'dht.pem';

        self.queryHandler['update'] = self._onUpdate;
        self.queryHandler['diff']   = self._onDiff;

        self.last = {
                update: null, /* not used, kill it ? */
                diff  : null
        };

        self.data = null;
        self.transfering = false;
        self.opts = opts;

        self.client = BTclt({
                path: self.file,
                dht: self
        });

        self.client.on ('torrent', self.onTorrent);
}

DHT.prototype.onTorrent = function (torrent) {
        var self = this;

        torrent.files.forEach (function (file) {
                debug ('selecting', file.path, file.name);
                file.select();
        });

        torrent.on ('done', function () {
                self.streamDataDone()
        });
}

/**
 * Check a data + signature tupple against a public key
 *
 * @param  {Object.<data: <Buffer>, sig: <String>>} d
 */
DHT.prototype.checkSig = function (d) {
        // TODO: IMPLEMENT
        // return crypto.checkSig(d.data, d.sig, self.pubkey);
        debug ('checkSig NOT IMPLEMENTED');
        return true;
}

/**
 * addTorrent: a new torrent appeared on the DHT
 *
 * @param  {Object} d {data, sig}
 * @param {Function} cb
 */
DHT.prototype.addTorrent = function (d, cb) {
        var self = this;

        cb = cb || function () {};

        if (self.client.torrents.length) {
                var torrent = self.client.torrents[0];

                // we are already getting this file
                if (torrent.id === d.data.infoHash) {
                        return;
                }
                torrent.remove();
        }

        var sig = d.sig;
        self.torrent = d.data;

        debug ('adding torrent', d);
        self.client.add (self.torrent);
}

DHT.prototype.streamData = function (chunk) {
        debug ('got stream data', chunk);
        self.transfering = true;
        self.emit ('stream:data', chunk);
}

DHT.prototype.stramDataDone = function (sig) {
        debug ('stream fully retrieved');
        self.transfering = false;
        self.last.diff = sig;
        self.emit ('stream:done');
}

/**
 * Called when another node sends a "update" query.
 *
 * This means that a new magnet has been broadcast, and that we need to
 * download it, but first we'll check it against the well-known public key
 * we have and broadast it back.
 *
 * These queries are allowed every 24 hours
 *
 * { t: aa, y: q, q: update, a: {id: abcd…, data: urn:abcd…, sig: abcd…}}
 *
 * @param  {string} addr
 * @param  {Object} message
 */
DHT.prototype._onUpdate = function (addr, message) {
        var self = this;

        if (! self.checkSig (message.a))
                return;

        self.addTorrent (message.a);
        self.broadcast (addr, message);
}

/**
 * Called when another node sends a "diff" query.
 *
 * This means that our data had minor change, that can be diffed from our
 * last known state. In order to allow us to reconstruct the DAG of diffs,
 * we give the ids of the previous diff. yes this is basically a really
 * gitty git.
 *
 * Nodes are required to cache all diffs between update and send them on
 * request, they have to send them pristine so that we can check their
 * signature
 *
 * these are allowed every 15 mins.
 *
 * NOTE: the first diff's last field should be the torrent's signature
 *
 * { t: aa, y: q, q: diff, a: {id: urn:abcd…, data: abcd…, sig: abcd…, last: abcd…}}
 * --or--
 * { t: aa, y: q, q: diff, a: {id: urn:abcd…, data:
 *                              [data: abcd…, sig: abcd…, last: abcd…]
 *                              [data: abcd…, sig: abcd…, last: abcd…],
 *                            },
 * }
 *
 * @param  {string} addr
 * @param  {Object} message
 */
DHT.prototype._onDiff = function (addr, message) {
        var self = this;

        var ret = false;
        var data = message.a;

        if (self.magnet !== data.id) {
                debug ('got a diff for another magnet, dropping');
                return false;
        }

        if (! self.checkSig (data))
                return false;

        if (!self.messageIsResponse (message)) {
                // check if it is a response for me ?
                self.emit ('diff', data);
                self.applyDiff (data);
        } else {
                // this is a regular diff, broadcast it to all but the
                // sender.

                self.emit ('diff', data);
                self.applyDiff (data);
                self.broadcast (addr, message);
        }

        if (!ret)
                ret = self._requestDiff (message);

        return ret;
}

/**
 * Send "diff" query to given addr,
 *
 * we'll do that on the node we got the diff from, at this point we know
 * that the diff is legit as we already have checked its signature. If that
 * node doesn't answer us in a reasonable time (maybe it went down) we'll
 * need to ask the swarn.
 *
 * @param {String} addr
 * @param {Function} cb called with response
 */
DHT.prototype._requestDiff = function (addr, cb) {
        self.query ({
                q: 'diff',
                a: {
                        id: self.nodeId,
                        last: self.last.diff
                }
        }, addr);
}


/**
 * Update the data we have recursively applying all the diffs we're given
 *
 * we save a copy of the data, apply the diffs, and then return, this has to
 * be pretty sync in order not to mess anything up.
 *
 * @param  {Array.[data:<Buffer>, sig:<String>]} diffs
 * @return {Boolean}
 */
DHT.prototype.applyDiff = function (diffs) {
        if (typeof diffs.data === 'string') {
                diffs = [diffs];
        } else if (typeof diffs.data === 'array') {
                diffs = diffs.data;
        } else {
                debug ('wrong diff data');
                return false;
        }

        var data = self.data;
        for (var d = diffs.pop(); d; d = diffs.pop()) {
                if (self.last.diff !== d.last) {
                        debug ('diff is not the next on line');
                        return false;
                }
                if (! self.checkSig (d)) {
                        debug ('failed to check diff signature');
                        return false;
                }
                data = diff.applyPatch (data, d.data);
                if (! data) {
                        debug ('failed to apply diff');
                        return false;
                }
                self.last.diff = d.sig;
        }

        self.data = data;
        return true;
}
