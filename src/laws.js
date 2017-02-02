'use strict';

const assert = require('assert');

const data_utils = require('./data_utils');


const EVENT_RE = /^(O19|U(?:09|11|13|15|17|19))-(?:RL|OL|(?:S1|S2|N1|N2)-(KK|KL|BK|BL|LL|VL|Mini))$/;


// Implement JSpO §15. Returns a sortable 2-tuple
function _parse_youth_team(team, event_m) {
	const m = /^([SJM])([0-9]+)$/.exec(team.number);
	assert(m);
	const team_num = data_utils.parse_int(m[2]);
	if (m[1] === 'J') {
		assert(event_m[1] === 'U19');
		return [1, team_num];
	}

	if (m[1] === 'M') {
		const age_idx = {
			'U19': 2,
			'U17': 3,
			'U15': 5,
			'U13': 6,
			'U11': 7,
			'U09': 8,
		}[event_m[1]];
		assert(age_idx);
		return [age_idx, team_num];
	}

	if (m[1] === 'S') {
		assert(event_m[1] === 'U15');
		return [4, team_num];
	}

	assert(false);
}


// Returns true if player is serving as backup (i.e. from a lower-ranked team), false otherwise
// registred_in and played_in are the respective teams
function is_backup(registered_in, played_in) {
	const played_m = EVENT_RE.exec(played_in.eventname);
	if (!played_m) {
		throw new Error('Cannot parse played_in event ' + played_in.eventname);
	}
	const registered_m = EVENT_RE.exec(registered_in.eventname);
	if (!registered_m) {
		throw new Error('Cannot parse registered_in event ' + registered_in.eventname);
	}

	if (played_m[1] === 'O19') {
		assert(registered_m[1] === 'O19');
		return (data_utils.parse_int(registered_in.number) > data_utils.parse_int(played_in.number));
	}

	const [played_age_idx, played_team_idx] = _parse_youth_team(played_in, played_m);
	const [registered_age_idx, registered_team_idx] = _parse_youth_team(registered_in, registered_m);

	return (
		(registered_age_idx > played_age_idx) ||
		((registered_age_idx === played_age_idx) && (registered_team_idx > played_team_idx)));
}

function is_doubles(discipline) {
	switch (discipline) {
	case 'HD':
	case 'DD':
	case 'GD':
	case 'Doppel':
		return true;
	case 'HE':
	case 'DE':
	case 'Einzel':
		return false;
	default:
		throw new Error('Unknown discipline ' + JSON.stringify(discipline));
	}
}

function get_vrl_type(league_type, tm, sex) {
	if (! /^[HR]$/.test(tm.runde)) {
		throw new Error('Ungültige Runde ' + tm.runde);
	}
	const is_hr = (tm.runde === 'H');
	assert(['M', 'F'].includes(sex));
	const is_m = (sex === 'M');

	if (league_type === 'O19') {
		if (is_m) {
			return is_hr ? 9 : 11;
		} else {
			return is_hr ? 10 : 12;
		}
	} else if (league_type == 'Mini') {
		return is_hr ? 17 : 18;
	} else if (league_type == 'U19') {
		if (is_m) {
			return is_hr ? 17 : 18;
		} else {
			return is_hr ? 14 : 16;
		}
	} else {
		throw new Error('Unsupported league type ' + league_type);
	}
}

function forced_retreat(data, team_id) {
	const tms = data.get_teammatches_by_team_id(team_id);
	if (!tms) {
		return null; // No matches, so we don't know, but likely very early!?
	}
	let strikes = 0;
	for (const tm of tms) {
		if ((tm.flag_ok_gegen_team1 && (tm.team1id === team_id)) || (tm.flag_ok_gegen_team2 && (tm.team2id === team_id))) {
			strikes++;
			if (strikes === 3) {
				return tm;
			}
		}
	}
	return null;
}

module.exports = {
	forced_retreat,
	get_vrl_type,
	is_backup,
	is_doubles,
};
