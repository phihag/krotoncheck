'use strict';

function craft_single_email(season, problem_struct, receiver, message_top, message_bottom, cb) {
	const res = {
		subject: 'Schiedsrichterliste Bundesliga',
		to: receiver.email,
		receiver_class: 'buli_sr',
	};
	console.error(Object.keys(problem_struct));

	// TODO count of matches goes in here
	res.color_counts = [{count: 42, css_color: '#000', css_fg: '#fff'}];

	cb(null, res);
}

function calc(season) {
	// TODO calc umpire table
}

function annotate_umpire_index(season) {
	if (!season.umpires) {
		return;
	}

	// TODO craft umpire list
}

module.exports = {
	annotate_umpire_index,
	calc,
	craft_single_email,
};
