'use strict';


function* check_gender(data, pm, tm, team_idx, player_idx, expected) {
	var player_id = pm['team' + team_idx + 'spieler' + player_idx + 'spielerid'];
	if (! player_id) {
		// No player at all, checked in a separate check
		return;
	}
	var p = data.get_player(player_id);
	var team_name = tm['team' + team_idx + 'name'];

	if (p.sex === expected) {
		return;
	}

	yield {
		teammatch_id: pm.teammatchid,
		message: (
			'Der ' + player_idx + '. Spieler im Mixed von ' + team_name + 
			' (' + data.player_name(p) + ') sollte ' +
			((expected === 'M') ? 'ein Herr' : 'eine Dame') + ' sein - Spieler vertauscht?'),
	};
}


module.exports = function*(season, data) {
	for (var pm of data.active_playermatches) {
		if (pm.disziplin !== 'GD') continue;

		let tm = data.get_teammatch(pm.teammatchid);

		yield* check_gender(data, pm, tm, 1, 1, 'M');
		yield* check_gender(data, pm, tm, 1, 2, 'F');
		yield* check_gender(data, pm, tm, 2, 1, 'M');
		yield* check_gender(data, pm, tm, 2, 2, 'F');
	}
};