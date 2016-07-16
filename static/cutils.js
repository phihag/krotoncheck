'use strict';

(function() {

function download_json(url, cb) {
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

		return JSON.parse(xhr.responseText);
	};
	xhr.open('GET', path);
	xhr.send();
}

return {
	download_json: download_json,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	module.exports = cutils;
}
/*/@DEV*/
