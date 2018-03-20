'use strict';

const async = require('async');
const fs = require('fs');
const path = require('path');

const atomic_write = require('atomic-write');
const Baby = require('babyparse');

const downloads = require('./downloads');
const CREATE_CACHE = false;


function load_season_table(season, table_name, callback) {
	const dl = season.newest_download;
	if (!dl) {
		return callback(new Error('No downloads available'));
	}
	const dirname = path.join(downloads.DATA_ROOT, dl.id);
	load_data(dirname, [table_name], (err, loaded) => {
		if (err) return callback(err);

		return callback(err, loaded[table_name]);
	});
}

function load_season_data(season, callback) {
	async.waterfall([function(cb) {
		load_files(season, function(err, data) {
			season.data = data;
			cb(err, season);
		});
	}, function(season, cb) {
		if (! season.sg_csv) {
			return cb(null, season);
		}

		parse_csv(season.sg_csv, 'Spielgemeinschaften-' + season.key + '.csv', function(err, sg_table) {
			if (err) return cb(err);

			season.data.spielgemeinschaften = sg_table;
			cb(null, season);
		});
	}], callback);
}

function load_data(dirname, tasks, callback) {
	let data = {};
	async.each(tasks, function(task_name, cb) {
		const csv_fn = path.join(dirname, task_name + '.csv');
		parse_csv_fn(csv_fn, function(err, lines) {
			if (err) return cb(err);

			data[task_name] = lines;
			cb(err);
		});
	}, err => callback(err, data));
}

function load_data_cached(dirname, tasks, callback) {
	const json_fn = path.join(dirname, 'cachev1.json');
	fs.readFile(json_fn, {encoding: 'utf8'}, function(err, fcontents) {
		if (err) {
			load_data(dirname, tasks, function(err, data) {
				if (err) return callback(err);

				if (CREATE_CACHE) {
					atomic_write.writeFile(json_fn, JSON.stringify(data), {encoding: 'utf8'}, function(err) {
						callback(err, data);
					});
				} else {
					callback(err, data);
				}
			});
		} else {
			const data = JSON.parse(fcontents);
			callback(null, data);
		}
	});
}

function load_files(season, callback) {
	const dl = season.newest_download;
	if (!dl) {
		return callback(new Error('No downloads available'));
	}

	const dirname = path.join(downloads.DATA_ROOT, dl.id);
	load_data_cached(dirname, dl.tasks, callback);
}

function parse_csv(fcontents, fn, cb) {
	fcontents = fcontents.trim();

	Baby.parse(fcontents, {
		header: true,
		complete: function(res) {
			if (res.errors.length > 0) {
				return cb(new Error('Failed to parse ' + fn + ': ' + JSON.stringify(res.errors)));
			}
			const lines = res.data;
			cb(null, lines);
		},
	});
}

function parse_csv_fn(fn, cb) {
	// It seems crazily inefficient to read the file into memory,
	// but that seems to be the fastest way
	// See https://github.com/phihag/csv-speedtest for speed test
	fs.readFile(fn, {encoding: 'binary'}, function(err, fcontents) {
		if (err) return cb(err);
		parse_csv(fcontents, fn, cb);
	});
}

module.exports = {
	load_season_table,
	load_season_data,
	load_data, // testing only
};