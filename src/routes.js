/* jslint node:true */

'use strict';

exports = module.exports = {
    auth,
    profile,
    getAll,
    get,
    add,
    put,
    del,
    getTags,
    settingsSave,
    settingsGet,
    exportThings,
    importThings,
    healthcheck,
    fileAdd,
    fileGet,

    public: {
        users: publicUsers,
        profile: publicProfile,
        getAll: publicGetAll,
        getThing: publicGetThing,
        getFile: publicGetFile,
        getRSS: publicGetRSS,
        streamPage: publicStreamPage
    }
};

var assert = require('assert'),
    checksum = require('checksum'),
    config = require('./config.js'),
    fs = require('fs'),
    path = require('path'),
    logic = require('./logic.js'),
    mkdirp = require('mkdirp'),
    path = require('path'),
    rss = require('rss'),
    settings = require('./database/settings.js'),
    tags = require('./database/tags.js'),
    tar = require('tar-fs'),
    tokens = require('./database/tokens.js'),
    users = require('./users.js'),
    UserError = users.UserError,
    crypto = require('crypto'),
    HttpError = require('connect-lastmile').HttpError,
    HttpSuccess = require('connect-lastmile').HttpSuccess;

function healthcheck(req, res, next) {
    next(new HttpSuccess(200, {}));
}

async function auth(req, res, next) {
    if (!req.oidc.isAuthenticated() && !req.query.token) return next(new HttpError(401, 'Unauthorized'));

    if (req.query.token) {
        tokens.get(req.query.token, function (error, result) {
            if (error) return next(new HttpError(401, 'invalid credentials'));

            // make old versions relogin and invalidate token
            if (!result.userId) {
                next(new HttpError(401, 'old token'));

                return tokens.del(req.query.token, function () {});
            }

            req.token = req.query.token;
            req.user = {
                id: result.userId,
                username: result.userId,
                email: 'unset for tokens',
                displayName: 'unset for tokens'
            };

            next();
        });
    } else {
        let user;
        try {
            user = {
                id: req.oidc.user.sub, // maybe get rid of this later
                username: req.oidc.user.sub,
                email: req.oidc.user.email,
                displayName: req.oidc.user.name
            };
            // keep it fresh
            await users.upsert(user.username, user.email, user.displayName);
        } catch (e) {
            console.error('Failed to upsert user', req.user.oidc.user, e);
            return next(new HttpError(500, 'internal error'));
        }

        req.user = user;

        next();
    }
}

function profile(req, res, next) {
    users.profile(req.user.id, false, function (error, result) {
        if (error && error.code === UserError.NOT_FOUND) return next(new HttpError(404, error.message));
        if (error) return next(new HttpError(500, error));

        var out = {
            user: result
        };

        next(new HttpSuccess(200, out));
    });
}

function getAll(req, res, next) {
    var query = { $or: [] };

    if (req.query.filter) {
        query.$or.push({
            $text: { $search: String(req.query.filter) }
        });
    } else {
        query.$or.push({ content: { $exists: true }});
    }

    if (req.query.sticky) {
        query.$or.push({ sticky: true });
    }

    var archiveQuery;
    if (req.query.archived) {
        archiveQuery = {
            archived: true
        };
    } else {
        archiveQuery = { $or: [{
            archived: false
        }, {
            archived: { $exists: false }
        }]};
    }

    var endQuery = { $and: [ archiveQuery, query ]};

    var skip = isNaN(parseInt(req.query.skip)) ? 0 : parseInt(req.query.skip);
    var limit = isNaN(parseInt(req.query.limit)) ? 10 : parseInt(req.query.limit);

    logic.getAll(req.user.id, endQuery, skip, limit, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { things: result }));
    });
}

function get(req, res, next) {
    logic.get(req.user.id, req.params.id, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { thing: result }));
    });
}

function add(req, res, next) {
    if (typeof req.body.content !== 'string' || !req.body.content) return next(new HttpError(400, 'content must be a string'));
    if (req.body.attachments && !Array.isArray(req.body.attachments)) return next(new HttpError(400, 'attachments must be an array'));

    if (!req.body.attachments) req.body.attachments = [];

    logic.add(req.user.id, req.body.content, req.body.attachments, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(201, { thing: result }));
    });
}

