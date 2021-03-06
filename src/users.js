'use strict';

const bcrypt = require('bcrypt');

const utils = require('./utils');
const render = require('./render');

function hash_password(pw) {
	const salt = bcrypt.genSaltSync(10);
	return bcrypt.hashSync(pw, salt);
}

function create(db, email, password, permissions, cb) {
	const u = {
		email: email,
		password: hash_password(password),
		permissions: permissions,
	};
	db.users.insert(u, err => cb(err, u));
}

function create_dialog_handler(req, res, next) {
	render(req, res, next, 'user_create_dialog', {});
}

function create_handler(req, res, next) {
	const password = utils.gen_token();
	const email = req.body.email;
	if (! email) {
		return next(new Error('Missing field email'));
	}

	create(req.app.db, email, password, [''], function(err) {
		if (err) return next(err);

		render(req, res, next, 'user_created', {
			email,
			password,
		});
	});
}

function login_handler(req, res, next) {
	const email = req.body.email;
	req.app.db.users.findOne({email: email}, function(err, u) {
		if (err) {
			return next(err);
		}

		if (!u) {
			render(req, res, next, 'login_failed', {
				reason: 'Es gibt keinen Account mit dieser E-Mail-Adresse.',
				email: email,
			});
			return;
		}

		if (! bcrypt.compareSync(req.body.password, u.password)) {
			render(req, res, next, 'login_failed', {
				reason: 'Falsches Passwort.',
				email: email,
				focus_password: true,
			});
			return;
		}

		const session_timeout = 400 * 24 * 60 * 60 * 1000;
		const session = {
			key: utils.gen_token(),
			user_email: u.email,
			until: Date.now() + session_timeout,
		};
		req.app.db.sessions.insert(session);
		res.cookie('krotoncheck_session', session.key, {maxAge: session_timeout, httpOnly: true, secure: req.secure});
		res.redirect(res.app.root_path);
	});
}

function me_handler(req, res, next) {
	render(req, res, next, 'user_me', {});
}

function logout_handler(req, res) {
	if (req.cookies.krotoncheck_session) {
		req.app.db.sessions.remove({key: req.cookies.krotoncheck_session});
	}
	res.redirect(req.app.root_path);
}

function need_permission(permission, handler) {
	return function(req, res, next) {
		if (! req.krotoncheck_user) {
			return next(new Error('Benutzer nicht eingeloggt.'));
		}

		if (permission !== 'any') {
			if (req.krotoncheck_user.permissions.indexOf(permission) < 0) {
				return next(new Error('Nicht genügend Rechte.'));
			}
		}

		return handler(req, res, next);
	};
}

function has_permission(req, permission) {
	return user_has_permission(req.krotoncheck_user, permission);
}

function user_has_permission(user, permission) {
	return user && (user.permissions.indexOf(permission) >= 0);
}

function change_password_handler(req, res, next) {
	if (req.body.new_password1 != req.body.new_password2) {
		return next(new Error('Neue Passwörter sind nicht identisch'));
	}

	if (! bcrypt.compareSync(req.body.old_password, req.krotoncheck_user.password)) {
		return next(new Error('Falsches Passwort'));
	}
	req.app.db.users.update(
		{email: req.krotoncheck_user.email},
		{'$set': {password: hash_password(req.body.new_password1)}},
		function(err) {
			if (err) {
				return next(err);
			}
			res.redirect(req.app.root_path);
		}
	);
}

// cb is called with (err, user). user may be null (not logged in)
function get_user_by_session(db, session_key, cb) {
	db.sessions.findOne({key: session_key}, function(err, session) {
		if (! session_key) {
			return cb(null, null);
		}

		if (err) {
			return cb(err);
		}

		if (session && Date.now() < session.until) {
			db.users.findOne({email: session.user_email}, function(err, u) {
				if (err) {
					return cb(err);
				}

				if (!u) {
					return cb(new Error('Benutzer kann nicht gefunden werden.'));
				}

				return cb(null, u);
			});
		} else {
			return cb(null, null);
		}
	});
}

function middleware(req, res, next) {
	req.krotoncheck_has_permission = function(permission) {
		return has_permission(req, permission);
	};

	get_user_by_session(req.app.db, req.cookies.krotoncheck_session, function(err, user) {
		if (err) {
			return next(err);
		}
		req.krotoncheck_user = user;
		return next();
	});
}

module.exports = {
	create,
	create_handler,
	create_dialog_handler,
	login_handler,
	me_handler,
	logout_handler,
	change_password_handler,
	has_permission,
	user_has_permission,
	middleware,
	need_permission,
	get_user_by_session: get_user_by_session,
};