'use strict';

const express = require('express');
const favicon = require('serve-favicon');
const path = require('path');

const autoruns = require('./autoruns');
const downloads = require('./downloads');
const root = require('./root');
const seasons = require('./seasons');
const show = require('./show');
const users = require('./users');

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
	app.post('/s/:season_key/receiver_add', seasons.receiver_add_handler);
	app.post('/s/:season_key/receiver_delete', seasons.receiver_delete_handler);
	app.post('/s/:season_key/preview', seasons.email_preview);
	app.post('/s/:season_key/send', seasons.email_send);

	app.post('/s/:season_key/autorun/create', autoruns.create_handler);
	app.post('/s/:season_key/autorun/:autorun_id/delete', autoruns.delete_handler);
	app.post('/s/:season_key/autorun/:autorun_id/receiver_add', autoruns.receiver_add_handler);
	app.post('/s/:season_key/autorun/:autorun_id/receiver_delete', autoruns.receiver_delete_handler);


	app.get('/s/:season_key/show/', show.season_handler);
	app.get('/s/:season_key/show/player/:player_id', show.player_handler);

	app.post('/s/:season_key/download-start', downloads.start_handler);
}

module.exports = {
	setup: setup,
};