function put(req, res, next) {
    if (typeof req.body.content !== 'string' || !req.body.content) return next(new HttpError(400, 'content must be a string'));
    if (req.body.attachments && !Array.isArray(req.body.attachments)) return next(new HttpError(400, 'attachments must be an array'));
    if (req.body.public && typeof req.body.public !== 'boolean') return next(new HttpError(400, 'public must be a boolean'));
    if (req.body.shared && typeof req.body.shared !== 'boolean') return next(new HttpError(400, 'shared must be a boolean'));
    if (req.body.archived && typeof req.body.archived !== 'boolean') return next(new HttpError(400, 'archived must be a boolean'));
    if (req.body.sticky && typeof req.body.sticky !== 'boolean') return next(new HttpError(400, 'sticky must be a boolean'));

    if (!req.body.attachments) req.body.attachments = [];

    req.body.public = !!req.body.public;
    req.body.shared = !!req.body.shared;
    req.body.archived = !!req.body.archived;
    req.body.sticky = !!req.body.sticky;

    logic.put(req.user.id, req.params.id, req.body.content, req.body.attachments, req.body.public, req.body.shared, req.body.archived, req.body.sticky, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(201, { thing: result }));
    });
}

function del(req, res, next) {
    logic.del(req.user.id, req.params.id, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, {}));
    });
}

function getTags(req, res, next) {
    tags.get(req.user.id, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { tags: result }));
    });
}

function settingsSave(req, res, next) {
    settings.put(req.user.id, req.body.settings, function (error) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(202, {}));
    });
}

function settingsGet(req, res, next) {
    settings.get(req.user.id, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { settings: result }));
    });
}

function exportThings(req, res, next) {
    // Just to make sure the folder exists in case a user has never uploaded an attachment
    var attachmentFolder = path.join(config.attachmentDir, req.user.id);
    mkdirp.sync(attachmentFolder);

    logic.exp(req.user.id, function (error, result) {
        if (error) return next(new HttpError(500, error));

        var out = tar.pack(attachmentFolder, {
            map: function (header) {
                header.name = 'attachments/' + header.name;
                return header;
            }
        });

        // add the db dump
        out.entry({ name: 'things.json' }, JSON.stringify(result, null, 4));

        res.attachment('meemo-export.tar');
        out.pipe(res);
    });
}

function importThings(req, res, next) {
    if (!req.files || !req.files[0]) return next(new HttpError('400', 'missing file'));

    logic.importThings(req.user.id, req.files[0].path, function (error) {
        if (error) return next(new HttpError(400, error));

        next(new HttpSuccess(200, {}));
    });
}

function fileAdd(req, res, next) {
    if (!req.files || !req.files[0]) return next(new HttpError('400', 'missing file'));

    var file = req.files[0];
    var fileName = checksum(file.buffer) + path.extname(file.originalname);
    var attachmentFolder = path.join(config.attachmentDir, req.user.id);

    // ensure the directory exists
    mkdirp.sync(attachmentFolder);

    fs.writeFile(path.join(attachmentFolder, fileName), file.buffer, function (error) {
        if (error) return next(new HttpError(500, error));

        var type = file.mimetype.indexOf('image/') === 0 ? logic.TYPE_IMAGE : logic.TYPE_UNKNOWN;

        next(new HttpSuccess(201, { identifier: fileName, fileName: file.originalname, type: type }));
    });
}

function fileGet(req, res, next) {
    if (req.session.userId) return res.sendFile(req.params.identifier, { root: path.join(config.attachmentDir, req.session.userId) });

    logic.getPublic(req.params.userId, req.params.thingId, function (error) {
        if (error === 'not allowed') return next(new HttpError(403, 'not allowed'));
        if (error) return next(new HttpError(500, error));

        res.sendFile(req.params.identifier, { root: path.join(config.attachmentDir, req.params.userId) });
    });
}

