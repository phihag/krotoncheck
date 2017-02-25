'use strict';

const async = require('async');

const check = require('./check');



function read_stdin(cb) {
	const stdin = process.stdin;
	let res = '';

	stdin.on('readable', () => {
		let chunk;
		while ((chunk = stdin.read())) {
			res += chunk;
		}
	});
	stdin.on('end', () => {
		cb(null, res);
	});
}

async.waterfall([
	read_stdin,
	function(season_json, cb) {
		try {
			const season = JSON.parse(season_json);
			check.run_recheck(season, cb);
		} catch(e) {
			return cb(e);
		}
	},
], function(err, found) {	
	const response = err ? {error: err} : {found: found};
	const response_json = JSON.stringify(response);

	console.log(response_json);
});

