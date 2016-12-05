'use strict';

var utils = require('../utils');

function has_late_note(data, tm) {
	return !! data.get_stb_note(tm.matchid, ntext => /.*F04-[0-9]{1,5}-/.test(ntext));
}

function* check_tm(data, now, tm) {
	const GRACE_TIME_BEFORE = 15 * 60000; // Some teams enter their line-up before the start
	const REPORT_TEAM_RLOL = 6 * 60 * 60000;

	if (tm.flag_ok_gegen_team1 || tm.flag_ok_gegen_team2) {
		return; // Not played at all
	}

	const played = utils.parse_date(tm.spieldatum);

	const team_entered = tm.mannschaftsergebnis_eintragedatum ? utils.parse_date(tm.mannschaftsergebnis_eintragedatum) : null;
	const entered = tm.detailergebnis_eintragedatum ? utils.parse_date(tm.detailergebnis_eintragedatum) : null;
	const first_entered = team_entered ? team_entered : entered;
	if (team_entered !== null) {
		if (team_entered < played) {
			const message = (
				'Mannschaftsergebnis vor Spieldatum eingetragen ' +
				'(' + tm.mannschaftsergebnis_eintragedatum +
				' vor ' + tm.spieldatum + ')' +
				' - nicht eingetragene Vorverlegung?');
			yield {
				teammatch_id: tm.matchid,
				message: message,
			};
		}
	}
	if (entered !== null) {
		if (entered < played - GRACE_TIME_BEFORE) {
			const message = (
				'Detailergebnis vor Spieldatum eingetragen ' +
				'(' + tm.detailergebnis_eintragedatum +
				' vor ' + tm.spieldatum + ')' +
				' - nicht eingetragene Vorverlegung?');
			yield {
				teammatch_id: tm.matchid,
				message: message,
			};
		}
	}

	if (has_late_note(data, tm)) {
		return;
	}

	if (tm.mannschaftsergebnis_user.endsWith('(A)')) {
		// Changed by admin
		return;
	}

	const is_olrl = /^01-00[123]$/.test(tm.staffelcode);
	if (is_olrl) {
		if (first_entered) {
			if (played + REPORT_TEAM_RLOL < team_entered) {
				const message = (
					'Mannschaftsergebnis zu spät eingetragen: ' +
					'Spiel um ' + tm.spieldatum + ', ' +
					'aber erst eingetragen um ' + utils.ts2destr(first_entered) +
					' (vgl. §4.1 Anlage 6 SpO)');
				yield {
					teammatch_id: tm.matchid,
					message: message,
				};
			}
		} else {
			if (played + REPORT_TEAM_RLOL < now) {
				const message = (
					'Mannschaftsergebnis zu spät eingetragen: ' +
					'Spiel um ' + tm.spieldatum + ', ' +
					'aber immer noch nicht eingetragen um ' + utils.ts2destr(now) +
					' (vgl. §4.1 Anlage 6 SpO)');
				yield {
					teammatch_id: tm.matchid,
					message: message,
				};
			}
		}
	}

	const report_until = (
		[5, 6].includes(utils.weekday(played)) ?
		utils.monday_1200(played)
		: (played + 48 * 3600000));
	if (entered) {
		if (report_until < team_entered) {
			const message = (
				'Detailergebnis zu spät eingetragen: ' +
				'Spiel am ' + utils.weekday_destr(played) + ', ' + tm.spieldatum + ', ' +
				'aber erst eingetragen am ' + utils.weekday_destr(first_entered) + ', ' + utils.ts2destr(first_entered));
			yield {
				teammatch_id: tm.matchid,
				message: message,
			};
		}
	} else {
		/*
		TODO: check that match has not been cancelled etc.
		if (report_until < now) {
			const message = (
				'Detailergebnis zu spät eingetragen: ' +
				'Spiel um ' + utils.weekday_destr(played) + ', ' + tm.spieldatum + ', ' +
				'aber immer noch nicht eingetragen um ' + utils.ts2destr(now) +
				' (Nachverlegung vergessen?)');
			yield {
				teammatch_id: tm.matchid,
				message: message,
			};
		}
		*/
	}
}

module.exports = function*(season, data) {
	for (const tm of data.teammatches) {
		yield* check_tm(data, season.check_now, tm);
	}
};