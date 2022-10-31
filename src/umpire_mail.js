'use strict';

function craft_single_email(season, problem_struct, receiver, message_top, message_bottom, cb) {
	const res = {
		subject: 'Schiedsrichterliste Bundesliga',
		to: receiver.email,
		receiver_class: 'buli_sr',
	};
	/*console.error(Object.keys(problem_struct));

	// TODO count of matches goes in here
	res.color_counts = [{count: 42, css_color: '#000', css_fg: '#fff'}];*/

	cb(null, res);
}

function calc(/*season*/) {
	// TODO calc umpire table
}

function annotate_umpire_index(season) {
	if (!season.umpires) {
		return;
	}

	const idx = new Map();
	const duplicates = new Set();

	const _add_umpire = (short, full_name) => {
		if (idx.has(short)) {
			duplicates.add(short);
		}

		idx.set(short, full_name);
	};

	for (const line of season.umpires.split('\n')) {
		const full_name = line.trim();
		if (!full_name) continue;

		const m = /^(([A-ZÄÖÜ])[^\s]+)\s(?:[^\s]+\s)?([^\s]+)$/.exec(full_name);
		if (!m) throw new Error('Cannot parse name of umpire ' + JSON.stringify(full_name));

		const first_name = m[1];
		const initial = m[2];
		const last_name = m[3];

		_add_umpire(full_name, full_name);
		_add_umpire(initial + '. ' + last_name, full_name);
		_add_umpire(initial + ' ' + last_name, full_name);
		_add_umpire(initial + '.' + last_name, full_name);
		_add_umpire(last_name + ', ' + initial, full_name);
		_add_umpire(last_name + ', ' + initial + '.', full_name);
		_add_umpire(last_name + ', ' + first_name, full_name);
		_add_umpire(first_name + '  ' + last_name, full_name);
		_add_umpire(last_name, full_name);
	}

	// Remove all duplicates
	for (const short of duplicates) {
		idx.delete(short);
	}

	season.umpire_index = idx;
}

function parse_names(str) {
	const res = str.split(/(?:\sund\s|;|&|\/|\s-\s)/g).map(s => s.trim());
	if (res.length >= 2) {
		return res;
	}
	return str.split(/,/).map(s => s.trim());
}

module.exports = {
	annotate_umpire_index,
	calc,
	craft_single_email,
	parse_names,
};
