'use strict';

var render = require('./render');


function root_handler(req, res, next) {
	render(req, res, next, 'root', {});
}

module.exports = {
	root_handler: root_handler,
};
