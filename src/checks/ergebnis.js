'use strict';

const calc = require('../calc');
const data_utils = require('../data_utils');


function* check_match(data, pm) {
	if (pm.setcount === 0) {
		// Nothing happened so far
		return;
	}

	if (pm.flag_aufgabe_team1 || pm.flag_aufgabe_team2) {
		// Handled in check "aufgabe"
		return;
	}

	const mw = calc.match_winner(pm);
	if ([1, 2].includes(mw)) {
		return; // match finished naturally
	}

	const score = [];
	for (let i = 1;i <= pm.setcount;i++) {
		score.push(pm[`set${i}team1`] + '-' + pm[`set${i}team2`]);
	}

	const msg = 'Spiel nicht abgeschlossen (Stand ' + score.join(' ') + ')';
	yield {
		teammatch_id: pm.teammatchid,
		match_id: pm.matchid,
		message: msg,
	};
}

module.exports = function*(season) {
	const data = season.data;

	for (const pm of season.data.played_playermatches) {
		yield* check_match(data, pm);
	}
};
