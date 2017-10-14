/* jslint node:true */

'use strict';

exports = module.exports = {
    getAllActiveUserIds: getAllActiveUserIds,

    getAll: getAll,
    getAllLean: getAllLean,
    get: get,
    add: add,
    addFull: addFull,
    put: put,
    del: del
};

var assert = require('assert'),
    ObjectId = require('mongodb').ObjectID,
    config = require('../config.js');

var g_collections = {};

function getAllActiveUserIds() {
    return Object.keys(g_collections);
}

function postProcess(userId, thing) {
    thing._id = String(thing._id);
    thing.public = !!thing.public;
    thing.shared = !!thing.shared;
    thing.archived = !!thing.archived;
    thing.sticky = !!thing.sticky;
}

function getCollection(userId) {
    assert.strictEqual(typeof userId, 'string');

    if (!g_collections[userId]) {
        console.log('Opening collection for', userId);

        config.db.createCollection(userId + '_things');
        g_collections[userId] = config.db.collection(userId + '_things');
        g_collections[userId].createIndex({ content: 'text' }, { default_language: 'none' });
        g_collections[userId].createIndex({ sticky: 1 });
    }

    return g_collections[userId];
}

function getAll(userId, query, skip, limit, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof query, 'object');
    assert.strictEqual(typeof skip, 'number');
    assert.strictEqual(typeof limit, 'number');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).find(query).skip(skip).limit(limit).sort({ sticky: -1, modifiedAt: -1 }).toArray(function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(null, []);

        result.forEach(postProcess.bind(null, userId));

        callback(null, result);
    });
}

function getAllLean(userId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).find({}).sort({ modifiedAt: -1, isSticky: 1 }).toArray(function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(null, []);

        result.forEach(postProcess.bind(null, userId));

        callback(null, result);
    });
}

function get(userId, thingId, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof thingId, 'string');
    assert.strictEqual(typeof callback, 'function');

    getCollection(userId).find({ _id: new ObjectId(thingId) }).toArray(function (error, result) {
        if (error) return callback(error);
        if (result.length === 0) return callback(new Error('not found'));

        postProcess(userId, result[0]);

        callback(null, result[0]);
    });
}

function add(userId, content, tags, attachments, externalContent, callback) {
    addFull(userId, content, tags, attachments, externalContent, Date.now(), Date.now(), callback);
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
        attachments: attachments,
        public: false,
        shared: false,
        archived: false,
        sticky: false
    };

    getCollection(userId).insert(doc, function (error, result) {
        if (error) return callback(error);
        if (!result) return callback(new Error('no result returned'));

        get(userId, String(result.ops[0]._id), callback);
    });
}

function put(userId, thingId, content, tags, attachments, externalContent, isPublic, isShared, isArchived, isSticky, callback) {
    assert.strictEqual(typeof userId, 'string');
    assert.strictEqual(typeof thingId, 'string');
    assert.strictEqual(typeof content, 'string');
    assert(Array.isArray(tags));
    assert(Array.isArray(attachments));
    assert(Array.isArray(externalContent));
    assert.strictEqual(typeof isPublic, 'boolean');
    assert.strictEqual(typeof isShared, 'boolean');
    assert.strictEqual(typeof isArchived, 'boolean');
    assert.strictEqual(typeof isSticky, 'boolean');
    assert.strictEqual(typeof callback, 'function');

    var data = {
        content: content,
        tags: tags,
        modifiedAt: Date.now(),
        externalContent: externalContent,
        attachments: attachments,
        public: isPublic,
        shared: isShared,
        archived: isArchived,
        sticky: isSticky
    };

    getCollection(userId).update({_id: new ObjectId(thingId) }, { $set: data }, function (error) {
        if (error) return callback(error);

        get(userId, thingId, callback);
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
