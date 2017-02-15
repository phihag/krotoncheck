'use strict';

const DISABLED = true;
const utils = require('../utils');


function location_changed(season, tm_id) {
	const logs = season.data.get_matchlog(tm_id);
	return utils.find_last(logs, l => (l.aktion === 'Spielort geändert'));
}

function remove_crap(s) {
	if (s.length < 3) {
		return false; // too short
	}
	if (['Straße', 'Str', 'SpH', 'Sporthalle', 'Halle', 'Weg', 'Schule', 'über'].includes(s)) {
		return false; // too generic
	}

	return true;
}

function gather_keywords(loc) {
	const all_str = loc.contact + ' ' + loc.address + ' ' + loc.extrainfo;
	return all_str.split(/[\s,._-]/).filter(remove_crap);
}

function matching_comment(comments, keywords) {
	return comments.some(
		comment => keywords.some(kw => comment.nachricht.includes(kw))
	);
}

module.exports = function*(season) {
	if (DISABLED) {
		return;
	}

	const data = season.data;

	for (const tm of data.teammatches) {
		const change_line = location_changed(season, tm.matchid);
		if (! change_line) {
			continue;
		}

		const loc = data.get_location(tm.spielortid);
		const keywords = gather_keywords(loc);

		const comments = data.get_comments(tm.matchid);
		if (comments.length === 0) {
			const message = (
				'Am ' + change_line.zeitpunkt + ' wurde der Spielort ' +
				' auf ' + loc.name + ' geändert, aber kein Kommentar dazu geschrieben'
			);
			yield {
				teammatch_id: tm.matchid,
				message,
			};
			continue;
		}

		if (! matching_comment(comments, keywords)) {
			const message = (
				'Am ' + change_line.zeitpunkt + ' wurde der Spielort ' +
				' auf ' + loc.name + ' geändert, aber der zugehörige Kommentar fehlt'
			);
			yield {
				teammatch_id: tm.matchid,
				message,
			};

		}

	}
};
