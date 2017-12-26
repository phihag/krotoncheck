'use strict';

const fs = require('fs');
const path = require('path');

function load(cb) {
	const fn = path.dirname(__dirname) + '/config.json';
	fs.readFile(fn, function(err, config_json) {
		if (err) {
			return cb(err);
		}
		const config_data = JSON.parse(config_json);
		cb(null, function(key, def) {
			if (! (key in config_data)) {
				if (def !== undefined) {
					return def;
				}
				throw new Error('Cannot find configuration key ' + JSON.stringify(key));
			}
			return config_data[key];
		});
	});
}

module.exports = {
	load: load,
};