function publicGetThing(req, res, next) {
    logic.getPublic(req.params.userId, req.params.thingId, function (error, result) {
        if (error === 'not allowed') return next(new HttpError(403, 'not allowed'));
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(200, { thing: result }));
    });
}

function publicGetAll(req, res, next) {
    var query = {};

    if (req.query && req.query.filter) {
        query = {
            $text: { $search: String(req.query.filter) }
        };
    }

    var skip = isNaN(parseInt(req.query.skip)) ? 0 : parseInt(req.query.skip);
    var limit = isNaN(parseInt(req.query.limit)) ? 10 : parseInt(req.query.limit);

    logic.getAllPublic(req.params.userId, query, skip, limit, function (error, result) {
        if (error) return next(new HttpError(500, error));
        next(new HttpSuccess(200, { things: result }));
    });
}

function publicGetFile(req, res) {
    res.sendFile(req.params.fileId, { root: path.join(config.attachmentDir, req.params.userId) });
}

function publicUsers(req, res, next) {
    users.list(function (error, result) {
        if (error && error.code === UserError.NOT_FOUND) return next(new HttpError(404, error.message));
        if (error) return next(new HttpError(500, error));

        next(new HttpSuccess(200, { users: result }));
    });
}

function publicProfile(req, res, next) {
    users.profile(req.params.userId, false, function (error, result) {
        if (error && error.code === UserError.NOT_FOUND) return next(new HttpError(404, error.message));
        if (error) return next(new HttpError(500, error));

        var out = {
            username: result.username,
            displayName: result.displayName,
        };

        settings.get(req.params.userId, function (error, result) {
            if (error) return next(new HttpError(500, error));

            out.title = result.title;
            out.backgroundImageDataUrl = result.publicBackground ? result.backgroundImageDataUrl : undefined;

            next(new HttpSuccess(200, out));
        });
    });
}

function publicGetRSS(req, res, next) {
    assert.strictEqual(typeof req.params.userId, 'string');

    users.profile(req.params.userId, false, function (error, user) {
        if (error && error.code === UserError.NOT_FOUND) return next(new HttpError(404, error.message));
        if (error) return next(new HttpError(500, error));

        settings.get(req.params.userId, function (error, config) {
            if (error) return next(new HttpError(500, error));

            logic.getAllPublic(req.params.userId, {}, 0, 50, function (error, result) {
                if (error) return next(new HttpError(500, error));

                var webServer = process.env.CLOUDRON_APP_ORIGIN || 'http://localhost';

                var feed = new rss({
                    title: config.title,
                    image_url: webServer + '/img/logo128.png',
                    site_url: webServer
                });

                // generate the rss feed items
                result.forEach(function (r) {
                    var title = r.content.split('\n').filter(function (l) { return !!l.trim(); })[0];

                    feed.item({
                        title: title,
                        url: webServer + '/blog/' + 'TODO', // TODO
                        author: user.displayName + '( ' + user.username + ' )',
                        date: new Date(r.createdAt),
                        description: md.render(r.richContent)
                    });
                });

                res.type('application/rss+xml').status(200).send(feed.xml());
            });
        });
    });
}

function publicStreamPage(req, res) {
    assert.strictEqual(typeof req.params.userId, 'string');

    res.sendFile(path.resolve(__dirname, '../public/stream.html'));
}


// THIS DOES NOT BELONG HERE

function markdownTargetBlank(md) {
    // stash the default renderer
    var defaultRender = md.renderer.rules.link_open || function(tokens, idx, options, env, self) {
        return self.renderToken(tokens, idx, options);
    };

    md.renderer.rules.link_open = function (tokens, idx, options, env, self) {
        var href = tokens[idx].attrs[tokens[idx].attrIndex('href')][1];

        if (href.indexOf('https://') === 0 || href.indexOf('http://') === 0) {
            // in case another plugin added that attribute already
            var aIndex = tokens[idx].attrIndex('target');

            if (aIndex < 0) {
                tokens[idx].attrPush(['target', '_blank']); // add new attribute
            } else {
                tokens[idx].attrs[aIndex][1] = '_blank';    // replace value of existing attr
            }
        }

        return defaultRender(tokens, idx, options, env, self);
    };
}

