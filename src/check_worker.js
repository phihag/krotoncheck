'use strict';

const check = require('./check');
const worker_utils = require('./worker_utils');

worker_utils.worker_main((season, cb) => {
	check.run_recheck(season, (err, res) => {
		if (err) return cb(err);
		return cb(null, res);
	});
});
