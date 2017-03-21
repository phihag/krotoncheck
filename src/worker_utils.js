'use strict';

const async = require('async');
const child_process = require('child_process');


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

function worker_main(func) {
	async.waterfall([
		read_stdin,
		function(data_json, cb) {
			try {
				const data = JSON.parse(data_json);
				func(data, cb);
			} catch(e) {
				return cb(e);
			}
		},
	], function(err, res) {	
		const response = err ? {error: err} : res;
		const response_json = JSON.stringify(response);

		console.log(response_json);
	});
}

function in_background(worker_fn, arg, callback) {
	// node.js IPC does not seem suitable to extremely large structures like the whole season right now.
	// Therefore, run a child program.
	const child = child_process.execFile('node', [worker_fn], {maxBuffer: 10 * 1024 * 1024}, (err, stdout, stderr) => {
		if (err) return callback(err);

		if (stderr) {
			console.error(stderr);
		}

		const res = JSON.parse(stdout);
		if (res.error) {
			return callback(res.error);
		}

		callback(null, res);
	});
	child.stdin.setEncoding('utf-8');
	child.stdin.write(JSON.stringify(arg));
	child.stdin.end();
}

module.exports = {
	in_background,
	worker_main,
};
