'use strict';

const assert = require('assert');

const data_access = require('./data_access');


const EVENT_RE = /^(O19|U(?:09|11|13|15|17|19))-(?:RL|OL|(?:S1|S2|N1|N2)-(KK|KL|BK|BL|LL|VL|Mini))$/;


// Implement JSpO §15. Returns a sortable 2-tuple
function _parse_youth_team(team, event_m) {
	const m = /^([SJM])([0-9]+)$/.exec(team.number);
	assert(m);
	const team_num = data_access.parse_int(m[2]);
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
		return (data_access.parse_int(registered_in.number) > data_access.parse_int(played_in.number));
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

module.exports = {
	is_backup,
	is_doubles,
};
