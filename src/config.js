'use strict';

var fs = require('fs');
var path = require('path');

var utils = require('./utils');


function load_config() {
	var fn = path.dirname(__dirname) + '/config.json';
	var config_json = fs.readFileSync(fn);
	var read_config = JSON.parse(config_json);
	utils.update(config_data, read_config);
}

var config_data = {};
load_config();

function config(key) {
	if (! (key in config_data)) {
		throw new Error('Cannot find configuration key ' + JSON.stringify(key));
	}
	return config_data[key];
}

module.exports = config;