'use strict';

var express = require('express');
var favicon = require('serve-favicon');
var path = require('path');

var downloads = require('./downloads');
var root = require('./root');
var seasons = require('./seasons');
var show = require('./show');
var users = require('./users');

function setup(app) {
	app.use('/static', express.static('static'));
	app.use(favicon(path.dirname(__dirname) + '/static/favicon.ico'));

	app.get('/', root.root_handler);

	app.post('/login', users.login_handler);
	app.get('/user/me', users.me_handler);
	app.get('/change-password', users.change_password_handler);
	app.post('/logout', users.logout_handler);

	app.get('/season_add/dialog', seasons.add_dialog_handler);
	app.post('/season_add', seasons.add_handler);
	app.get('/s/:season_key/', seasons.show_handler);
	app.post('/s/:season_key/recheck', seasons.recheck_handler);
	app.get('/s/:season_key/check', seasons.check_handler);
	app.post('/s/:season_key/change', seasons.change_handler);
	app.get('/s/:season_key/problems', seasons.show_problems_handler);
	app.post('/s/:season_key/ignore', seasons.ignore_handler);
	app.post('/s/:season_key/unignore', seasons.unignore_handler);

	app.get('/s/:season_key/show/', show.season_handler);
	app.get('/s/:season_key/show/player/:player_id', show.player_handler);

	app.post('/s/:season_key/download-start', downloads.start_handler);
}

module.exports = {
	setup: setup,
};
