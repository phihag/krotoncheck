'use strict';
// 2 teams of one club in the same group

const data_utils = require('../data_utils');
const utils = require('../utils');

function parse_eligible_groups(season) {
	if (! season.qualifying_youth_groups) {
		return [];
	}

	const lines = season.qualifying_youth_groups.split(/\n/g);
	const trimmed_lines = lines.map(s => (
		s.replace(/#.*$/, '')
		.replace(/^.*:/, '')
		.trim()
	)).filter(s => s);
	const csv = trimmed_lines.join(',');
	return csv.split(',');
}

function* get_double_teams(season) {
	const eligible_groups = parse_eligible_groups(season);

	const groups = new Map(); // Contents: Map clubCode -> array of teams
	for (const team of season.data.teams) {
		if (team.Status === 'Mannschaftsrückzug') {
			continue; // Team retracted, does not matter
		}
		const gid = team.DrawID;
		if (!gid) {
			continue; // Team without draw: data error, ignore
		}
		const ltype = data_utils.league_type(gid);
		if (['U19', 'Mini'].includes(ltype)) {
			const short_gid_m = /^01-([JSM](?:[0-9]+))$/.exec(gid);
			const short_gid = short_gid_m ? short_gid_m[1] : null;

			if (!eligible_groups.includes(gid) && !eligible_groups.includes(short_gid)) {
				continue; // Do not check youth teams unless they offer qualification for BMM/WDMM (§35.6)
			}
		}

		let g = groups.get(gid);
		if (!g) {
			g = new Map();
			groups.set(gid, g);
		}

		let by_club = g.get(team.clubcode);
		if (!by_club) {
			by_club = [];
			g.set(team.clubcode, by_club);
		}

		by_club.push(team);
	}

	for (const g of groups.values()) {
		for (const teams of g.values()) {
			if (teams.length === 1) {
				continue;
			}

			yield* teams;
		}
	}
}

function* check_team(data, team) {
	const all_matches = data.get_teammatches_by_team_id(team.code);
	if (! all_matches) {
		return; // Bundesliga team?
	}
	const rounds = data_utils.matches_by_round(all_matches);
	for (const matches of rounds) {
		let played_other = null;

		for (const tm of matches) {
			const other_team_id = (tm.team1id === team.code) ? tm.team2id : tm.team1id;
			const other_team = data.get_team(other_team_id);

			if (other_team.clubcode === team.clubcode) {
				if (played_other) {
					const message = (
						'Zwei Mannschaften eines Vereins sollten immer zuerst gegeneinander spielen (§35.5 SpO). ' +
						data_utils.tm_str(tm) + ' wird erst am ' + utils.ts2destr(tm.ts) + ' gespielt, nach ' +
						data_utils.tm_str(played_other) + ' am ' + utils.ts2destr(played_other.ts) + '.'
					);
					yield {
						teammatch_id: tm.matchid,
						teammatch2_id: played_other.matchid,
						message,
					};
					continue; // Do not report any more for this round
				}
			} else if (!played_other) {
				played_other = tm;
			}
		}
	}
}

module.exports = function*(season) {
	const double_teams = get_double_teams(season);
	for (const team of double_teams) {
		yield* check_team(season.data, team);
	}
};