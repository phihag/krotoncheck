'use strict';

function enrich(data, season, found) {
	found.forEach(function(p) {
		if (p.teammatch_id) {
			p.teammatch = data.get_teammatch(p.teammatch_id);
			p.teammatch_url = 'http://www.turnier.de/sport/teammatch.aspx?id=' + season.tournament_id + '&match=' + p.teammatch_id;
			p.turnier_url = p.teammatch_url;
		}
		if (p.match_id) {
			p.match = data.get_match(p.match_id);
			p.match_name = data.match_name(p.match);
		}
	});

	found.sort(function(f1, f2) {
		if (!f1.teammatch_id && f2.teammatch_id) {
			return -1;
		}
		if (f1.teammatch_id && !f2.teammatch_id) {
			return 1;
		}

		return natcmp(f1.teammatch_id, f2.teammatch_id);
	});
}

function store(db, season, found, cb) {
	db.problems.update({key: season.key}, {key: season.key, found: found}, {upsert: true}, cb);
}

module.exports = {
	enrich: enrich,
	store: store,
};