'use strict';

const bulifinals = require('./bulifinals');
const worker_utils = require('./worker_utils');

worker_utils.worker_main((season, cb) => {
	bulifinals.run_calc(season, (err, info) => {
		if (err) return cb(err);
		return cb(null, {info});
	});
});
