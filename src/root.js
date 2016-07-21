'use strict';

var render = require('./render');


function root_handler(req, res, next) {
	req.app.db.efetch_all(next, [{
		collection: 'seasons',
	}], function(seasons) {
		render(req, res, next, 'root', {
			seasons: seasons,
		});
	});
}

module.exports = {
	root_handler: root_handler,
};
