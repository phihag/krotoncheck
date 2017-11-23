'use strict';

const assert = require('assert');
const async = require('async');
const fs = require('fs');
const path = require('path');


const database = require('../database');
const utils = require('../utils');

const calc_idx = line => line.clubcode + '_' + line.typeid + '_' + line.memberid;

module.exports = function*(season) {
	const cr_table = season.data.clubranking;

	const season_key = season.key;
	assert(/^[a-z0-9_]+$/.test(season_key));
	const filename = path.join(database.MAX_VRLS_DIR, season_key + '.json');

	const now = season.newest_download && season.newest_download.done_timestamp;
	if (!now) {
		return callback();
	}

	let lines_json;
	try {
		lines_json = fs.readFileSync(filename);
	} catch (err) {
		if (err.code === 'ENOENT') {
			lines_json = '[]';
		} else {
			throw err;
		}
	}
	const lines = JSON.parse(lines_json);

	// Check for removed
	const new_by_cv = utils.make_index(cr_table, calc_idx);
	for (const old_line of lines) {
		if (new_by_cv.has(calc_idx(old_line))) {
			continue;
		}

		const message = (
			'Zeile in VRL gelöscht: ' + old_line.firstname + ' ' + old_line.lastname + ' (' + old_line.memberid + ')' +
			', vormals an Position ' + old_line.position + ', ' +
			'zuletzt gesehen ' + utils.ts2destr(old_line.kc_last_seen)
		);
		yield {
			type: 'vrl',
			clubcode: old_line.clubcode,
			vrl_typeid: old_line.typeid,
			message,
		};
	}


	// Update with current records
	const old_by_cv = utils.make_index(lines, calc_idx);
	for (const new_line of cr_table) {
		let cur_line = old_by_cv.get(calc_idx(new_line)) ;
		if (!cur_line) {
			cur_line = utils.deep_copy(new_line);
		}
		cur_line.kc_last_seen = now;
		lines.push(cur_line);
	}

	const out_json = JSON.stringify(lines);
	fs.writeFileSync(filename, out_json);
};
