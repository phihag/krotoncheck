'use strict';

const async = require('async');
const nodemailer = require('nodemailer');

const render = require('./render');

function filter_receiver(colors, receiver) {
	// TODO filter by receiver specification
	return colors;
}

function craft_emails(season, colors, message, callback) {
	async.map(
		season.receivers,
		(r, cb) => craft_single_email(season, colors, r, message, cb),
		callback);
}

function craft_single_email(season, colors, receiver, message, cb) {
	const rcolors = filter_receiver(colors, receiver);
	
	const data = {
		season,
		color: rcolors,
		receiver,
		message,
	};

	const body_html = render.render_standalone('mail_basic', data, function(err, body_html) {
		if (err) return cb(err);

		const res = {
			subject: 'Kroton-Report',
			to: receiver.email,
			body_html: body_html,
			html: 'TODO: wrap body',
		};
		cb(null, res);
	});
}

function sendall(config, crafted, cb) {
	const transporter = nodemailer.createTransport(config.smtp);
	for (m of crafted) {
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