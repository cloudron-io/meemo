/* jslint node:true */

'use strict';

exports = module.exports = {};

var CHECK_INBOX_INTERVAL = 5 * 60 * 1000;
var CLEANUP_TRASH_INTERVAL = 5 * 60 * 1000;

var assert = require('assert'),
    async = require('async'),
    debug = require('debug')('mail'),
    Imap = require('imap'),
    quotedPrintable = require('quoted-printable'),
    users = require('./users.js'),
    logic = require('./logic.js');

console.log('Email receiving is enabled');

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

function checkInbox() {
    var conn = new Imap({
        user: process.env.MAIL_IMAP_USERNAME,
        password: process.env.MAIL_IMAP_PASSWORD,
        host: process.env.MAIL_IMAP_SERVER,
        port: process.env.MAIL_IMAP_PORT,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
    });

    conn.once('error', function (error) {
        console.error('IMAP error:', error);
    });

    conn.once('end', function() {
        debug('IMAP connection ended');
    });

    conn.once('ready', function () {
        debug('IMAP connection success');

        conn.openBox('INBOX', true, function (error, box) {
            if (error) return console.error('Unable to open INBOX:', error);

            debug('Check for new messages...', box.messages.total);

            // fetch one by one to have consistent seq numbers
            // box.messages.total is updated by the node module due to the message move
            async.whilst(function () { return box.messages.total > 0; }, function (callback) {
                fetchMessage(conn, function (message, callback) {
                    debug('handleNewMessage', message);

                    // add subject as a header
                    var body = message.subject[0] ? ('## ' + message.subject[0] + '\n\n' ) : '';
                    body += message.body;

                    // username is either remainder of + or the whole mailbox name
                    var parts = String(message.to).split('@')[0].split('+');
                    var username = parts.length > 1 ? parts[1] : parts[0];

                    if (!username) {
                        console.error('Unable to extract username from %s', String(message.to));
                        conn.seq.move(message.seqno, ['Trash'], callback);
                        return;
                    }

                    users.profile(username, false, function (error, result) {
                        if (error) {
                            console.error('Unable to map %s to an LDAP user', username, error);
                            conn.seq.move(message.seqno, ['Trash'], callback);
                            return;
                        }

                        logic.add(result.id, body, [], function (error) {
                            if (error) return callback(error);

                            // done now move to trash
                            conn.seq.move(message.seqno, ['Trash'], callback);
                        });
                    });
                }, callback);
            }, function (error) {
                if (error) console.error(error);

                debug('Inbox handling done.');

                conn.closeBox(function (error) {
                    if (error) console.error(error);

                    conn.end();
                });
            });
        });
    });

    conn.connect();
}

function cleanupTrash() {
    var conn = new Imap({
        user: process.env.MAIL_IMAP_USERNAME,
        password: process.env.MAIL_IMAP_PASSWORD,
        host: process.env.MAIL_IMAP_SERVER,
        port: process.env.MAIL_IMAP_PORT,
        tls: true,
        tlsOptions: { rejectUnauthorized: false }
    });

    conn.once('error', function (error) {
        console.error('Janitor IMAP error:', error);
    });

    conn.once('end', function() {
        debug('Janitor IMAP connection ended');
    });

    conn.once('ready', function () {
        debug('Janitor IMAP connection success');

        conn.openBox('Trash', function (error, box) {
            if (error) return console.error(error);

            // nothing to do
            if (box.messages.total === 0) return conn.end();

            conn.seq.addFlags('1:*', ['\\Deleted'], function (error) {
                if (error) console.error(error);

                // closing box with true argument expunges it on close
                conn.closeBox(true, function (error) {
                    if (error) console.error(error);

                    conn.end();
                });
            });
        });
    });

    conn.connect();
}

checkInbox();
cleanupTrash();

setInterval(cleanupTrash, CLEANUP_TRASH_INTERVAL);
setInterval(checkInbox, CHECK_INBOX_INTERVAL);
