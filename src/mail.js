/* jslint node:true */

'use strict';

exports = module.exports = {
    listen: listen
};

var RECONNECT_TIMEOUT = 10 * 1000;
var CLEANUP_TRASH_INTERVAL = 10 * 1000;

var assert = require('assert'),
    async = require('async'),
    Imap = require('imap'),
    quotedPrintable = require('quoted-printable'),
    things = require('./things.js');

var gInboxConnection = null;
var gInbox = null;
var gInboxActive = false;

function parseMultipart(buffer, boundary) {
    var parts = buffer.split('\r\n');

    var content = [];
    var found = false;
    var headers = false;
    var consume = false;
    var encodingQuotedPrintable = false;

    for (var i = 0; i < parts.length; ++i) {
        if (parts[i].indexOf('--' + boundary) === 0) {
            // if we get a second boundary but have already found the plain one, stop
            if (found) break;

            content = [];
            headers = true;
            continue;
        }

        // check if we have found the plain/text section
        if (headers && parts[i].toLowerCase().indexOf('content-type: text/plain') === 0) {
            found = true;
            continue;
        }

        if (headers && parts[i].toLowerCase().indexOf('content-transfer-encoding: quoted-printable') === 0) {
            encodingQuotedPrintable = true;
            continue;
        }

        // we found the headers and an empty newline marks the beginning of the body
        if (headers && parts[i] === '') {
            headers = false;
            consume = true;
            continue;
        }

        if (consume) {
            if (encodingQuotedPrintable) parts[i] = quotedPrintable.decode(parts[i]);
            content.push(parts[i]);
        }
    }

    return content.join('\n');
}


function fetchMessage(connection, handler, callback) {
    assert.strictEqual(typeof connection, 'object');
    assert.strictEqual(typeof handler, 'function');
    assert.strictEqual(typeof callback, 'function');

    var message = {
        subject: null,
        body: null,
        from: null,
        to: null,
        multipartBoundry: null,
        seqno: null
    };

    var f = connection.seq.fetch('1:1', {
        bodies: ['HEADER.FIELDS (TO)', 'HEADER.FIELDS (FROM)', 'HEADER.FIELDS (SUBJECT)', 'HEADER.FIELDS (CONTENT-TYPE)', 'TEXT'],
        struct: true
    });

    f.on('message', function (msg, seqno) {
        message.seqno = seqno;

        msg.on('body', function (stream, info) {
            var buffer = '';

            stream.on('data', function (chunk) {
                buffer += chunk.toString('utf8');
            });

            stream.once('end', function () {
                if (info.which === 'TEXT') {
                    message.body = buffer;
                } else if (info.which === 'HEADER.FIELDS (SUBJECT)') {
                    message.subject = Imap.parseHeader(buffer).subject;
                } else if (info.which === 'HEADER.FIELDS (FROM)') {
                    message.from = Imap.parseHeader(buffer).from;
                } else if (info.which === 'HEADER.FIELDS (TO)') {
                    message.to = Imap.parseHeader(buffer).to;
                } else if (info.which === 'HEADER.FIELDS (CONTENT-TYPE)') {
                    if (buffer.indexOf('multipart/alternative') !== -1) {
                        // extract boundary and remove any " or '
                        message.multipartBoundry = buffer.split('boundary=')[1]
                            .replace(/"([^"]+(?="))"/g, '$1')
                            .replace(/'([^']+(?='))'/g, '$1')
                            .replace(/\r\n/g, '');
                    }
                }
            });
        });

        msg.once('attributes', function (attrs) {
            message.attributes = attrs;
        });

        msg.once('end', function () {
            if (message.multipartBoundry) {
                message.body = parseMultipart(message.body, message.multipartBoundry);
            }
        });
    });

    f.once('error', callback);

    f.once('end', function () {
        // we had an error
        if (!message.seqno) return;

        handler(message, callback);
    });
}

function handleNewMessage(message, callback) {
    assert.strictEqual(typeof  message, 'object');
    assert.strictEqual(typeof callback, 'function');

    console.log('handleNewMessage', message);

    // add subject as a header
    var body = message.subject[0] ? ('## ' + message.subject[0] + '\n\n' ) : '';
    body += message.body;

    things.add(body, [], function (error, result) {
        if (error) return callback(error);

        // done now move to trash
        gInboxConnection.seq.move(message.seqno, ['Trash'], callback);
    });
}

function checkInbox() {
    if (gInboxActive) {
        console.log('Already checking Inbox.');
        return;
    }

    gInboxActive = true;

    console.log('Check for new messages...');

    // fetch one by one to have consistent seq numbers
    async.forever(function (callback) {
        fetchMessage(gInboxConnection, handleNewMessage, callback);
    }, function (error) {
        // since we simply try to fetch more messages, if all are done we fail like this
        if (error && error.message.indexOf('Invalid messageset') === -1) console.error(error);

        gInboxActive = false;

        console.log('Inbox handling done.');
    });
}

function listen() {
    gInboxConnection = new Imap({
        user: process.env.MAIL_IMAP_USERNAME,
        password: process.env.MAIL_IMAP_PASSWORD,
        host: process.env.MAIL_IMAP_SERVER,
        port: process.env.MAIL_IMAP_PORT,
        tls: true,
        keepalive: {
            idleInterval: 10 * 1000
        }
    });

    gInboxConnection.once('error', function (error) {
        console.error('IMAP error:', error);

        // reconnect in 10sec
        setTimeout(listen, RECONNECT_TIMEOUT);
    });

    gInboxConnection.once('end', function() {
        console.log('IMAP connection ended');

        // reconnect in 10sec
        setTimeout(listen, RECONNECT_TIMEOUT);
    });

    gInboxConnection.once('ready', function () {
        console.log('IMAP connection success');

        gInboxConnection.openBox('INBOX', true, function (error, box) {
            if (error) return console.error('Unable to open INBOX:', error);

            gInbox = box;

            // checkInbox();
        });
    });

    gInboxConnection.once('mail', function (count) {
        console.log('--- mail event', count)
        checkInbox();
    });

    gInboxConnection.connect();
}

function cleanupTrash() {
    var connection = new Imap({
        user: process.env.MAIL_IMAP_USERNAME,
        password: process.env.MAIL_IMAP_PASSWORD,
        host: process.env.MAIL_IMAP_SERVER,
        port: process.env.MAIL_IMAP_PORT,
        tls: true
    });

    connection.once('error', function (error) {
        console.error('Janitor IMAP error:', error);
    });

    connection.once('end', function() {
        console.log('Janitor IMAP connection ended');
    });

    connection.once('ready', function () {
        console.log('Janitor IMAP connection success');

        connection.openBox('Trash', function (error, box) {
            if (error) return console.error(error);

            console.log('TRASH messages', box.messages);

            // fetch one by one to have consistent seq numbers
            async.whilst(function () {
                return box.messages.total > 0;
            }, function (callback) {
                --box.messages.total;

                fetchMessage(connection, function (message, callback) {
                    console.log('got message')
                    connection.seq.addFlags(message.seqno, ['\\Deleted'], callback);
                }, callback);
            }, function (error) {
                if (error) console.error(error);

                // closing box with true argument expunges it on close
                connection.closeBox(false, function (error) {
                    if (error) console.error(error);

                    connection.end();
                });
            });
        });
    });

    connection.connect();
}

setInterval(cleanupTrash, CLEANUP_TRASH_INTERVAL);
