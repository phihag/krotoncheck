'use strict';

const utils = require('../utils');
const data_utils = require('../data_utils');


function _count_players(players, ts, team) {
	let res = 0;
	for (const p of players) {
		if (p.parsed_enddate && (p.parsed_enddate < ts)) {
			continue;
		}
		if (p.parsed_startdate && (p.parsed_startdate > ts)) {
			continue;
		}

		if (p.parsed_fixed_from && (p.parsed_fixed_from <= ts)) {
			if (p.fixed_in != team.number) {
				continue;
			}
		} else {
			if (p.teamcode != team.code) {
				continue;
			}
		}

		res++;
	}
	return res;
}


function* check_enough_players(data, team, vrl_typeid, gender) {
	const min_count = (gender == 'M') ? 4 : 2;
	const entries = data.get_vrl_entries(team.clubcode, vrl_typeid);
	if (!entries) {
		return; // VRL not published yet
	}

	// Collect all players who qualified for this team (directly or via fixed_in)
	const players = entries.filter(p => 
		((team.code == p.teamcode) || (p.fixed_in == team.number)) &&
		data_utils.o19_is_regular(p)
	);

	const dates = [];
	for (const p of players) {
		if (p.parsed_fixed_from) {
			dates.push(p.parsed_fixed_from);
		}
		if (p.parsed_startdate) {
			dates.push(p.parsed_startdate);
		}
		if (p.parsed_enddate) {
			dates.push(p.parsed_enddate);
		}
	}
	let next_days = dates.map(utils.next_day);
	next_days.sort();

	for (const d of next_days) {
		const pcount = _count_players(players, d, team);
		if (pcount < min_count) {
			const message = (
				'Zu wenig (' + pcount + ') Spieler' + ((gender === 'M') ? '' : 'innen') + ' (inkl. Nachrücker)' +
				' im Team (' + team.code + ') ' + team.name +
				' (VRL ' + vrl_typeid + ') ' +
				'am ' + utils.ts2dstr(d)
			);
			yield {
				type: 'vrl',
				clubcode: team.clubcode,
				vrl_typeid: vrl_typeid,
				message: message,
			};
		}
	}
}

module.exports = function*(season) {
	if (data_utils.is_preseason(season)) {
		return;
	}

	const data = season.data;

	for (const team of data.teams) {
		if (! /^O19-(RL|OL)$/.test(team.eventname)) {
			continue;
		}

		if (team.Status === 'Mannschaftsrückzug') {
			continue;
		}

		yield* check_enough_players(data, team, 9, 'M');
		yield* check_enough_players(data, team, 10, 'F');
		yield* check_enough_players(data, team, 11, 'M');
		yield* check_enough_players(data, team, 12, 'F');
	}
};