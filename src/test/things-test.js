'use strict';

/* global it:false */
/* global describe:false */
/* global before:false */
/* global after:false */

var expect = require('expect.js'),
    config = require('../config.js'),
    things = require('../things.js');

describe('Things', function () {
    function setup(done) {
        config._clearDatabase(done);
    }

    function cleanup(done) {
        config._clearDatabase(done);
    }

    describe('extractURLs',  function () {
        before(setup);
        after(cleanup);

        it('succeeds with one url', function () {
            var test = 'Some content with a url http://guacamoly.rocks/';

            var urls = things.extractURLs(test);
            expect(urls.length).to.equal(1);
            expect(urls[0]).to.equal('http://guacamoly.rocks/');
        });

        it('succeeds with multiple urls on one line', function () {
            var test = 'Some content with a url http://guacamoly.rocks/ and http://guacamoly.rocks/timestwo with even more http://guacamoly.rocks/cheerio.html bar';

            var urls = things.extractURLs(test);
            expect(urls.length).to.equal(3);
            expect(urls[0]).to.equal('http://guacamoly.rocks/');
            expect(urls[1]).to.equal('http://guacamoly.rocks/timestwo');
            expect(urls[2]).to.equal('http://guacamoly.rocks/cheerio.html');
        });

        it('succeeds with multiple urls on multiple lines', function () {
            var test = 'Some content with a url http://guacamoly.rocks/ and http://guacamoly.rocks/timestwo with \n even more http://guacamoly.rocks/cheerio.html bar';

            var urls = things.extractURLs(test);
            expect(urls.length).to.equal(3);
            expect(urls[0]).to.equal('http://guacamoly.rocks/');
            expect(urls[1]).to.equal('http://guacamoly.rocks/timestwo');
            expect(urls[2]).to.equal('http://guacamoly.rocks/cheerio.html');
        });

        it('filters out duplicate links', function () {
            var test = 'Some content with a url http://guacamoly.rocks/cheerio.html and http://guacamoly.rocks/timestwo with \n even more http://guacamoly.rocks/cheerio.html bar';

            var urls = things.extractURLs(test);
            expect(urls.length).to.equal(2);
            expect(urls[0]).to.equal('http://guacamoly.rocks/cheerio.html');
            expect(urls[1]).to.equal('http://guacamoly.rocks/timestwo');
        });

        it('succeeds with multiple urls and #', function () {
            var test = 'Some content with a url http://guacamoly.rocks/#/ and http://guacamoly.rocks/time#stwo with even more http://guacamoly.rocks/cheerio.html#11 http://guacamoly.rocks/cheerio.html#11/give_me_more bar';

            var urls = things.extractURLs(test);
            expect(urls.length).to.equal(4);
            expect(urls[0]).to.equal('http://guacamoly.rocks/#/');
            expect(urls[1]).to.equal('http://guacamoly.rocks/time#stwo');
            expect(urls[2]).to.equal('http://guacamoly.rocks/cheerio.html#11');
            expect(urls[3]).to.equal('http://guacamoly.rocks/cheerio.html#11/give_me_more');
        });
    });

    describe('extractTags',  function () {
        before(setup);
        after(cleanup);

        it('succeeds with one tag', function () {
            var test = 'Hello #tag there!';

            var tags = things.extractTags(test);
            expect(tags.length).to.equal(1);
            expect(tags[0]).to.equal('tag');
        });

        it('succeeds with multiple tags', function () {
            var test = 'Hello #tag there! more #foobar #house tags';

            var tags = things.extractTags(test);
            expect(tags.length).to.equal(3);
            expect(tags[0]).to.equal('tag');
            expect(tags[1]).to.equal('foobar');
            expect(tags[2]).to.equal('house');
        });

        it('succeeds with multiple tags on multiple lines', function () {
            var test = 'Hello #tag there! more #foobar #house tags \n #other tags in #second line';

            var tags = things.extractTags(test);
            expect(tags.length).to.equal(5);
            expect(tags[0]).to.equal('tag');
            expect(tags[1]).to.equal('foobar');
            expect(tags[2]).to.equal('house');
            expect(tags[3]).to.equal('other');
            expect(tags[4]).to.equal('second');
        });

        it('succeeds with multiple tags together', function () {
            var test = 'Hello #tag there! more #foobar#house tags';

            var tags = things.extractTags(test);
            expect(tags.length).to.equal(3);
            expect(tags[0]).to.equal('tag');
            expect(tags[1]).to.equal('foobar');
            expect(tags[2]).to.equal('house');
        });

        it('ignores # in urls', function () {
            var test = 'Hello #tag there! more http://guacamoly.rocks/#11/52.5194/13.3456 tags';

            var tags = things.extractTags(test);
            expect(tags.length).to.equal(1);
            expect(tags[0]).to.equal('tag');
        });

        it('extract tags from urls ending with a tag in multiple urls', function () {
            var test = 'Hello #tag there! more http://guacamoly.rocks/#11/52.5194/13.3456 tags foo  http://guacamoly.rocks/#11/52.5194/13.3456#bar';

            var tags = things.extractTags(test);
            expect(tags.length).to.equal(2);
            expect(tags[0]).to.equal('tag');
            expect(tags[1]).to.equal('bar');
        });
    });
});
