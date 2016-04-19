/* jslint node:true */

'use strict';

exports = module.exports = {
    init: init,
    get: get,
    del: del,
    update: update,
    cleanup: cleanup
};

var MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
    async = require('async'),
    things = require('./things.js'),
    config = require('./config.js');

var g_db, g_tags;

function init(callback) {
    MongoClient.connect(config.databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;
        g_db.createCollection('tags');
        g_tags = db.collection('tags');

        callback(null);
    });
}

function get(callback) {
    g_tags.find({}).sort({ createdAt: -1 }).toArray(function (error, result) {
        if (error) return callback(error);
        callback(null, result || []);
    });
}

function update(name, callback) {
    g_tags.update({ name: name }, {
        $inc: { usage: 1 },
        $set: {
            name: name
        }
    }, { upsert:true }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function del(id, callback) {
    g_tags.deleteOne({ _id: new ObjectId(id) }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}

function cleanup() {
    console.log('Cleanup tags');

    things.getAllLean(function (error, result) {
        if (error) return console.error(new Error(error));

        var tags = [];
        result.forEach(function (thing) {
            tags = tags.concat(things.extractTags(thing.content));
        });

        get(function (error, result) {
            if (error) return console.error(new Error(error));

            async.each(result, function (tag, callback) {
                if (tags.indexOf(tag.name) !== -1) return callback(null);

                console.log('Cleanup tag', tag.name);

                del(tag._id, callback);
            }, function (error) {
                if (error) console.error('Failed to cleanup tags:', error);
                else console.log('Tag cleanup done.');
            });
        });
    });
}
