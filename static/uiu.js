// ui utils
var uiu = (function() {
'use strict';

function qsEach(selector, func, container) {
	if (!container) {
		container = document;
	}
	var nodes = container.querySelectorAll(selector);
	for (var i = 0;i < nodes.length;i++) {
		func(nodes[i], i);
	}
}

function on_click(node, callback) {
	node.addEventListener('click', callback, false);
}

function on_click_qs(selector, callback) {
	on_click(qs(selector), callback);
}

function on_click_qsa(qs, callback) {
	qsEach(qs, function(node) {
		on_click(node, callback);
	});
}


function qs(selector, container) {
	if (!container) {
		container = document;
	}

	/*@DEV*/
	var all_nodes = container.querySelectorAll(selector);
	if (all_nodes.length !== 1) {
		throw new Error(all_nodes.length + ' nodes matched by qs ' + selector);
	}
	/*/@DEV*/

	var node = container.querySelector(selector);
	if (! node) {
		report_problem.silent_error('Expected to find qs  ' + selector + ' , but no node matching.');
		return;
	}
	return node;
}

function empty(node) {
	var last;
	while ((last = node.lastChild)) {
		node.removeChild(last);
	}
}

function remove(node) {
	empty(node);
	node.parentNode.removeChild(node);
}

function remove_qsa(qs, container) {
	qsEach(qs, remove, container);
}

function text(node, str) {
	empty(node);
	node.appendChild(node.ownerDocument.createTextNode(str));
}

function text_qs(selector, str) {
	text(qs(selector), str);
}

function create_el(parent, tagName, attrs, text) {
	var el = document.createElement(tagName);
	if (attrs) {
		for (var k in attrs) {
			el.setAttribute(k, attrs[k]);
		}
	}
	if ((text !== undefined) && (text !== null)) {
		el.appendChild(document.createTextNode(text));
	}
	if (parent) {
		parent.appendChild(el);
	}
	return el;
}

return {
	create_el: create_el,
	empty: empty,
	on_click: on_click,
	on_click_qs: on_click_qs,
	on_click_qsa: on_click_qsa,
	remove: remove,
	remove_qsa: remove_qsa,
	qs: qs,
	qsEach: qsEach,
	text: text,
	text_qs: text_qs,
};

})();

/*@DEV*/
if ((typeof module !== 'undefined') && (typeof require !== 'undefined')) {
	var report_problem = require('./report_problem');

	module.exports = uiu;
}
/*/@DEV*/
