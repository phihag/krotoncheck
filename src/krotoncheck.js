'use strict';

var bodyParser = require('body-parser');
var cookie = require('cookie');
var cookieParser = require('cookie-parser');
var csrf = require('csurf');
var express = require('express');
var url = require('url');

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

config.load(function(err, app_cfg) {
	if (err) {
		throw err;
	}
	database.init(function(db) {
		run_server(app_cfg, db);
	});
});
