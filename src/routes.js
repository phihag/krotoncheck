'use strict';

var express = require('express');

var root = require('./root');
var seasons = require('./seasons');
var users = require('./users');

function setup(app) {
	app.use('/static', express.static('static'));

	app.get('/', root.root_handler);

	app.post('/login', users.login_handler);
	app.get('/user/me', users.me_handler);
	app.get('/change-password', users.change_password_handler);
	app.post('/logout', users.logout_handler);

	app.get('/season_add/dialog', seasons.add_dialog_handler);
	app.post('/season_add', seasons.add_handler);
	app.get('/s/:season_key/', seasons.show_handler);
}

module.exports = {
	setup: setup,
};