function colorizeIt(md/*, options*/) {
    var regexp = /\:([#\w\-]+)\:/;

    function isColor(color) {
        // https://developer.mozilla.org/en-US/docs/Web/CSS/color_value
        var colors = [
            'clear',
            'aliceblue', 'lightsalmon', 'antiquewhite', 'lightseagreen', 'aqua', 'lightskyblue', 'aquamarine', 'lightslategray', 'azure', 'lightsteelblue', 'beige', 'lightyellow', 'bisque', 'lime', 'black', 'limegreen', 'blanchedalmond', 'linen', 'blue', 'magenta', 'blueviolet', 'maroon', 'brown', 'mediumaquamarine', 'burlywood', 'mediumblue', 'cadetblue', 'mediumorchid', 'chartreuse', 'mediumpurple', 'chocolate', 'mediumseagreen', 'coral', 'mediumslateblue', 'cornflowerblue', 'mediumspringgreen', 'cornsilk', 'mediumturquoise', 'crimson', 'mediumvioletred', 'cyan', 'midnightblue', 'darkblue', 'mintcream', 'darkcyan', 'mistyrose', 'darkgoldenrod', 'moccasin', 'darkgray', 'navajowhite', 'darkgreen', 'navy', 'darkkhaki', 'oldlace', 'darkmagenta', 'olive', 'darkolivegreen', 'olivedrab', 'darkorange', 'orange', 'darkorchid', 'orangered', 'darkred', 'orchid', 'darksalmon', 'palegoldenrod', 'darkseagreen', 'palegreen', 'darkslateblue', 'paleturquoise', 'darkslategray', 'palevioletred', 'darkturquoise', 'papayawhip', 'darkviolet', 'peachpuff', 'deeppink', 'peru', 'deepskyblue', 'pink', 'dimgray', 'plum', 'dodgerblue', 'powderblue', 'firebrick', 'purple', 'floralwhite', 'red', 'forestgreen', 'rosybrown', 'fuchsia', 'royalblue', 'gainsboro', 'saddlebrown', 'ghostwhite', 'salmon', 'gold', 'sandybrown', 'goldenrod', 'seagreen', 'gray', 'seashell', 'green', 'sienna', 'greenyellow', 'silver', 'honeydew', 'skyblue', 'hotpink', 'slateblue', 'indianred', 'slategray', 'indigo', 'snow', 'ivory', 'springgreen', 'khaki', 'steelblue', 'lavender', 'tan', 'lavenderblush', 'teal', 'lawngreen', 'thistle', 'lemonchiffon', 'tomato', 'lightblue', 'turquoise', 'lightcoral', 'violet', 'lightcyan', 'wheat', 'lightgoldenrodyellow', 'white', 'lightgreen', 'whitesmoke', 'lightgrey', 'yellow', 'lightpink', 'yellowgreen'
        ];

        if (color[0] === '#') return true;

        return colors.indexOf(color) !== -1;
    }

    md.inline.ruler.push('colorizeIt', function (state, silent) {
        // slowwww... maybe use an advanced regexp engine for this
        var match = regexp.exec(state.src.slice(state.pos));
        if (!match) return false;
        if (!isColor(match[1])) return false;

        // valid match found, now we need to advance cursor
        state.pos += match[0].length;

        // don't insert any tokens in silent mode
        if (silent) return true;

        var token = state.push('colorizeIt', '', 0);
        token.meta = { color: match[1] };

        return true;
    });

    md.renderer.rules.colorizeIt = function (tokens, id/*, options, env*/) {
        if (tokens[id].meta.color === 'clear') {
            return '</span>';
        } else {
            return '<span style="color: ' + tokens[id].meta.color + ';">';
        }
    };
}

var md = require('markdown-it')({
    breaks: true,
    html: true,
    linkify: true
})
.use(require('markdown-it-emoji'))
.use(colorizeIt)
.use(require('markdown-it-checkbox'))
.use(markdownTargetBlank);

md.renderer.rules.emoji = function(token, idx) {
    return require('twemoji').parse(token[idx].content);
};
