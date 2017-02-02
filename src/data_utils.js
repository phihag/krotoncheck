'use strict';


function parse_bool(val) {
	if ((val === 'true') || (val === 'True')) {
		return true;
	} else if ((val === 'false') || (val === 'False')) {
		return false;
	} else {
		throw new Error('Invalid boolean value ' + JSON.stringify(val));
	}
}

function team2num(team) {
	const m = /^([JSM]?)([0-9]+)$/.exec(team.number);
	if (!m) {
		throw new Error('Cannot parse number ' + team.number);
	}
	return ({
		'': 0,
		'J': 1000,
		'S': 2000,
		'M': 3000,
	}[m[1]] + parseInt(m[2]));
}

function teamid2clubid(team_id) {
	const m = /^(01-[0-9]+)-[MSJ]?[0-9]+$/.exec(team_id);
	if (!m) {
		throw new Error('Cannot parse team id ' + team_id);
	}
	return m[1];
}

function parse_int(s) {
	let res = parseInt(s, 10);
	if (isNaN(s)) {
		throw new Error('Failed to parse integer from ' + JSON.stringify(s));
	}
	return res;
}

function o19_is_regular(p) {
	// Nichtstammspieler
	if (p.vkz1 === 'N') {
		return false;
	}
	// Jugendspieler
	if ((p.vkz1 === 'J1') || (p.vkz1 === 'S1') || (p.vkz1 === 'M1')) {
		return false;
	}
	return true;
}

// Returns a 2-element array of all matches, sorted by whether they are in the first or second round (=half series)
function matches_by_round(matches) {
	const rounds = [[], []];
	for (const tm of matches) {
		rounds[(tm.runde === 'H') ? 0 : 1].push(tm);
	}
	return rounds;
}

function tm_str(tm) {
	return tm.hrt ? (tm.team2name + ' - ' + tm.team1name) : (tm.team1name + ' - ' + tm.team2name);
}

function league_type(staffelcode) {
	if (/^01-[0-9]+$/.test(staffelcode)) {
		return 'O19';
	}
	if (/^01-[JS][0-9]+$/.test(staffelcode)) {
		return 'U19';
	}
	if (/^01-M[0-9]+$/.test(staffelcode)) {
		return 'Mini';
	}
	if (/^00-BL1|00-B2N|00-B2S$/.test(staffelcode)) {
		return 'Bundesliga';
	}
	throw new Error('Unknown league code ' + JSON.stringify(staffelcode));
}

module.exports = {
	league_type,
	matches_by_round,
	o19_is_regular,
	parse_bool,
	parse_int,
	team2num,
	teamid2clubid,
	tm_str,
};
