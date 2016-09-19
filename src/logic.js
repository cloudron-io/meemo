/* jslint node:true */

'use strict';

exports = module.exports = {
    getAll: getAll,
    get: get,
    add: add,
    put: put,
    del: del,
    exp: exp,
    imp: imp,
    publicLink: publicLink,
    getByShareId: getByShareId,
    extractURLs: extractURLs,
    extractTags: extractTags,
    facelift: facelift,
    cleanupTags: cleanupTags,

    TYPE_IMAGE: 'image',
    TYPE_UNKNOWN: 'unknown'
};

var async = require('async'),
    url = require('url'),
    tags = require('./database/tags.js'),
    things = require('./database/things.js'),
    shares = require('./database/shares.js'),
    superagent = require('superagent');

var GET_URL = new RegExp('(^|[ \t\r\n])((ftp|http|https|gopher|mailto|news|nntp|telnet|wais|file|prospero|aim|webcal):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))', 'g');
var PRETTY_URL_LENGTH = 40;

function extractURLs(content) {
    var lines = content.split('\n');
    var urls = [];

    lines.forEach(function (line) {
        var tmp = line.match(GET_URL);
        if (tmp === null) return;

        urls = urls.concat(tmp.map(function (url) {
            return url.trim();
        }));
    });

    return urls.filter(function (item, pos, self) {
        return self.indexOf(item) === pos;
    });
}

function escapeRegExp(str) {
    return str.replace(/[\-\[\]\/\{\}\(\)\*\+\?\.\\\^\$\|]/g, "\\$&");
}

function extractTags(content) {
    var tagObjects = [];

    // first replace all urls which might contain # with placeholders
    var urls = extractURLs(content);
    urls.forEach(function (u) {
        content = content.replace(new RegExp(escapeRegExp(u), 'gmi'), ' --URL_PLACEHOLDER-- ');
    });

    var lines = content.split('\n');
    lines.forEach(function (line) {
        var tmp = line.match(/#([\u00C0-\u017Fa-zA-Z]+)/g);
        if (tmp === null) return;

        tagObjects = tagObjects.concat(tmp.map(function (tag) {
            return tag.slice(1).toLowerCase();
        }));
    });

    return tagObjects;
}

function extractExternalContent(content, callback) {
    var urls = extractURLs(content);
    var externalContent = [];

    async.each(urls, function (url, callback) {
        superagent.get(url).end(function (error, result) {
            var obj = { url: url, type: exports.TYPE_UNKNOWN };

            if (error) {
                console.log('[WARN] failed to fetch external content %s', url);
            } else {
                if (result.type.indexOf('image/') === 0) {
                    obj = { url: url, type: exports.TYPE_IMAGE };
                }

                console.log('[INFO] external content type %s - %s', obj.type, obj.url);
            }

            externalContent.push(obj);

            callback(null);
        });
    }, function () {
        callback(null, externalContent);
    });
}

function facelift(userId, thing, callback) {
    var data = thing.content;
    var tagObjects = thing.tags;
    var externalContent = thing.externalContent;
    var attachments = thing.attachments || [];

    function wrapper() {

        // Enrich with tag links
        tagObjects.forEach(function (tag) {
            data = data.replace(new RegExp('#' + tag + '(#|\\s|$)', 'gmi'), '[#' + tag + '](#search?#' + tag + ')$1').trim();
        });

        // Enrich with image links
        externalContent.forEach(function (obj) {
            if (obj.type === exports.TYPE_IMAGE) {
                data = data.replace(new RegExp(escapeRegExp(obj.url), 'gmi'), '![' + obj.url + '](' + obj.url + ')');
            } else {
                // make urls look prettier
                var tmp = url.parse(obj.url);

                var pretty = obj.url.slice(tmp.protocol.length + 2);
                if (pretty.length > PRETTY_URL_LENGTH) pretty = pretty.slice(0, PRETTY_URL_LENGTH) + '...';

                data = data.replace(new RegExp(escapeRegExp(obj.url), 'gmi'), '[' + pretty + '](' + obj.url + ')');
            }
        });

        // Enrich with attachments
        attachments.forEach(function (a) {
            if (a.type === exports.TYPE_IMAGE) {
                data = data.replace(new RegExp('\\[' + a.fileName + '\\]', 'gmi'), '![/api/files/' + a.identifier + '](/api/files/' + a.identifier + ')');
            } else {
                data = data.replace(new RegExp('\\[' + a.fileName + '\\]', 'gmi'), '[/api/files/' + a.identifier + '](/api/files/' + a.identifier + ')');
            }
        });

        callback(null, data);
    }

    if (Array.isArray(externalContent)) return wrapper();

    // old entry extract external content first
    extractExternalContent(thing.content, function (error, result) {
        if (error) {
            console.error('Failed to extract external content:', error);

            externalContent = [];

            return wrapper();
        }

        // set for wrapper()
        externalContent = result;

        console.log('[INFO] update %s with new external content.', thing._id, result);

        things.put(userId, thing._id, thing.content, thing.tags, attachments, result, function (error) {
            if (error) console.error('Failed to update external content:', error);

            wrapper();
        });
    });
}

function getAll(userId, query, skip, limit, callback) {
    things.getAll(userId, query, skip, limit, function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(null, []);

        async.each(result, function (thing, callback) {
            facelift(userId, thing, function (error, data) {
                if (error) console.error('Failed to facelift:', error);

                thing.attachments = thing.attachments || [];
                thing.richContent = data || thing.content;

                callback(null);
            });
        }, function () {
            callback(null, result);
        });
    });
}

