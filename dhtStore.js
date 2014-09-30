module.exports = DHTStore;

var   util  = require ('util')
,     DHT   = require ('./dht')
,     debug = require ('debug')('DHTStore')
,     hound = require ('hound')
,     mem   = require ('memory-stream')
,     tar   = require ('tar-fs')
,     fs    = require ('fs')
,     diff  = require ('diff')
,     createTorrent = require ('create-torrent')
;

/**
 * NOTE: this taring scheme is HIGHLY space-waisting, we keep 5 (actual dir,
 * base, latest, update, single-diffs) total copies of the data at all
 * times, one way to mitigate that would be to generate the base.tar or the
 * latest.tar on the fly from the single diffs. another one would be to gzip
 * it all together as we should get REALLY good compression (it's almost the
 * same data).
 *
 * this probably won't matter as our data-set should be in the sub 100Mb
 * range (still, one could totally argue that 400Mb overhead is absolutely
 * insane), and this strong data duplication only happens in the server
 * (DHTStore) for now… there is a bit (maybe 3 fold) of it in the client
 * though, and that probably needs to be looked into.
 */

var TAR_NAMES = {
        base: 'base.tar',
        latest: 'latest.tar',
        update: 'update.tar'
};

var self;
util.inherits (DHTStore, DHT);
function DHTStore (dir, opts) {
        self = this;

        if (!dir) {
                debug ('No dir to watch, die');
                return new Error('No dir to watch, pass at least dir');
        }

        DHTStore.super_.call (this, opts);

        if (!opts.port) opts.port = 20000;
        if (!opts.workDir) opts.workDir = './tmp/';
        if (!opts.announce) opts.announce = {};
        if (!opts.announce.timeout) opts.announce.timeout = 24*3600;

        fs.stat (opts.workDir, function (err) {
                if (err) {
                        debug ('creating non existing workDir', opts.workDir);
                        fs.mkdirSync (opts.workDir);
                }
        });

        self.opts = opts;
        self.dir = dir;
        self.last.announce = null;

        self.watch (self.dir);

        self.onChange();
        debug ('created new DHTStore', self.dir, self.opts);
};

/**
 * onChange: dir has changed on the watched dir
 *
 * check if enough time has passed for a new announce with canAnnounce() and
 * diff or announce new torrent.
 */
DHTStore.prototype.onChange = function () {
        if (self.canAnnounce()) {
                return self.publishTorrent();
        } else {
                return self.publishDiff()
        }
}

/**
 * publishTorrent: create new torrent and announce it on DHT.
 *
 * Note that this announces the *directory* on the DHT, we only use tarballs
 * for diffing.
 */
DHTStore.prototype.publishTorrent = function () {
        createTorrent (self.dir, {
                comment:   'Update ' + Date(),
                createdBy: 'DHTStore'
        }, function (err, torrent) {
                if (err)
                        return new Error (err);
                self.addTorrent({sig: 'none', //TODO: generate signature
                                 data: torrent});

                // TODO: broadcast new hash on DHT
                self.last.announce = Date.now();

                // XXX: we could actually copy here.
                self.tar (TAR_NAMES.base);
                self.tar (TAR_NAMES.latest);
        });
};

/**
 * tar: create a tar file from our watched directory to our work directory
 *
 * we use tar for diff so that we can have a simple in-memory representation
 * of changes and leverage binary diff algorithms. this would actually be
 * the same as shipping a directory unified diff, but should be more robust
 * for the kind of data we'll get.
 *
 * @param  {String}   dest	where to tar to
 * @param  {Function} callback	called after tar is done.
 */
DHTStore.prototype.tar = function (dest, callback) {
        callback = callback || function () {};
        var fn = self.opts.workDir + dest;
        var ts = tar.pack(self.dir).pipe(fs.createWriteStream(fn));
        debug ('creating new tar', fn, callback);
        ts.on ('close', function () {
                debug ('tar done');
                callback(fn);
        });
}

/**
 * publishDiff: create a new diff and announce it on DHT.
 *
 * this will create a new tar file in the work directory, diff it to the
 * latest tar file we had and publish the subsequent diff.
 *
 * NOTE: it is really important to throttle this in order not to flood the
 *        DHT. this and next note can probably be fixed by onceing the
 *        function.
 *
 * XXX:  this code is racy and that will bite us in the arse.
 */
DHTStore.prototype.publishDiff = function () {
        this.tar (TAR_NAMES.update, function (tarFile) {
                var orig = fs.readFileSync (self.opts.workDir + TAR_NAMES.latest);
                var dest = fs.readFileSync (tarFile);

                debug ('creating diff');
                var diffStr = diff.createPatch('DHTDiff', orig, dest, 'orig', 'dest');

                self.addDiff ({sig: 'none', //TODO: sign diff
                               data: diffData});
                self.last.diff = Date.now();

                self.tar (TAR_NAMES.latest); //XXX: copy
        });
};

/**
 * canAnnounce: check if enough time has passed and we can produce a new announce
 *
 * @return {Boolean}
 */
DHTStore.prototype.canAnnounce = function () {
        if (! this.last.announce) {
                // we never Announce'd so we can
                debug ('announce ACKd');
                return true; 
        }
        return (Date.now() - this.last.announce) > this.opts.announce.timeout;
};

/**
 * zip: compress for delivery
 *
 * @return {Object} self so we can chain;
 */
DHTStore.prototype.zip = function () {
        self.zip = zip(self.tar);
        return self;
};

/**
 * magnet: generate a magnet-link for our gziped self
 *
 * @return {Object} self so we can chain;
 */
DHTStore.prototype.magnet = function () {
        this.magnet = manget(self.zip);
        return self;
};

/**
 * start the DHT
 *
 * this is a utility function for the very lazy, really, it should be in
 * your index.js, it will monitor a path for changes, and refresh the
 * magnet-link or send diffs as required on the DHT
 *
 * @param {Number} port	port to listen on.
 */
DHTStore.prototype.start = function (port) {
        port = port || self.opts.port;
        self.listen(port, function () {
                debug('now listening on port', port);
        });
};

/**
 * watch a given directory for changes
 *
 * opts: {
 *   limit: delay, // only update every delay XXX: NOT IMPLEMENTED
 * }
 *
 * @param  {String} dir
 * @param  {Hash[<String>:<String>]} opts
 */
DHTStore.prototype.watch = function (dir, opts) {
        if (self.watcher)
                self.watcher.clear();
        if (opts)
                debug (opts, 'NOT IMPLEMENTED');

        self.watcher = hound.watch (dir);
        ['change', 'create', 'delete'].forEach (function (signal) {
                self.watcher.on(signal, self.onChange);
        });
}

