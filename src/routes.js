'use strict';

const express = require('express');
const favicon = require('serve-favicon');
const path = require('path');

const autoruns = require('./autoruns');
const downloads = require('./downloads');
const root = require('./root');
const seasons = require('./seasons');
const show = require('./show');
const stbstats = require('./stbstats');
const users = require('./users');

function setup(app) {
	app.use('/static', express.static('static'));
	app.use(favicon(path.dirname(__dirname) + '/static/favicon.ico'));

	app.get('/', root.root_handler);
	app.post('/login', users.login_handler);

	app.get('/user/me', users.need_permission('any', users.me_handler));
	app.get('/user/create_dialog', users.need_permission('any', users.create_dialog_handler));
	app.post('/user/create', users.need_permission('any', users.create_handler));
	app.get('/change-password', users.need_permission('any', users.change_password_handler));
	app.post('/logout', users.need_permission('any', users.logout_handler));

	app.get('/season_add/dialog', users.need_permission('any', seasons.add_dialog_handler));
	app.post('/season_add', users.need_permission('any', seasons.add_handler));
	app.get('/s/:season_key/', users.need_permission('any', seasons.show_handler));
	app.post('/s/:season_key/recheck', users.need_permission('any', seasons.recheck_handler));
	app.get('/s/:season_key/check', users.need_permission('any', seasons.check_handler));
	app.post('/s/:season_key/change', users.need_permission('any', seasons.change_handler));
	app.get('/s/:season_key/problems', users.need_permission('any', seasons.show_problems_handler));
	app.post('/s/:season_key/ignore', users.need_permission('any', seasons.ignore_handler));
	app.post('/s/:season_key/unignore', users.need_permission('any', seasons.unignore_handler));
	app.post('/s/:season_key/receiver_add', users.need_permission('any', seasons.receiver_add_handler));
	app.post('/s/:season_key/receiver_delete', users.need_permission('any', seasons.receiver_delete_handler));
	app.post('/s/:season_key/preview', users.need_permission('any', seasons.email_preview));
	app.post('/s/:season_key/send', users.need_permission('any', seasons.email_send));

	app.post('/s/:season_key/autorun/create', users.need_permission('any', autoruns.create_handler));
	app.post('/s/:season_key/autorun/:autorun_id/delete', users.need_permission('any', autoruns.delete_handler));
	app.post('/s/:season_key/autorun/:autorun_id/receiver_add', users.need_permission('any', autoruns.receiver_add_handler));
	app.post('/s/:season_key/autorun/:autorun_id/receiver_delete', users.need_permission('any', autoruns.receiver_delete_handler));

	app.get('/s/:season_key/stbstats', users.need_permission('any', stbstats.show_handler));

	app.get('/s/:season_key/show/', users.need_permission('any', show.season_handler));
	app.get('/s/:season_key/show/player/:player_id', users.need_permission('any', show.player_handler));

	app.post('/s/:season_key/download-start', users.need_permission('any', downloads.start_handler));
}

module.exports = {
	setup: setup,
};
