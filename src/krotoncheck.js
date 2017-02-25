'use strict';

const async = require('async');
const bodyParser = require('body-parser');
const cookieParser = require('cookie-parser');
const csrf = require('csurf');
const express = require('express');

const autoruns = require('./autoruns');
const config = require('./config');
const users = require('./users');
const database = require('./database');
const routes = require('./routes');

function run_server(app_cfg, db) {
	const server = require('http').createServer();
	const app = express();
	const csrfProtection = csrf({cookie: true});
	const parseForm = bodyParser.urlencoded({extended: false});

	app.db = db;
	app.config = app_cfg;
	app.root_path = app_cfg('root_path');

	app.use(cookieParser());
	app.use(users.middleware);
	app.use(parseForm);
	app.use(csrfProtection);

	routes.setup(app);

	server.on('request', app);
	server.listen(app.config('port'), function () {
		
	});
}

async.waterfall([
	config.load,
	function(app_cfg, cb) {
		database.init(function(err, db) {
			return cb(err, app_cfg, db);
		});
	}, function(app_cfg, db, cb) {
		autoruns.init(app_cfg, db, (err) => cb(err, app_cfg, db));
	},
], function(err, app_cfg, db) {
	if (err) {
		throw err;
	}
	run_server(app_cfg, db);
});
