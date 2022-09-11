'use strict';

const utils = require('../utils');
const data_utils = require('../data_utils');

function has_late_note(data, tm) {
	return !! data.get_stb_note(tm.matchid, ntext => /[fF](?:04|24|38)/.test(ntext));
}

function has_any_note(data, tm) {
	return !! data.get_stb_note(tm.matchid, () => true);
}

function has_stb_comment_after(data, tm, after) {
	const comments = data.get_comments(tm.matchid);
	const stb = data.get_stb(tm);
	if (!stb) {
		return;
	}
	const stb_name = stb.firstname + ' ' + stb.lastname;

	return comments.some(c => {
		if (! c.benutzer.startsWith(stb_name)) {
			return false;
		}
		const comment_date = utils.parse_date(c.zeitpunkt);

		return comment_date >= after;
	});
}

function hide_warning(season) {
	if (season.key !== 'nrw2021') return false;
	return Date.now() < (new Date('2021-10-10T00:00:00+0200')).getTime();
}

function* check_tm(season, tm) {
	const data = season.data;
	const now = season.check_now;
	const GRACE_TIME_BEFORE = 15 * 60000; // Some teams enter their line-up before the start

	const league_type = data_utils.tm_league_type(tm);

	let missing_dates = false;
	if (!tm.datum_verbandsansetzung) {
		if (!hide_warning(season)) {
			yield {
				teammatch_id: tm.matchid,
				message: 'Spiel ohne Verbandsansetzung',
			};
		}
		missing_dates = true;
	}
	if (!tm.spieldatum) {
		if (!hide_warning(season)) {
			yield {
				teammatch_id: tm.matchid,
				message: 'Spiel ohne Spieltermin',
			};
		}
		missing_dates = true;
	}
	if (missing_dates) {
		return;
	}

	const original_ts = utils.parse_date(tm.datum_verbandsansetzung);
	const original_weekday = utils.weekday(original_ts);
	const original_timestr = utils.ts2timestr(original_ts);
	const is_olrl = /^01-00[123]$/.test(tm.staffelcode);
	if (!is_olrl && (league_type === 'O19') && ((original_weekday !== 6) || (original_timestr !== '18:00:00'))) {
		const message = (
			'Verbandsansetzung nicht Samstag 18:00, sondern ' + utils.weekday_destr(original_ts) + ' ' + utils.ts2destr(original_ts) + ' (§45.2a SpO)'
		);
		yield {
			teammatch_id: tm.matchid,
			message,
		};
	} else if (((league_type === 'Mini') || (league_type === 'U19')) && ((original_weekday != 6) || (original_timestr != '15:00:00'))) {
		const message = (
			'Verbandsansetzung nicht Samstag 15:00, sondern ' + utils.weekday_destr(original_ts) + ' ' + utils.ts2destr(original_ts) + ' (§45.2b SpO)'
		);
		yield {
			teammatch_id: tm.matchid,
			message,
		};
	}

	// After last possible day?
	const played = utils.parse_date(tm.spieldatum);
	const lastdate_str = season['lastdate_' + (is_olrl ? 'olrl' : ((league_type === 'O19') ? 'o19' : 'u19'))];
	if (lastdate_str) {
		const lastdate_ts = utils.parse_date(lastdate_str);
		if (utils.ts2timestr(lastdate_ts) !== '00:00:00') {
			if (played > lastdate_ts) {
				const message = (
					'Spiel auf ' + tm.spieldatum + ' verlegt, nach letztem Spieltag ' + utils.ts2destr(lastdate_ts) +
					' (§46.1e SpO)'
				);
				yield {
					teammatch_id: tm.matchid,
					message,
				};
			}
		} else {
			// Entered the day: Within this day?
			if (played >= lastdate_ts + 24 * utils.HOUR) {
				const message = (
					'Spiel auf ' + tm.spieldatum + ' verlegt, nach letztem Spieltag ' + utils.ts2destr(lastdate_ts) +
					' (§46.1e SpO)'
				);
				yield {
					teammatch_id: tm.matchid,
					message,
				};
			} else if ((played > (league_type === 'O19')) && (played > lastdate_ts + 12 * utils.HOUR)) {
				const message = (
					'Spiel auf ' + tm.spieldatum + ' verlegt, nach 12:00 am letztem Spieltag (§46.2c SpO)'
				);
				yield {
					teammatch_id: tm.matchid,
					message,
				};
			}
		}
	}

	// Before season start
	const firstdate_str = season['vrldate_' + ((league_type === 'O19') ? 'o19' : 'u19') + '_hr'];
	if (firstdate_str) {
		const first_ts = utils.parse_date(firstdate_str);
		if (played < first_ts) {
			const message = (
				'Spiel auf ' + tm.spieldatum + ' verlegt, vor der VRL-Prüfung der Hinrunde ' + utils.ts2dstr(first_ts) +
				' (Jahreszahl verwechselt?)'
			);
			yield {
				teammatch_id: tm.matchid,
				message,
			};
		}
	}

	if (tm.flag_ok_gegen_team1 || tm.flag_ok_gegen_team2) {
		return; // Not played at all
	}
	if (tm.flag_umwertung_gegen_beide) {
		return; // Played at invalid date
	}

	const team_entered = tm.mannschaftsergebnis_eintragedatum ? utils.parse_date(tm.mannschaftsergebnis_eintragedatum) : null;
	const entered = tm.detailergebnis_eintragedatum ? utils.parse_date(tm.detailergebnis_eintragedatum) : null;
	if (team_entered !== null) {
		if (team_entered < played) {
			const message = (
				'Mannschaftsergebnis vor Spieldatum eingetragen ' +
				'(' + tm.mannschaftsergebnis_eintragedatum +
				' vor ' + tm.spieldatum + ')' +
				' - nicht eingetragene Vorverlegung?');
			yield {
				teammatch_id: tm.matchid,
				message,
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
				message,
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

	const team1 = data.get_team(tm.team1id);
	const team2 = data.get_team(tm.team2id);
	if (data_utils.is_retracted(team1) || data_utils.is_retracted(team2)) {
		return;
	}

	const report_until = data_utils.reporting_deadline(tm);
	if (is_olrl) {
		if (entered) {
			if (report_until < entered) {
				const message = (
					'Detailergebnis zu spät eingetragen: ' +
					'Spiel um ' + tm.spieldatum + ', ' +
					'aber erst eingetragen um ' + utils.ts2destr(entered) +
					' (vgl. §4.1 Anlage 6 SpO)');
				yield {
					teammatch_id: tm.matchid,
					message,
				};
			}
		} else {
			if (report_until < now) {
				const message = (
					'Detailergebnis zu spät eingetragen: ' +
					'Spiel um ' + tm.spieldatum + ', ' +
					'aber immer noch nicht eingetragen' +
					' (vgl. §4.1 Anlage 6 SpO)');
				yield {
					teammatch_id: tm.matchid,
					message,
				};
			}
		}
	} else {
		if (entered) {
			if (report_until < entered) {
				const message = (
					'Detailergebnis zu spät eingetragen: ' +
					'Spiel am ' + utils.weekday_destr(played) + ', ' + tm.spieldatum + ', ' +
					'aber erst eingetragen am ' + utils.weekday_destr(entered) + ', ' + utils.ts2destr(entered));
				yield {
					teammatch_id: tm.matchid,
					message,
				};
			}
		} else {
			if (report_until < now) {
				const message = (
					'Detailergebnis zu spät eingetragen: ' +
					'Spiel um ' + utils.weekday_destr(played) + ', ' + tm.spieldatum + ', ' +
					'aber noch nicht eingetragen' +
					' (Termin nicht aktuell, Nachverlegung oder Spiel endgültig ausgefallen?)');
				yield {
					teammatch_id: tm.matchid,
					message,
				};
			}
		}
	}

	const TIMELY_REPORT = (is_olrl ? 24 : 48) * utils.HOUR;
	if (entered
			&& !tm.ergebnisbestaetigt_datum &&
			(report_until + TIMELY_REPORT < now) &&
			!has_any_note(data, tm) &&
			!has_stb_comment_after(data, tm, entered)) {
		const message = (
			data_utils.tm_str(tm) + ' noch nicht vom StB bearbeitet' +
			' (Spiel am ' + utils.weekday_destr(played) + ', ' + tm.spieldatum +
			', Detailergebnis eingetragen am ' + utils.weekday_destr(entered) + ', ' + utils.ts2destr(entered) + ')'
		);
		yield {
			message,
			teammatch_id: tm.matchid,
			teammatch2_id: tm.matchid,
			type: 'latenote',
		};
	}
}

module.exports = function*(season) {
	for (const tm of season.data.teammatches) {
		yield* check_tm(season, tm);
	}
};