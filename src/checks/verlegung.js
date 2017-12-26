'use strict';

const utils = require('../utils');

const DATE_RE = utils.multilineRegExp([
	/([0-9]{1,2}\.\s*(?:Januar|Februar|März|April|Mai|Juni|Juli|August|September|Oktober|November|Dezember|[0-9]{1,2})\.\s*[0-9]{4})/,
]);

function* check(data, tm) {
	const all_notes = data.get_all_notes(tm.matchid);
	if (!all_notes) {
		return;
	}

	const comments = all_notes.filter(c => (c['Comment type'] === 'Spielkommentar'));
	const verlegt_comments = comments.filter(c => DATE_RE.test(c.nachricht));
	if (verlegt_comments.length === 0) {
		return;
	}

	const newest_comment = verlegt_comments[verlegt_comments.length - 1];
	const DISABLED = true;
	if (DISABLED) {
		return;
	}
	yield newest_comment;
	// TODO check for comments
	//console.error(newest_comment);
}


module.exports = function*(season) {
	for (const tm of season.data.active_teammatches) {
		yield* check(season.data, tm);
	}
};