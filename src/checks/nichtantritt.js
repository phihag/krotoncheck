'use strict';

module.exports = function*(season) {
	const data = season.data;

	for (const tm of data.teammatches) {
		if (!tm.flag_ok_gegen_team1 && !tm.flag_ok_gegen_team2) {
			continue;
		}

		if (! data.get_stb_note(tm.matchid, note_text => /F(?:01|13|14|15|37|40)/.test(note_text))) {
			const contains_o = !!data.get_stb_note(tm.matchid, note_text => /FO1/.test(note_text));
			const contains_og = !!data.get_stb_note(tm.matchid, note_text => /OG|Ordnungsgebühr/.test(note_text));

			const message = (
				'Mannschaftsspiel ohne Kampf, aber dementsprechende Ordnungsgebühr (z.B. F01 oder F37) gegen ' +
				(tm.flag_ok_gegen_team1 ? 'Heimmannschaft (' + tm.team1name + ')' : 'Gastmannschaft (' + tm.team2name + ')')
				+ ' fehlt.' +
				(contains_o ? ' (F01 mit o statt Null geschrieben?)' : '') +
				(contains_og ? ' (Ordnungsgebühr-Kennung F01/F37 vergessen?)' : '')
			);
			yield {
				teammatch_id: tm.matchid,
				message,
			};
		}
	}
};
