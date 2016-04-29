'use strict';

var autoprefixer = require('gulp-autoprefixer'),
    del = require('del'),
    ejs = require('gulp-ejs'),
    gulp = require('gulp'),
    gutil = require('gulp-util'),
    minifycss = require('gulp-cssnano'),
    rename = require('gulp-rename'),
    run = require('gulp-run'),
    sass = require('gulp-sass'),
    sourcemaps = require('gulp-sourcemaps');

gulp.task('styles', function () {
    return gulp.src('frontend/scss/index.scss')
        .pipe(sourcemaps.init())
        .pipe(sass({ includePaths: [] }).on('error', sass.logError))
        .pipe(autoprefixer('last 2 version', 'safari 5', 'ie 8', 'ie 9', 'opera 12.1', 'ios 6', 'android 4'))
        .pipe(rename({suffix: '.min'}))
        .pipe(minifycss())
        .pipe(sourcemaps.write())
        .pipe(gulp.dest('public/'));
});

gulp.task('javascript', function () {
    return gulp.src('frontend/js/*.js')
        .pipe(gulp.dest('public/js/'));
});

gulp.task('html', function () {
    return gulp.src('frontend/*.html')
        .pipe(ejs({}).on('error', gutil.log))
        .pipe(gulp.dest('public/'));
});

gulp.task('favicon', function () {
    return gulp.src('logo.png')
        .pipe(rename('favicon.png'))
        .pipe(gulp.dest('public/'));
});

gulp.task('3rdparty', ['other'], function () {
    return gulp.src([
        'node_modules/jquery/dist/*.min.js*',
        'frontend/3rdparty/**/*.min.css*',
        'frontend/3rdparty/**/*.min.js*',
        'frontend/3rdparty/**/*.js*',
        'frontend/3rdparty/**/*.otf',
        'frontend/3rdparty/**/*.svg',
        'frontend/3rdparty/**/*.ttf',
        'frontend/3rdparty/**/*.woff*',
    ]).pipe(gulp.dest('public/3rdparty/'));
});

gulp.task('other', function () {
    return gulp.src([
        'node_modules/superagent/superagent.js',
        'node_modules/vue/dist/vue.min.js',
        'node_modules/markdown-it/dist/markdown-it.min.js',
        'node_modules/markdown-it-checkbox/dist/markdown-it-checkbox.min.js',
        'node_modules/markdown-it-emoji/dist/markdown-it-emoji.min.js'
    ]).pipe(gulp.dest('public/3rdparty/js/'));
});

gulp.task('images', function () {
    return gulp.src([
        'frontend/img/*',
    ]).pipe(gulp.dest('public/img/'));
});

gulp.task('chrome_extension', function () {
    del.sync(['webextension-chrome.zip']);
    run('zip -r webextension-chrome.zip webextension/').exec();
});

gulp.task('firefox_extension', function () {
    del.sync(['webextension-firefox.xpi']);
    run('zip -r ../webextension-firefox.xpi .', { cwd: process.cwd() + '/webextension' }).exec();
});

gulp.task('extensions', ['chrome_extension', 'firefox_extension'], function () {});

gulp.task('default', ['clean', 'html', 'favicon', 'images', 'styles', 'javascript', '3rdparty'], function () {});

gulp.task('clean', function () {
    del.sync(['public/']);
});

gulp.task('watch', ['default'], function () {
    gulp.watch('frontend/scss/*.scss', ['styles']);
    gulp.watch('frontend/**/*.js', ['javascript']);
    gulp.watch('frontend/**/*.html', ['html']);
    gulp.watch('frontend/img/*', ['images']);
    gulp.watch('webextension/*', ['extensions']);
});
