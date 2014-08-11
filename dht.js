module.exports = DHT

var BTDHT = require ('bittorrent-dht')
, debug = require ('debug')('PTDHT')
, util = require ('util')
;

util.inherits (DHT, BTDHT);

/**
 * We extend on the BitTorrent DHT implementation to announce trackers and diffs.
 * @param {string|Buffer} opts
 */

function DHT (opts) {
        var self = this;
        BTDHT.call (self, opts);
        self.queryHandler['vote'] = self._onVote.bind(self);
}

/**
 * Called when another node sends a "vote" query.
 * @param  {string} addr
 * @param  {Object} message
 */
DHT.prototype._onVote = function (addr, message) {
        var self = this;
        var res = {
                t: message.t,
                y: self.MESSAGE_TYPE.RESPONSE,
                r: {
                        id: self.nodeId,
                        vote: 'null'
                }
        };
}

/**
 * Send "vote" query to given addr.
 * @param {string} addr
 * @param {function} cb called with response
 */
DHT.prototype._sendVote = function (addr, cb) {
        self.query ({
                q: 'vote',
                a: {
                        id: self.nodeId,
                        vote: 'null'
                }
        });
}
