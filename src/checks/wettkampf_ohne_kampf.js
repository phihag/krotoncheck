'use strict';

const data_utils = require('../data_utils');

function* check_teammatch(data, tm) {
	if ((!tm.flag_ok_gegen_team1) && (!tm.flag_ok_gegen_team2)) {
		return;
	}

	let pms = data.get_playermatches_by_teammatch_id(tm.matchid);
	var offending = [];
	for (let pm of pms) {
		if (pm.team1spieler1spielerid || pm.team2spieler1spielerid) {
			offending.push(data_utils.match_name(pm));
		}
	}

	if (offending.length > 0) {
		yield {
			teammatch_id: tm.matchid,
			message: 'Wettkampf ohne Kampf, aber Spieler in ' + offending.join(', '),
		};
	}
}


module.exports = function*(season) {
	const data = season.data;
	for (let tm of data.teammatches) {
		yield* check_teammatch(data, tm);
	}
};