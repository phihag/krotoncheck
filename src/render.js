var mustache = require('mustache');
var fs = require('fs');
var path = require('path');
var escape_html = require('escape-html');

function _read_template(template_id, callback) {
	fs.readFile(path.dirname(__dirname) + '/templates/' + template_id + '.mustache', function (err, template_bytes) {
		if (err) {
			return callback(err, null);
		}
		var template = template_bytes.toString();
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

		var parsed = mustache.parse(template);
		var referenced = _find_partial_references(parsed);

		outstanding.push.apply(outstanding, referenced);
		outstanding = outstanding.filter(function (o) {
			return found[o] === undefined;
		});
		if (outstanding.length === 0) {
			callback(null, found);
		} else {
			var next_id = outstanding.pop();
			_find_partials(next_id, callback, found, outstanding);
		}
	});
}

function _render_mustache(template_id, data, callback) {
	_find_partials(template_id, function(err, partials) {
		if (err) {
			return callback(err, null);
		}
		var html = mustache.render(partials[template_id], data, partials);
		callback(null, html);
	});
}

function render(req, res, next, template_id, data) {
	data.current_user = req.krotoncheck_user;
	data.urlencode = encodeURIComponent;
	data.icon_path = '/static/icons/';
	data.csrf_token = req.csrfToken();
	data.csrf_field = '<input type="hidden" name="_csrf" value="' + escape_html(data.csrf_token) + '" />';
	data.root_path = req.app.root_path;
	_render_mustache(template_id, data, function(err, content) {
		if (err) {
			return next(err);
		}
		data.content = content;
		_render_mustache('scaffold', data, function(err, html) {
			if (err) {
				return next(err);
			}
			res.send(html);
		});
	});
}

module.exports = render;
