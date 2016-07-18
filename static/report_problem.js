var report_problem = (function() {
'use strict';

var REPORT_URL = 'https://aufschlagwechsel.de/bupbug/';
var last_error = '-';
var reported_count = 0;


function get_info() {
	return {
		ua: window.navigator.userAgent,
		url: window.location.href,
		size: document.documentElement.clientWidth + 'x' + document.documentElement.clientHeight,
		screen: window.screen.width + 'x' + window.screen.height,
		last_error: last_error,
		reported_count: reported_count,
	};
}

function _send(obj) {
	var json_report = JSON.stringify(obj);
	var xhr = new XMLHttpRequest();
	xhr.open('POST', REPORT_URL, true);
	xhr.setRequestHeader('Content-type', 'text/plain');  // To be a simple CORS request
	xhr.send(json_report);
}

function report(info_obj) {
	var is_dev = false;
	/*@DEV*/
	//is_dev = true; // DEBUG
	/*/@DEV*/
	if (is_dev) {
		return;
	}

	reported_count++;
	if (reported_count > 5) {
		return;
	}

	info_obj._type = 'krotoncheck-error';
	_send(info_obj);
}

function send_export(data) {
	var info_obj = {
		_type: 'export',
		data: data,
	};
	_send(info_obj);
}

function on_error(msg, script_url, line, col, err) {
	last_error = {
		msg: msg,
		script_url: script_url,
		line: line,
		col: col,
	};
	if (err) {
		last_error.stack = err.stack;
	}
	report(get_info());
}

function silent_error(msg) {
	console.error(msg); // eslint-disable-line no-console
	last_error = {
		msg: msg,
		type: 'silent-error',
	};
	report(get_info());
}

function network_error(e) {
	console.log('network error: ' + e.message); // TODO report in UI
	last_error = e;
	last_error.type = network_error;
	report(get_info());
}

function init() {
	window.onerror = on_error;
}


init();

return {
	report: report,
	send_export: send_export,
	silent_error: silent_error,
	on_error: on_error,
	network_error: network_error,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	module.exports = report_problem;
}
/*/@DEV*/
