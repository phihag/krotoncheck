'use strict';

module.exports = function*(season) {
	const data = season.data;
	const F_RE = /F(?:01|13|14|15|37|40)/;

	for (const tm of data.teammatches) {
		const nichtantritt_og = data.get_stb_note(tm.matchid, note_text => F_RE.test(note_text));

		if (!tm.flag_ok_gegen_team1 && !tm.flag_ok_gegen_team2) {
			const umw = tm.flag_umwertung_gegen_team1 || tm.flag_flag_umwertung_gegen_team2 || tm.flag_umwertung_gegen_beide;

			if (nichtantritt_og) {
				const f_m = F_RE.exec(nichtantritt_og.nachricht);
				const message = (
					'OG ' + f_m[0] + ' verhängt, aber Mannschaftsspiel ist nicht als ohne Kampf markiert. ' +
					'(Falsche OG-ID?)' +
					(umw ? ' (Fälschlich als Umwertung eingetragen?)' : '')
				);
				yield {
					teammatch_id: tm.matchid,
					message,
				};
			}

			continue;
		}

		if (! nichtantritt_og) {
			const contains_o = !!data.get_stb_note(tm.matchid, note_text => /FO1/.test(note_text));
			const contains_og = !!data.get_stb_note(tm.matchid, note_text => /OG|Ordnungsgebühr/.test(note_text));

			const message = (
				'Mannschaftsspiel ohne Kampf, aber dementsprechende Ordnungsgebühr (z.B. F01 oder F37) gegen ' +
				(tm.flag_ok_gegen_team1 ? 'Heimmannschaft (' + tm.team1name + ')' : 'Gastmannschaft (' + tm.team2name + ')')
				+ ' fehlt.' +
				(contains_o ? ' (F01 mit o statt Null geschrieben?)' : '') +
				(contains_og ? ' (Ordnungsgebühr-Kennung (z.B. F01 oder F37) vergessen?)' : '')
			);
			yield {
				teammatch_id: tm.matchid,
				message,
			};
		}
	}
};
