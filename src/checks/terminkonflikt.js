'use strict';

const assert = require('assert');

const utils = require('../utils');
const data_utils = require('../data_utils');


function* check_conflicts(data, team_id, sorted_teammatches) {
	for (let i = 0;i < sorted_teammatches.length - 1;i++) {
		const tm1 = sorted_teammatches[i];
		const tm2 = sorted_teammatches[i + 1];
		assert(tm1.ts <= tm2.ts);
		if (tm1.ts + 3 * utils.HOUR <= tm2.ts) {
			continue;
		}

		const teams = [
			data.get_team(tm1.team1id),
			data.get_team(tm1.team2id),
			data.get_team(tm2.team1id),
			data.get_team(tm2.team2id),
		];
		const clubcodes = teams.map(team => team.clubcode);
		if ((new Set(clubcodes)).size === 1) {
			// All teams belong to the same club
			continue;
		}

		const message = (
			'Terminkonflikt zwischen ' +
			data_utils.tm_str(tm1) + '(' + utils.ts2destr(tm1.ts) + ') und ' +
			data_utils.tm_str(tm2) + '(' + utils.ts2destr(tm2.ts) + ')'
		);
		// Report for both
		yield {
			teammatch_id: tm1.matchid,
			teammatch2_id: tm2.matchid,
			message,
		};
		yield {
			teammatch_id: tm2.matchid,
			teammatch2_id: tm1.matchid,
			message,
		};
	}
}


module.exports = function*(season) {
	const data = season.data;

	for (const [team_id, sorted_teammatches] of data.get_all_team_teammatches()) {
		yield* check_conflicts(data, team_id, sorted_teammatches);
	}
};
