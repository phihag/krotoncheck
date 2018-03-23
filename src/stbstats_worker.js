'use strict';

const stbstats = require('./stbstats');
const worker_utils = require('./worker_utils');

worker_utils.worker_main((params, cb) => {
	stbstats.run_calc(params, (err, stats) => {
		if (err) return cb(err);
		return cb(null, stats);
	});
});
