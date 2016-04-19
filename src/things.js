/* jslint node:true */

'use strict';

exports = module.exports = {
    init: init,
    getAll: getAll,
    getAllLean: getAllLean,
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

    TYPE_IMAGE: 'image',
    TYPE_UNKNOWN: 'unknown'
};

var MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
    async = require('async'),
    fs = require('fs'),
    os = require('os'),
    config = require('./config.js'),
    tags = require('./tags.js'),
    path = require('path'),
    superagent = require('superagent');

var g_db, g_things, g_publicLinks;
var GET_URL = new RegExp('(^|[ \t\r\n])((ftp|http|https|gopher|mailto|news|nntp|telnet|wais|file|prospero|aim|webcal):(([A-Za-z0-9$_.+!*(),;/?:@&~=-])|%[A-Fa-f0-9]{2}){2,}(#([a-zA-Z0-9$_.+!*(),;/?:@&~=%-]*))?([A-Za-z0-9$_+!*();/?:~-]))', 'g');

function init(callback) {
    MongoClient.connect(config.databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;
        g_db.createCollection('things');
        g_db.createCollection('publicLinks');
        g_things = db.collection('things');
        g_publicLinks = db.collection('publicLinks');

        g_things.createIndex({ content: 'text' }, { default_language: 'none' });

        callback(null);
    });
}

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

function extractTags(content) {
    var tagObjects = [];

    // first replace all urls which might contain # with placeholders
    var urls = extractURLs(content);
    urls.forEach(function (u) {
        content = content.replace(new RegExp(u, 'gmi'), ' --URL_PLACEHOLDER-- ');
    });

    var lines = content.split('\n');
    lines.forEach(function (line) {
        var tmp = line.match(/#(\w+)/g);
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

function facelift(thing, callback) {
    var data = thing.content;
    var tagObjects = thing.tags;
    var externalContent = thing.externalContent;

    function wrapper() {

        // Enrich with tag links
        tagObjects.forEach(function (tag) {
            data = data.replace(new RegExp('#' + tag, 'gmi'), '[#' + tag + '](#search?#' + tag + ')');
        });

        // Enrich with image links
        externalContent.forEach(function (obj) {
            if (obj.type === exports.TYPE_IMAGE) {
                data = data.replace(new RegExp(obj.url, 'gmi'), '![' + obj.url + '](' + obj.url + ')');
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

        g_things.update({_id: new ObjectId(thing._id) }, { $set: { externalContent: result } }, function (error) {
            if (error) console.error('Failed to update external content:', error);

            wrapper();
        });
    });
}

function getAll(query, skip, limit, callback) {
    g_things.find(query).skip(skip).limit(limit).sort({ modifiedAt: -1 }).toArray(function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(null, []);

        async.each(result, function (thing, callback) {
            facelift(thing, function (error, data) {
                if (error) console.error('Failed to facelift:', error);

                thing.richContent = data || thing.content;

                callback(null);
            });
        }, function () {
            callback(null, result);
        });
    });
}

function getAllLean(callback) {
    g_things.find({}).toArray(function (error, result) {
        if (error) return callback(error);
        callback(null, result || []);
    });
}

function get(id, callback) {
    g_things.find({ _id: new ObjectId(id) }).toArray(function (error, result) {
        if (error) return callback(error);
        if (result.length === 0) return callback(new Error('not found'));

        var thing = result[0];
        facelift(thing, function (error, data) {
            if (error) console.error('Failed to facelift:', error);

            thing.richContent = data || thing.content;

            callback(null, thing);
        });
    });
}

function add(content, callback) {

    extractExternalContent(content, function (error, result) {
        if (error) return callback(error);

        var doc = {
            content: content,
            createdAt: new Date(),
            modifiedAt: new Date(),
            tags: extractTags(content),
            externalContent: result
        };

        async.eachSeries(doc.tags, tags.update, function (error) {
            if (error) return callback(error);

            g_things.insert(doc, function (error, result) {
                if (error) return callback(error);
                if (!result) return callback(new Error('no result returned'));

                var thing = result.ops[0];

                facelift(thing, function (error, data) {
                    if (error) console.error('Failed to facelift:', error);

                    thing.richContent = data || thing.content;

                    callback(null, thing);
                });
            });
        });
    });
}

function put(id, content, callback) {
    var tagObjects = extractTags(content);

    async.eachSeries(tagObjects, tags.update, function (error) {
        if (error) return callback(error);

        extractExternalContent(content, function (error, result) {
            if (error) console.error('Failed to extract external content:', error);

            var data = {
                content: content,
                tags: tagObjects,
                modifiedAt: new Date(),
                externalContent: result
            };

            g_things.update({_id: new ObjectId(id) }, { $set: data }, function (error) {
                if (error) return callback(error);

                get(id, callback);
            });
        });
    });
}

function del(id, callback) {
    g_things.deleteOne({ _id: new ObjectId(id) }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function exp(callback) {
    g_things.find({}).toArray(function (error, result) {
        if (error) return callback(error);
        if (!result) return (null, '');

        var fileName = path.join(os.tmpdir(), Date.now() + '.json');
        var out = result.map(function (thing) {
            return {
                createdAt: thing.createdAt,
                modifiedAt: thing.modifiedAt,
                content: thing.content
            };
        });
        fs.writeFileSync(fileName, JSON.stringify({ things : out }, null, 4));

        callback(null, fileName);
    });
}

function imp(data, callback) {
    async.eachSeries(data.things, function (thing, next) {
        var tagObjects = extractTags(thing.content);
        var data = thing.content;

        var doc = {
            content: data,
            createdAt: thing.createdAt,
            modifiedAt: thing.modifiedAt || thing.createdAt,
            tags: tagObjects
        };

        async.eachSeries(tagObjects, tags.update, function (error) {
            if (error) return next(error);

            g_things.insert(doc, function (error, result) {
                if (error) return next(error);
                if (!result) return next(new Error('no result returned'));

                next(null, result._id);
            });
        });
    }, callback);
}

function publicLink(id, callback) {
    var doc = {
        thingId: id,
        createdAt: new Date()
    };

    g_publicLinks.insert(doc, function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(new Error('no result returned'));

        callback(null, result.insertedIds[0]);
    });
}

function getByShareId(shareId, callback) {
    g_publicLinks.find({ _id: new ObjectId(shareId) }).toArray(function (error, result) {
        if (error) return callback(error);
        if (result.length === 0) return callback(new Error('not found'));

        get(result[0].thingId, function (error, result) {
            if (error) return callback(error);

            callback(null, result);
        });
    });
}
