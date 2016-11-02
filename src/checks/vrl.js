'use strict';

// Check the VRLs themselves

var utils = require('../utils.js');

function* extract_vrls(data) {
	let clubcode;
	let clubname;
	let typeid = null;

	let entries = [];

	for (const line of data.clubranking) {
		if ((clubcode !== line.clubcode) || (typeid !== line.typeid)) {
			// Commit current
			if (typeid !== null) {
				yield {
					clubcode: clubcode,
					clubname: clubname,
					typeid: typeid,
					entries: entries,
				};
			}
			typeid = line.typeid;
			clubcode = line.clubcode;
			clubname = line.clubname;
			entries = [];
		}
		entries.push(line);
	}

	if (typeid !== null) {
		yield {
			clubcode: clubcode,
			clubname: clubname,
			typeid: typeid,
			entries: entries,
		};
	}
}

function* check_vrl(data, vrl) {
	let last_id = 0;
	let by_doubles_pos = new Map();
	for (const line of vrl.entries) {
		if (line.position != line.teamposition) {
			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message: 'Ungültige VRL ' + vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ': position (' + line.position + ') != teamposition (' + line.teamposition + ') bei Spieler (' + line.memberid + ') ' + line.firstname + ' ' + line.lastname,
			};
		}

		const position = parseInt(line.teamposition);
		const position_doubles = line.teampositiondouble ? parseInt(line.teampositiondouble) : position;

		// No gaps in VRL
		if ((last_id + 1) !== position) {
			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message: 'Lücke in der VRL ' + vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ': Auf ' + last_id + ' folgt ' + position,
			};
		}
		last_id = position;

		// No duplicate numbers in doubles VRL
		if (by_doubles_pos.has(position_doubles)) {
			const old = by_doubles_pos.get(position_doubles);

			const message = (
				'Doppelter Eintrag in der Doppel-VRL ' + vrl.typeid + ' von (' + vrl.clubcode + ') ' + vrl.clubname + ': ' +
				'(' + old.memberid + ') ' + old.firstname + ' ' + old.lastname + ' und ' +
				'(' + line.memberid + ') ' + line.firstname + ' ' + line.lastname + ' ' +
				'sind beide an an Position ' + position_doubles
			);

			yield {
				type: 'vrl',
				vrl_typeid: vrl.typeid,
				clubcode: vrl.clubcode,
				message: message,
			};
		}
		by_doubles_pos.set(position_doubles, line);

	}
}


module.exports = function*(season, data) {
	const vrls = extract_vrls(data);

	for (const vrl of vrls) {
		yield* check_vrl(data, vrl);
	}
};