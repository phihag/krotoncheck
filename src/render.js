const mustache = require('mustache');
const fs = require('fs');
const path = require('path');
const escape_html = require('escape-html');

const utils = require('./utils');

function _read_template(template_id, callback) {
	fs.readFile(path.dirname(__dirname) + '/templates/' + template_id + '.mustache', function (err, template_bytes) {
		if (err) {
			return callback(err, null);
		}
		const template = template_bytes.toString();
		callback(null, template);
	});
}

function _find_partial_references(parsed, res) {
	if (res === undefined) {
		res = [];
	}
	parsed.forEach(function(p) {
		switch (p[0]) {
		case '>':
			res.push(p[1]);
			break;
		case '#':
		case '^':
			_find_partial_references(p[4], res);
			break;
		}
	});
	return res;
}

function _find_partials(template_id, callback, found, outstanding) {
	if (!found) {
		found = {};
	}
	if (!outstanding) {
		outstanding = [];
	}

	_read_template(template_id, function(err, template) {
		if (err) {
			return callback(err, null);
		}

		found[template_id] = template;

		const parsed = mustache.parse(template);
		const referenced = _find_partial_references(parsed);

		outstanding.push.apply(outstanding, referenced);
		outstanding = outstanding.filter(function (o) {
			return found[o] === undefined;
		});
		if (outstanding.length === 0) {
			callback(null, found);
		} else {
			const next_id = outstanding.pop();
			_find_partials(next_id, callback, found, outstanding);
		}
	});
}

function render_mustache(template_id, data, callback) {
	_find_partials(template_id, function(err, partials) {
		if (err) {
			return callback(err, null);
		}
		var html = mustache.render(partials[template_id], data, partials);
		callback(null, html);
	});
}

function mustache_format_timestamp() {
	return function format_timestamp(text, renderfunc) {
		var content = renderfunc(text);
		var ts = parseInt(content, 10);
		if (!ts) {
			return '(Ungültiger Zeitstempel)';
		}
		return utils.ts2destr(ts);
	};
}

function add_helper_funcs(data) {
	data.urlencode = encodeURIComponent;
	data.format_timestamp = mustache_format_timestamp;
}

function render_standalone(template_id, data, cb) {
	add_helper_funcs(data);
	render_mustache(template_id, data, cb);
}

function render(req, res, next, template_id, data) {
	add_helper_funcs(data);
	data.current_user = req.krotoncheck_user;
	data.icon_path = '/static/icons/';
	data.csrf_token = req.csrfToken();
	data.csrf_field = '<input type="hidden" name="_csrf" value="' + escape_html(data.csrf_token) + '" />';
	data.root_path = req.app.root_path;
	render_mustache(template_id, data, function(err, content) {
		if (err) {
			return next(err);
		}
		data.content = content;
		render_mustache('scaffold', data, function(err, html) {
			if (err) {
				return next(err);
			}
			res.send(html);
		});
	});
}

module.exports = render;
render.render_standalone = render_standalone;

