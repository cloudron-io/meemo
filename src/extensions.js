/* jslint node:true */

'use strict';

var path = require('path');

exports = module.exports = {
    init: init,
    chrome: chrome,
    firefox: firefox
};

var CHROME_FILENAME = path.join(__dirname, '../webextension.crx');
var FIREFOX_FILENAME = path.join(__dirname, '../webextension.xpi');

function init(callback) {
    callback();
}

function chrome(req, res) {
    var options = {
        headers: {
            'content-type': 'application/x-chrome-extension'
        }
    };

    res.sendFile(CHROME_FILENAME, options, function (error) {
        if (error) {
            console.error(error);
            res.status(error.status).end();
        }
  });
}

function firefox(req, res) {
    res.sendFile(FIREFOX_FILENAME, {}, function (error) {
        if (error) {
            console.error(error);
            res.status(error.status).end();
        }
  });
}
