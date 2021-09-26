'use strict';

const assert = require('assert');

const utils = require('../utils');
const data_utils = require('../data_utils');


function* check_conflicts(data, team_id, sorted_teammatches) {
	for (let i = 0;i < sorted_teammatches.length - 1;i++) {
		const tm1 = sorted_teammatches[i];
		const tm2 = sorted_teammatches[i + 1];
		if (!tm1.ts || !tm2.ts) {
			continue;
		}
		assert(tm1.ts <= tm2.ts);
		if (tm1.ts + 5 * utils.HOUR < tm2.ts) {
			continue;
		}

		const teams = [
			data.get_team(tm1.team1id),
			data.get_team(tm1.team2id),
			data.get_team(tm2.team1id),
			data.get_team(tm2.team2id),
		];

		if (teams.some(t => t.Status === 'Mannschaftsrückzug')) {
			// Team was retracted
			continue;
		}

		const clubcodes = teams.map(team => team.clubcode);
		if ((new Set(clubcodes)).size === 1) {
			// All teams belong to the same club
			continue;
		}

		const home1 = tm1.hrt ? tm1.team2id : tm1.team1id;
		const home2 = tm2.hrt ? tm2.team2id : tm2.team1id;
		if ((home1 === home2) && ((tm2.ts - tm1.ts) >= 2.5 * utils.HOUR)) {
			// Same home teams, 2.5+ hours difference
			continue;
		}

		const message1 = (
			'Terminkonflikt zwischen ' +
			data_utils.tm_str(tm1) + '(' + utils.ts2destr(tm1.ts) + ') und ' +
			data_utils.tm_str(tm2) + '(' + utils.ts2destr(tm2.ts) + ')'
		);
		yield {
			teammatch_id: tm1.matchid,
			teammatch2_id: tm2.matchid,
			message: message1,
		};

		const message2 = (
			'Terminkonflikt zwischen ' +
			data_utils.tm_str(tm2) + '(' + utils.ts2destr(tm2.ts) + ') und ' +
			data_utils.tm_str(tm1) + '(' + utils.ts2destr(tm1.ts) + ')'
		);
		yield {
			teammatch_id: tm2.matchid,
			teammatch2_id: tm1.matchid,
			message: message2,
		};
	}
}


module.exports = function*(season) {
	const data = season.data;

	for (const [team_id, sorted_teammatches] of data.get_all_team_teammatches()) {
		yield* check_conflicts(data, team_id, sorted_teammatches);
	}
};
