/* jslint node:true */

'use strict';

exports = module.exports = {
    init: init,
    getAll: getAll,
    getAllLean: getAllLean,
    get: get,
    add: add,
    addFull: addFull,
    put: put,
    del: del
};

var assert = require('assert'),
    MongoClient = require('mongodb').MongoClient,
    ObjectId = require('mongodb').ObjectID,
    config = require('../config.js');

var g_db;
var g_collections = {};

function init(callback) {
    assert.strictEqual(typeof callback, 'function');

    MongoClient.connect(config.databaseUrl, function (error, db) {
        if (error) return callback(error);

        g_db = db;

        callback(null);
    });
}

function getCollection(userId) {
    assert.strictEqual(typeof userId, 'string');

    if (!g_collections[userId]) {
        console.log('Opening collection for', userId);

        g_db.createCollection(userId + '_things');
        g_collections[userId] = g_db.collection(userId + '_things');
        g_collections[userId].createIndex({ content: 'text' }, { default_language: 'none' });
    }

    return g_collections[userId];
}

function getAll(userId, query, skip, limit, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof query, 'object');
    assert.strictEqual(typeof skip, 'number');
    assert.strictEqual(typeof limit, 'number');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).find(query).skip(skip).limit(limit).sort({ modifiedAt: -1 }).toArray(function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(null, []);

        callback(null, result);
    });
}

function getAllLean(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).find({}).toArray(function (error, result) {
        if (error) return callback(error);
        callback(null, result || []);
    });
}

function get(userId, thingId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof thingId, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).find({ _id: new ObjectId(thingId) }).toArray(function (error, result) {
        if (error) return callback(error);
        if (result.length === 0) return callback(new Error('not found'));

        callback(null, result[0]);
    });
}

function add(userId, content, tags, attachments, externalContent, callback) {
    addFull(userId, content, tags, attachments, externalContent, new Date(), new Date(), callback);
}

function addFull(userId, content, tags, attachments, externalContent, createdAt, modifiedAt, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof content, 'string');
    assert(Array.isArray(tags));
    assert(Array.isArray(attachments));
    assert(Array.isArray(externalContent));
    assert.strictEqual(typeof createdAt, 'number');
    assert.strictEqual(typeof modifiedAt, 'number');
    assert.strictEqual(typeof callback, 'function');

    var doc = {
        content: content,
        createdAt: createdAt,
        modifiedAt: modifiedAt,
        tags: tags,
        externalContent: externalContent,
        attachments: attachments
    };

    getCollection(userId).insert(doc, function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(new Error('no result returned'));

        get(result.ops[0]._id, callback);
    });
}

function put(userId, thingId, content, tags, attachments, externalContent, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof thingId, 'string');
    assert.strictEqual(typeof content, 'string');
    assert(Array.isArray(tags));
    assert(Array.isArray(attachments));
    assert(Array.isArray(externalContent));
    assert.strictEqual(typeof callback, 'function');

    var data = {
        content: content,
        tags: tags,
        modifiedAt: new Date(),
        externalContent: externalContent,
        attachments: attachments
    };

    getCollection(userId).update({_id: new ObjectId(thingId) }, { $set: data }, function (error) {
        if (error) return callback(error);

        get(thingId, callback);
    });
}

function del(userId, thingId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof thingId, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).deleteOne({ _id: new ObjectId(thingId) }, function (error) {
        if (error) return callback(error);
        callback(null);
    });
}
