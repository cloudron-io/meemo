/* jslint node:true */

'use strict';

exports = module.exports = {
    listen: listen
};

var assert = require('assert'),
    Imap = require('imap');

var gConnection = null;

function openInbox(callback) {
    assert.strictEqual(typeof callback, 'function');

    gConnection.openBox('INBOX', true, callback);
}

function listen(callback) {
    assert.strictEqual(typeof callback, 'function');

    gConnection = new Imap({
        user: process.env.MAIL_IMAP_USERNAME,
        password: process.env.MAIL_IMAP_PASSWORD,
        host: process.env.MAIL_IMAP_SERVER,
        port: process.env.MAIL_IMAP_PORT,
        tls: true
    });

    gConnection.once('error', callback);

    gConnection.once('end', function() {
        console.log('Connection ended');
    });

    gConnection.once('ready', function () {
        console.log('Connection success');

        openInbox(function (error, box) {
            if (error) return callback(error);

            console.log(box);
        });
    });

    gConnection.connect();
}