function get(userId, id, callback) {
    things.get(userId, id, function (error, result) {
        if (error) return callback(error);

        facelift(userId, result, function (error, data) {
            if (error) console.error('Failed to facelift:', error);

            result.attachments = result.attachments || [];
            result.richContent = data || result.content;

            callback(null, result);
        });
    });
}

function add(userId, content, attachments, callback) {
    extractExternalContent(content, function (error, result) {
        if (error) return callback(error);

        var doc = {
            content: content,
            createdAt: new Date(),
            modifiedAt: new Date(),
            tags: extractTags(content),
            externalContent: result,
            attachments: attachments
        };

        async.eachSeries(doc.tags, tags.update.bind(null, userId), function (error) {
            if (error) return callback(error);

            things.add(userId, doc.content, doc.tags, doc.attachments, doc.externalContent, function (error, result) {
                if (error) return callback(error);
                if (!result) return callback(new Error('no result returned'));

                get(userId, result._id, callback);
            });
        });
    });
}

function put(userId, id, content, attachments, callback) {
    var tagObjects = extractTags(content);

    async.eachSeries(tagObjects, tags.update.bind(null, userId), function (error) {
        if (error) return callback(error);

        extractExternalContent(content, function (error, externalContent) {
            if (error) console.error('Failed to extract external content:', error);

            things.put(userId, id, content, tagObjects, attachments, externalContent, function (error) {
                if (error) return callback(error);

                get(userId, id, callback);
            });
        });
    });
}

function del(userId, id, callback) {
    things.del(userId, id, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function exp(userId, callback) {
    things.getAllLean(userId, function (error, result) {
        if (error) return callback(error);
        if (!result) return (null, '');

        var out = result.map(function (thing) {
            return {
                createdAt: thing.createdAt,
                modifiedAt: thing.modifiedAt,
                content: thing.content,
                externalContent: thing.externalContent || [],
                attachments: thing.attachments || []
            };
        });

        callback(null, { things: out });
    });
}

function imp(userId, data, callback) {
    async.eachSeries(data.things, function (thing, next) {
        var tagObjects = extractTags(thing.content);

        async.eachSeries(tagObjects, tags.update.bind(null, userId), function (error) {
            if (error) return next(error);

            things.addFull(userId, thing.content, tagObjects, thing.attachments || [], thing.externalContent || [], thing.createdAt, thing.modifiedAt || thing.createdAt, function (error, result) {
                if (error) return next(error);
                if (!result) return next(new Error('no result returned'));

                next(null, result._id);
            });
        });
    }, callback);
}

function publicLink(userId, thingId, callback) {
    shares.add(userId, thingId, function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(new Error('no result returned'));

        callback(null, result);
    });
}

function getByShareId(userId, shareId, callback) {
    shares.get(userId, shareId, function (error, result) {
        if (error) return callback(error);
        if (result.length === 0) return callback(new Error('not found'));

        get(userId, result.thingId, function (error, result) {
            if (error) return callback(error);

            callback(null, result);
        });
    });
}

function cleanupTags(userId) {
    things.getAllLean(userId, function (error, result) {
        if (error) return console.error(new Error(error));

        var tags = [];
        result.forEach(function (thing) {
            tags = tags.concat(extractTags(thing.content));
        });

        tags.get(userId, function (error, result) {
            if (error) return console.error(new Error(error));

            async.each(result, function (tag, callback) {
                if (tags.indexOf(tag.name) !== -1) return callback(null);

                console.log('Cleanup tag', tag.name);

                tags.del(userId, tag._id, callback);
            }, function (error) {
                if (error) console.error('Failed to cleanup tags:', error);
            });
        });
    });
}
