var gulp = require('gulp'),
    source = require('vinyl-source-stream'),
    sourcemaps = require('gulp-sourcemaps'),
    sass = require('gulp-sass'),
    minifycss = require('gulp-minify-css'),
    autoprefixer = require('gulp-autoprefixer'),
    del = require('del'),
    rename = require('gulp-rename'),
    browserify = require('browserify'),
    buffer = require('vinyl-buffer'),
    uglify = require('gulp-uglify'),
    gutil = require('gulp-util');

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

gulp.task('browserify', function () {
    browserify({
        entries: 'frontend/js/main.js',
        debug: true
    }).bundle()
        .pipe(source('bundle.js'))
        .pipe(buffer())
        .pipe(sourcemaps.init({loadMaps: true}))
        .pipe(sourcemaps.write('./'))
        .pipe(gulp.dest('public/'));
});

gulp.task('html', function () {
    return gulp.src('frontend/*.html').pipe(gulp.dest('public/'));
});

gulp.task('favicon', function () {
    return gulp.src('logo.png')
        .pipe(rename('favicon.png'))
        .pipe(gulp.dest('public/'));
});

gulp.task('3rdparty', function () {
    return gulp.src([
        'node_modules/jquery/dist/*.min.js*',
        'node_modules/bootstrap/dist/**/*.min.css*',
        'node_modules/bootstrap/dist/**/*.min.js*',
        'node_modules/bootstrap-material-design/dist/**/*.min.css*',
        'node_modules/bootstrap-material-design/dist/**/*.min.js*',
        'node_modules/font-awesome/**/font-awesome.min.css',
        'node_modules/font-awesome/**/font-awesome.css.map',
        'node_modules/font-awesome/**/*.+(otf|eot|svg|ttf|woff|woff2)'
    ]).pipe(gulp.dest('public/3rdparty/'));
});

gulp.task('default', ['clean', 'html', 'favicon', 'styles', 'browserify', '3rdparty'], function() {});

gulp.task('clean', function () {
    del.sync(['public/']);
});

gulp.task('watch', ['default'], function () {
    gulp.watch('frontend/scss/*.scss', ['styles']);
    gulp.watch('frontend/**/*.js', ['browserify']);
    gulp.watch('frontend/**/*.html', ['html']);
    gulp.watch('frontend/img/*', ['images']);
});
