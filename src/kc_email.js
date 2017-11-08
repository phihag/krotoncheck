'use strict';

const async = require('async');
const nodemailer = require('nodemailer');
const html_entities = require('html-entities');


const loader = require('./loader');
const render = require('./render');
const problems = require('./problems');


function filter_receiver(problems_struct, receiver) {
	const res = Object.assign({}, problems_struct);
	res.found = problems_struct.found.filter(function(problem) {
		if (problem.ignored) {
			return false;
		}

		if (receiver.colors_filter) {
			if (!receiver.colors_filter.includes(problem.color)) {
				return false;
			}
		}

		if (receiver.stb_filter) {
			if (! problem.stb) {
				return false;
			}
			const stb_name = problem.stb.firstname + ' ' + problem.stb.lastname;
			if (!stb_name.includes(receiver.stb_filter)) {
				return false;
			}
		}

		if (receiver.region_filter) {
			if (!problem.region) {
				return false;
			}

			if (! problem.region.includes(receiver.region_filter)) {
				return false;
			}
		}

		return true;
	});
	return res;
}

function stb_receivers(season, callback) {
	loader.load_season_table(season, 'users', (err, user_table) => {
		if (err) return callback(err);

		const got = new Set();
		const receivers = [];
		for (const u of user_table) {
			if (u.rolename !== 'Staffelbetreuer') continue;
			if (got.has(u.email)) continue;

			got.add(u.email);
			
			receivers.push({
				stb_filter: u.firstname + ' ' + u.lastname,
				email: u.email,
				colors_filter: ['red', 'yellow'],
			});
		}
		callback(err, receivers);
	});
}

function craft_emails(season, default_receivers, problems_struct, message_top, message_bottom, add_receivers, callback) {
	const receivers = default_receivers.slice();

	function do_craft() {
		async.map(
			receivers,
			(r, cb) => craft_single_email(season, problems_struct, r, message_top, message_bottom, cb),
			callback);
	}

	add_receivers = add_receivers || {};
	if (add_receivers.all_stbs) {
		stb_receivers(season, (err, stb_receivers) => {
			if (err) return callback(err);

			Array.prototype.push.apply(receivers, stb_receivers);
			do_craft();
		});
	} else {
		do_craft();
	}
}

function count_colors(colors) {
	const res = [];
	for (const c of colors) {
		let count = 0;
		for (const r of c.regions) {
			for (const g of r.groups) {
				count += g.problems.length;
			}
		}

		res.push({
			color: c.color,
			count,
			css_color: render.lookup_color(c.color),
		});
	}
	return res;
}

function craft_single_email(season, problems_struct, receiver, message_top, message_bottom, cb) {
	const important_problems_struct = filter_receiver(problems_struct, receiver);
	const colors = problems.color_render(important_problems_struct);	

	const data = {
		season,
		colors,
		receiver,
		message_top,
		message_bottom,
	};

	render.render_standalone('mail_basic', data, function(err, body_html) {
		if (err) return cb(err);

		const res = {
			subject: 'Kroton-Report',
			to: receiver.email,
			body_html,
			empty: (important_problems_struct.found.length === 0),
			color_counts: count_colors(colors),
		};
		render.render_standalone('mail_scaffold', res, function(err, mail_html) {
			if (err) return cb(err);
			res.mail_html = mail_html;

			render.render_standalone('plaintext_basic', data, function(err, rendered_mail_text) {
				if (err) return cb(err);

				const decode = new html_entities.AllHtmlEntities().decode;
				const mail_text = decode(rendered_mail_text);
				res.mail_text = mail_text;
				cb(null, res);
			});
		});
	});
}

function sendall(config, crafted, callback) {
	const smtp_config = config('smtp');
	const transporter = nodemailer.createTransport(smtp_config);
	async.map(crafted, function(c, cb) {
		if (c.empty) {
			return cb();
		}

		const mailOptions = {
			from: config('mail_from'),
			to: c.to,
			subject: c.subject,
			text: c.mail_text,
			html: c.mail_html,
		};

		transporter.sendMail(mailOptions, cb);
	}, callback);
}

module.exports = {
	craft_emails,
	sendall,
};