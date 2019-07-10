'use strict';

const async = require('async');
const nodemailer = require('nodemailer');
const html_entities = require('html-entities');


const data_utils = require('./data_utils');
const loader = require('./loader');
const render = require('./render');
const problems = require('./problems');
const utils = require('./utils');
const umpire_mail = require('./umpire_mail');

function determine_u19o19(problem) {
	if (problem.teammatch) {
		const fine_type = data_utils.tm_league_type(problem.teammatch);
		return ['U19', 'Mini'].includes(fine_type) ? 'U19' : 'O19';
	}
	if (problem.vrl_typeid) {
		return data_utils.vrlid_is_o19(problem.vrl_typeid) ? 'O19' : 'U19';
	}
	console.error('unable to determine age group of ' + JSON.stringify(problem));
}


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

		if (receiver.club_filter) {
			if (problem.clubcode !== receiver.club_filter) {
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

		if (receiver.regions_filter) {
			if (!problem.region) {
				return false;
			}

			if (!receiver.regions_filter.some(region => problem.region.includes(region))) {
				return false;
			}
		}

		if (receiver.u19o19) {
			const problem_agegroup = determine_u19o19(problem);
			if (problem_agegroup !== receiver.u19o19) {
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

function club_receivers(season, callback) {
	loader.load_season_table(season, 'users', (err, user_table) => {
		if (err) return callback(err);

		const receivers = [];
		for (const u of user_table) {
			if (u.rolename !== 'Verein') continue;

			receivers.push({
				club_filter: u.externalcode,
				receiver_name: u.lastname,
				email: u.email,
				colors_filter: ['lightgray'],
			});
		}
		callback(err, receivers);
	});
}

function bw_receivers(season, callback) {
	const bw_str = season.bws;
	const lines = bw_str.split('\n');
	const receivers = [];
	for (let line of lines) {
		line = line.trim();
		if (!line) continue;

		const [age_group_str, regions_str, emails_str] = line.split(':');
		if (!emails_str) {
			console.error('Invalid bw_receivers configuration: ' + JSON.stringify(line) + '. Skipping');
			continue;
		}
		const regions_filter = regions_str.split('+').map(s => s.trim()).filter(s => s);
		const emails = emails_str.split(' ').map(s => s.trim()).filter(s => s);
		for (const email of emails) {
			receivers.push({
				email,
				regions_filter,
				regions_filter_present: true,
				u19o19: (age_group_str ? age_group_str.trim() : undefined),
			});
		}
	}
	callback(null, receivers);
}

function craft_emails(season, default_receivers, problems_struct, message_top, message_bottom, add_receivers, callback) {
	const tasks = [
		cb => cb(null, default_receivers),
	];
	if (add_receivers) {
		if (add_receivers.all_stbs) {
			tasks.push(cb => stb_receivers(season, cb));
		}
		if (add_receivers.all_bws) {
			tasks.push(cb => bw_receivers(season, cb));
		}
		if (add_receivers.all_clubs) {
			tasks.push(cb => club_receivers(season, cb));
		}
	}

	async.series(tasks, (err, receiver_lists) => {
		if (err) return callback(err);

		const receivers = [].concat(...receiver_lists);

		async.map(
			receivers,
			(r, cb) => {
				if (r.mtype === 'buli_sr') {
					umpire_mail.craft_single_email(season, problems_struct, r, message_top, message_bottom, cb);
				} else {
					craft_single_email(season, problems_struct, r, message_top, message_bottom, cb);
				}
			},
			callback);
	});
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

		const receiver_class = (receiver.stb_filter ? 'StB' : (
			receiver.regions_filter ? (
				(receiver.u19o19 === 'U19') ? 'BJW' : 'BW'
			) : ''
		));

		const res = {
			subject: 'turnier.de-Report',
			to: receiver.email,
			body_html,
			empty: (important_problems_struct.found.length === 0),
			color_counts: count_colors(colors),
			receiver_class,
		};
		if (receiver.receiver_name) {
			res.receiver_name = receiver.receiver_name;
		}
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

// Callback gets two arguments: 1. internal error while sending 2. an array of errors
function sendall(config, crafted, callback) {
	const smtp_config = config('smtp');
	const transporter = nodemailer.createTransport(smtp_config);
	const crafted_nonempty = crafted.filter(c => !c.empty);
	const mails = crafted_nonempty.map(c => {
		return {
			from: config('mail_from'),
			to: c.to,
			subject: c.subject,
			text: c.mail_text,
			html: c.mail_html,
		};
	});

	const errors = [];
	const got = mails.map(() => false);

	mails.map((mail, i) => {
		transporter.sendMail(mail, (err) => {
			got[i] = true;
			if (err) {
				errors.push({
					mail,
					err,
				});
			}

			if (utils.all(got)) {
				callback(null, errors);
			}
		});
	});
}

module.exports = {
	craft_emails,
	sendall,
};