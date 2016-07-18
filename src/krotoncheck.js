'use strict';

var async = require('async');
var bodyParser = require('body-parser');
var cookieParser = require('cookie-parser');
var csrf = require('csurf');
var express = require('express');

var config = require('./config');
var users = require('./users');
var database = require('./database');
var routes = require('./routes');

function run_server(app_cfg, db) {
	var server = require('http').createServer();
	var app = express();
	var csrfProtection = csrf({cookie: true});
	var parseForm = bodyParser.urlencoded({extended: false});

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
	},
], function(err, app_cfg, db) {
	if (err) {
		throw err;
	}
	run_server(app_cfg, db);
});
