'use strict';

var utils = require('../utils');


function round_index(vrl_code) {
	switch(vrl_code) {
	case 9:
	case 10:
	case 14:
	case 17:
		return 0;
	case 11:
	case 12:
	case 16:
	case 18:
		return 1;
	default:
		throw new Error('Unknown VRL code ' + vrl_code);
	}
}

// Returns two Maps of player_code => array of club codes
// players who played for multiple clubs, for HR and RR
function calc_multclubs(data) {
	const rounds = [
		new Map(),
		new Map(),
	];
	function _add_player(round, player_id, club_id) {
		if (! player_id) return;

		let current = round.get(player_id);
		if (!current) {
			current = new Set(),
			round.set(player_id, current);
		}
		current.add(club_id);
	}

	for (const line of data.clubranking) {
		const round = rounds[round_index(line.typeid)];
		_add_player(round, line.memberid, line.clubcode);
	}

	const multis = [
		new Map(),
		new Map(),
	];
	for (const [r, m] of utils.zip(rounds, multis)) {
		for (const [pcode, clubs] of r) {
			if (clubs.size === 1) continue;

			const club_ar = Array.from(clubs);
			club_ar.sort();
			m.set(pcode, club_ar);
		}
	}

	return multis;
}


module.exports = function*(season) {
	const data = season.data;
	const multis = calc_multclubs(data);

	for (const [round_idx, m] of multis.entries()) {
		for (const [pcode, clubs] of m) {
			const player = data.get_player(pcode);
			const clubs_str = clubs.map(function(clubcode) {
				const club = data.get_club(clubcode);
				return '(' + clubcode +') ' + club.name;
			}).join(', ');
			const message = (
				((player.sex === 'M') ? 'Spieler' : 'Spielerin') + ' ' +
				data.player_str(player) + ' ' +
				'spielt in der ' + ((round_idx === 0) ? 'Hinrunde' : 'Rückrunde') + ' ' +
				'für mehr als einen Verein: ' +
				clubs_str
			);
			yield {
				type: 'vrl',
				clubcode: player.clubid,
				message,
			};
		}
	}
};