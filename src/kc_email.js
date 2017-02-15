'use strict';

const async = require('async');
const nodemailer = require('nodemailer');

const render = require('./render');
const problems = require('./problems');


function filter_receiver(problems_struct, receiver) {
	const res = Object.assign({}, problems_struct);
	res.found = problems_struct.found.filter(function(problem) {
		if (problem.ignored) {
			return false;
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

function craft_emails(season, problems_struct, message, callback) {
	async.map(
		season.receivers,
		(r, cb) => craft_single_email(season, problems_struct, r, message, cb),
		callback);
}

function craft_single_email(season, problems_struct, receiver, message, cb) {
	const important_problems_struct = filter_receiver(problems_struct, receiver);
	const colors = problems.color_render(important_problems_struct);	

	const data = {
		season,
		colors,
		receiver,
		message,
	};

	render.render_standalone('mail_basic', data, function(err, body_html) {
		if (err) return cb(err);

		const res = {
			subject: 'Kroton-Report',
			to: receiver.email,
			body_html,
			html: 'TODO: wrap body',
			empty: (important_problems_struct.found.length === 0),
		};
		cb(null, res);
	});
}

function sendall(config, crafted, cb) {
	const transporter = nodemailer.createTransport(config.smtp);
	for (const c of crafted) {
		const mailOptions = {
			from: config.mail_from,
			to: c.to,
			subject: c.subject,
			text: 'TODO: plain text version',
			html: c.html,
		};

		transporter.sendMail(mailOptions, (error, info) => {
			if (error) {
				return console.log(error);
			}
			// TODO give actual feedback
			console.log('Message %s sent: %s', info.messageId, info.response);
		});
	}
}

module.exports = {
	craft_emails,
};