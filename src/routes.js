'use strict';

var express = require('express');

var users = require('./users');
var root = require('./root');

function setup(app) {
	app.use('/static', express.static('static'));

	app.get('/', root.root_handler);
	app.post('/login', users.login_handler);
	app.get('/user/me', users.me_handler);
	app.get('/change-password', users.change_password_handler);
	app.post('/logout', users.logout_handler);
}

module.exports = {
	setup: setup,
};
