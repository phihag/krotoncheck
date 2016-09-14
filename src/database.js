'use strict';

var async = require('async');
var Datastore = require('nedb');
var fs = require('fs');
var path = require('path');

var utils = require('./utils');
var users = require('./users');

function init(callback) {
	var db = {};

	var db_dir = path.dirname(__dirname) + '/data';
	if (! fs.existsSync(db_dir)) {
		fs.mkdirSync(db_dir);
	}

	['users', 'sessions', 'seasons', 'problems'].forEach(function(key) {
		db[key] = new Datastore({filename: db_dir + '/' + key, autoload: true});
	});

	db.users.ensureIndex({fieldName: 'email', unique: true});
	db.sessions.ensureIndex({fieldName: 'key', unique: true});
	db.seasons.ensureIndex({fieldName: 'key', unique: true});
	db.problems.ensureIndex({fieldName: 'key', unique: true});

	var admin_email = 'krotoncheck@aufschlagwechsel.de';
	db.users.find({email: admin_email}, function(err, docs) {
		if (err) {
			throw err;
		}
		if (docs.length === 0) {
			var pw = utils.gen_token();
			var admin = users.create(db, admin_email, pw, ['admin']);
			console.log('Initial admin account: ' + admin.email +  ' : ' + pw + ' .');
		}
	});
	db.fetch_all = function(specs, callback) {
		return fetch_all(db, specs, callback);
	};
	db.efetch_all = function(errfunc, specs, callback) {
		return fetch_all(db, specs, function(err, ...args) {
			if (err) {
				return errfunc(err);
			}

			return callback.apply(null, args);
		});
	};

	callback(null, db);
}

function fetch_all(db, specs, callback) {
	async.map(specs, function(spec, cb) {
		var queryFunc = spec.queryFunc || 'find';
		if (queryFunc === '_findOne') {
			queryFunc = 'findOne';
		}

		db[spec.collection][queryFunc](spec.query, function (err, docs) {
			if (err) return cb(err);

			if ((spec.queryFunc == '_findOne') && !docs) {
				return cb(new Error('Cannot find one of ' + spec.collection));
			}

			cb(err, docs);
		});
	}, function(err, results) {
		if (err) return callback(err);

		callback(err, ...results);
	});
}

function setup_autonum(callback, db, collection, start) {
	var idx = (start === undefined) ? 0 : start;
	db[collection].autonum = function() {
		idx++;
		return '' + idx;
	};

	db[collection].find({}, function(err, docs) {
		if (err) {
			callback(err);
		}

		for (let doc of docs) {
			let int_id = parseInt(doc._id, 10);
			if (! isNaN(int_id)) {
				idx = Math.max(idx, int_id);
			}
		}

		return callback();
	});
}

module.exports = {
	init: init,
	setup_autonum: setup_autonum, // Currently unused(?)
};