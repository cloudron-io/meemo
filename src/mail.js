/* jslint node:true */

'use strict';

exports = module.exports = {
    listen: listen
};

var assert = require('assert'),
    async = require('async'),
    quotedPrintable = require('quoted-printable'),
    Imap = require('imap');

var gConnection = null;

function openInbox(callback) {
    assert.strictEqual(typeof callback, 'function');

    gConnection.openBox('INBOX', true, callback);
}

function handleMessage(message, callback) {
    assert.strictEqual(typeof  message, 'object');
    assert.strictEqual(typeof callback, 'function');

    console.log('handleMessage', message);

    callback(null);
}

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


function fetchMessages(callback) {
    assert.strictEqual(typeof callback, 'function');

    var messages = [];

    var f = gConnection.seq.fetch('1:*', {
        bodies: ['HEADER.FIELDS (TO)', 'HEADER.FIELDS (FROM)', 'HEADER.FIELDS (SUBJECT)', 'HEADER.FIELDS (CONTENT-TYPE)', 'TEXT'],
        struct: true
    });

    f.on('message', function (msg, seqno) {
        console.log('Message #%d', seqno);

        var message = {
            subject: null,
            body: null,
            from: null,
            to: null,
            multipartBoundry: null
        };

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

        msg.once('attributes', function(attrs) {
            message.attributes = attrs;
        });

        msg.once('end', function () {
            if (message.multipartBoundry) {
                message.body = parseMultipart(message.body, message.multipartBoundry);
            }

            messages.push(message);
        });
    });

    f.once('error', function(err) {
        console.log('Fetch error: ' + err);
    });

    f.once('end', function() {
        async.each(messages, handleMessage, callback);
    });
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

            fetchMessages(function (error) {
                if (error) return callback(error);

                console.log('Done');
            });
        });
    });

    gConnection.connect();
}
