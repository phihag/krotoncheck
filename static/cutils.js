'use strict';

var cutils = (function() {

function request(url, post_data, cb) {
	var xhr = new XMLHttpRequest();
	xhr.onreadystatechange = function() {
		if (xhr.readyState != 4) {
			return;  // request not done
		}

		if (xhr.status != 200) {
			return cb({
				message: 'HTTP-Fehler ' + xhr.status,
			});
		}

		var data = JSON.parse(xhr.responseText);
		cb(null, data);
	};

	if (post_data) {
		xhr.open('POST', url, true);
		xhr.setRequestHeader('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
		var fd = cutils.form_data(post_data);
		xhr.send(fd);
	} else {
		xhr.open('GET', url);
		xhr.send();
	}
}

function root_path() {
	return uiu.qs('body').getAttribute('data-root_path');
}

function csrf_token() {
	return uiu.qs('body').getAttribute('data-csrf_token');
}

function form_data(obj) {
	var items = [];
	for (var k in obj) {
		items.push(encodeURIComponent(k) + '=' + encodeURIComponent(obj[k]));
	}
	return items.join('&');
}

return {
	request: request,
	root_path: root_path,
	csrf_token: csrf_token,
	form_data: form_data,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	module.exports = cutils;
}
/*/@DEV*/
