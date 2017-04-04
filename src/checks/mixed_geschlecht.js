'use strict';

const data_utils = require('../data_utils');


function* check_gender(data, pm, team_idx, player_idx, expected) {
	const player_id = pm['team' + team_idx + 'spieler' + player_idx + 'spielerid'];
	if (! player_id) {
		// No player at all, checked in a separate check
		return;
	}
	const p = data.get_player(player_id);
	if (p.sex === expected) {
		return;
	}

	const tm = data.get_teammatch(pm.teammatchid);
	const team_name = tm['team' + team_idx + 'name'];
	yield {
		teammatch_id: pm.teammatchid,
		match_id: pm.matchid,
		message: (
			'Der ' + player_idx + '. Spieler im Mixed von ' + team_name + 
			' (' + data_utils.player_name(p) + ') sollte ' +
			((expected === 'M') ? 'ein Herr' : 'eine Dame') + ' sein - Spieler vertauscht?'),
	};
}


module.exports = function*(season) {
	const data = season.data;

	for (const pm of data.active_playermatches) {
		if (pm.disziplin !== 'GD') continue;

		yield* check_gender(data, pm, 1, 1, 'M');
		yield* check_gender(data, pm, 1, 2, 'F');
		yield* check_gender(data, pm, 2, 1, 'M');
		yield* check_gender(data, pm, 2, 2, 'F');
	}
};