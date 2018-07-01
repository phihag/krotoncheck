'use strict';

const async = require('async');
const Datastore = require('nedb');
const fs = require('fs');
const path = require('path');

const utils = require('./utils');
const users = require('./users');

const DB_DIR = path.dirname(__dirname) + '/data';
const MAX_VRLS_DIR = path.join(DB_DIR, 'max_vrls');

function init(callback) {
	const db = {};

	if (! fs.existsSync(DB_DIR)) {
		fs.mkdirSync(DB_DIR);
	}

	['users', 'sessions', 'seasons', 'problems', 'autoruns', 'club_emails'].forEach(function(key) {
		db[key] = new Datastore({filename: DB_DIR + '/' + key, autoload: true});
	});

	db.users.ensureIndex({fieldName: 'email', unique: true});
	db.sessions.ensureIndex({fieldName: 'key', unique: true});
	db.seasons.ensureIndex({fieldName: 'key', unique: true});
	db.problems.ensureIndex({fieldName: 'key', unique: true});
	db.club_emails.ensureIndex({fieldName: 'season_club_id', unique: true});

	const admin_email = 'krotoncheck@aufschlagwechsel.de';
	db.users.find({email: admin_email}, function(err, docs) {
		if (err) {
			throw err;
		}
		if (docs.length === 0) {
			const pw = utils.gen_token();
			users.create(db, admin_email, pw, ['admin'], function(err) {
				if (err) throw err;
				console.log('Initial admin account: ' + admin_email +  ' : ' + pw + ' .');
			});
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

	async.waterfall([
		(cb) => {
			setup_autonum(cb, db, 'autoruns');
		},
		cb => utils.ensure_dir(MAX_VRLS_DIR, cb),
	], (err) => {
		callback(err, db);
	});
}

function fetch_all(db, specs, callback) {
	async.map(specs, function(spec, cb) {
		let queryFunc = spec.queryFunc || 'find';
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
	let idx = (start === undefined) ? 0 : start;
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
	init,
	MAX_VRLS_DIR,
};