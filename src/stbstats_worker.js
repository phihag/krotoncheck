'use strict';

const stbstats = require('./stbstats');
const worker_utils = require('./worker_utils');

worker_utils.worker_main((season, cb) => {
	stbstats.run_calc(season, (err, stats) => {
		if (err) return cb(err);
		return cb(null, {stats});
	});
});
