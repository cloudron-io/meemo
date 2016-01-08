/* jslint node:true */

'use strict';

var path = require('path');

exports = module.exports = {
    init: init,
    chrome: chrome
};

var CHROME_FILENAME = path.join(__dirname, '../chrome_extension.crx');

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
