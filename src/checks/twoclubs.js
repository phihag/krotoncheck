'use strict';

const utils = require('../utils');
const data_utils = require('../data_utils');


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
	function _add_player(round, player_id, club_id, vrl_typeid) {
		if (! player_id) return;

		let current = round.get(player_id);
		if (!current) {
			current = [];
			round.set(player_id, current);
		}
		if (!current.find(e => e.club_id === club_id)) {
			current.push({
				club_id,
				vrl_typeid,
			});
		}
	}

	for (const line of data.clubranking) {
		const round = rounds[round_index(line.typeid)];
		_add_player(round, line.memberid, line.clubcode, line.typeid);
	}

	const multis = [
		new Map(),
		new Map(),
	];
	for (const [r, m] of utils.zip(rounds, multis)) {
		for (const [pcode, club_entries] of r) {
			if (club_entries.length === 1) continue;

			club_entries.sort(utils.cmp_key('club_id'));
			m.set(pcode, club_entries);
		}
	}

	return multis;
}

module.exports = function*(season) {
	const data = season.data;
	const multis = calc_multclubs(data);

	for (const [round_idx, m] of multis.entries()) {
		for (const [pcode, club_entries] of m) {
			const player = data.get_player(pcode);
			const clubs_str = club_entries.map(function(ce) {
				const club = data.get_club(ce.club_id);
				return '(' + ce.club_id +') ' + club.name;
			}).join(', ');
			const message = (
				((player.sex === 'M') ? 'Spieler' : 'Spielerin') + ' ' +
				data_utils.player_str(player) + ' ' +
				'spielt in der ' + ((round_idx === 0) ? 'Hinrunde' : 'Rückrunde') + ' ' +
				'für mehr als einen Verein: ' +
				clubs_str
			);

			for (const ce of club_entries) {
				yield {
					type: 'vrl',
					clubcode: ce.club_id,
					vrl_typeid: ce.vrl_typeid,
					player_id: pcode,
					message,
				};
			}
		}
	}
};