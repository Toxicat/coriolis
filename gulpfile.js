var gulp            = require('gulp'),
    less            = require('gulp-less'),
    jshint          = require('gulp-jshint'),
    minifyCSS       = require('gulp-minify-css'),
    concat          = require('gulp-concat'),
    uglify          = require('gulp-uglify'),
    sourcemaps      = require('gulp-sourcemaps'),
    templateCache   = require('gulp-angular-templatecache'),
    htmlmin         = require('gulp-htmlmin'),
    template        = require('gulp-template'),
    mainBowerFiles  = require('main-bower-files'),
    del             = require('del'),
    runSequence     = require('run-sequence'),
    exec            = require('child_process').exec,
    RevAll          = require('gulp-rev-all'),
    gutil           = require( 'gulp-util' ),
    svgstore        = require( 'gulp-svgstore' ),
    svgmin          = require( 'gulp-svgmin' ),
    jsonlint        = require("gulp-jsonlint"),
    appCache        = require("gulp-manifest"),
    pkg             = require('./package.json');

var cdnHostStr = '';

gulp.task('less', function() {
  return gulp.src('app/less/app.less')
    .pipe(less({paths: ['less/app.less']}).on('error',function(e){
      console.log('File:', e.fileName);
      console.log('Line:', e.lineNumber);
      console.log('Message:', e.message);
      this.emit('end');
    }))
    .pipe(minifyCSS())
    .pipe(gulp.dest('build'));
});

gulp.task('js-lint', function() {
  return gulp.src('app/js/**/*.js')
    .pipe(jshint({
      undef: true,
      unused: true,
      curly: true,
      predef: [ 'angular','DB','d3', 'ga', 'GAPI_KEY', 'document' , 'LZString' ]
    }))
    .pipe(jshint.reporter('default'));
});

gulp.task('json-lint', function() {
  return gulp.src('data/**/*.json')
    .pipe(jsonlint())
    .pipe(jsonlint.reporter());
});

gulp.task('bower', function(){
  return gulp.src(mainBowerFiles())
    .pipe(uglify({mangle: false, compress: false}).on('error',function(e){
      console.log('Bower File:', e.fileName);
      console.log('Line:', e.lineNumber);
      console.log('Message:', e.message);
    }))
    .pipe(concat('lib.js'))
    .pipe(gulp.dest('build'));
});

gulp.task('html2js', function() {
  return gulp.src('app/views/**/*.html')
    .pipe(htmlmin({
      'collapseBooleanAttributes': true,
      'collapseWhitespace': true,
      'removeAttributeQuotes': true,
      'removeComments': true,
      'removeEmptyAttributes': true,
      'removeRedundantAttributes': true,
      'removeScriptTypeAttributes': true,
      'removeStyleLinkTypeAttributes': true
    }).on('error',function(e){
      console.log('File:', e.fileName);
      console.log('Message:',e.message);
    }))
    .pipe(templateCache({
      'module': 'app.templates',
      'standalone': true,
      'root': 'views',
      'filename': 'template_cache.js'
    }))
    .pipe(gulp.dest('app/js'))
});

gulp.task('jsonToDB', function(cb) {
  exec('node scripts/json-to-db.js', cb);
});

gulp.task('js', function() {
  return gulp.src([
      'app/js/db.js',
      'app/js/**/module-*.js',
      'app/js/template_cache.js',
      'app/js/app.js',
      'app/js/**/*.js'
    ])
    .pipe(sourcemaps.init())
    .pipe(uglify({mangle: false}).on('error',function(e){
      console.log('File:', e.fileName);
      console.log('Line:', e.lineNumber);
      console.log('Message:', e.message);
      this.emit('end');
    }))
    .pipe(concat('app.js'))
    .pipe(sourcemaps.write('.'))
    .pipe(gulp.dest('build'));
});

gulp.task('copy', function() {
  return gulp.src(['app/images/**','app/fonts/**','app/.htaccess'], {base: 'app/'})
    .pipe(gulp.dest('build'));
});

gulp.task('generateIndexHTML', function(done) {
  // Generate minified inline svg of all icons for svg spriting
  gulp.src('app/icons/*.svg')
    .pipe(svgmin())
    .pipe(svgstore({ inlineSvg: true }))
    .pipe(gutil.buffer(function(err, files) {
      var svgIconsContent = files[0].contents.toString();
      gulp.src('app/index.html')
        .pipe(template({
          version: pkg.version,
          date : (new Date()).toLocaleDateString(),
          uaTracking: process.env.CORIOLIS_UA_TRACKING || false,
          svgContent: svgIconsContent,
          gapiKey: process.env.CORIOLIS_GAPI_KEY
        }))
        .pipe(htmlmin({
          'collapseBooleanAttributes': true,
          'collapseWhitespace': true,
          'removeAttributeQuotes': true,
          'removeComments': true,
          'removeEmptyAttributes': true,
          'removeRedundantAttributes': true,
          'removeScriptTypeAttributes': true,
          'removeStyleLinkTypeAttributes': true
        }).on('error',function(e){
          console.log('File:', e.fileName);
          console.log('Message:',e.message);
        }))
        .pipe(gulp.dest('build'));
        done();
      }));
});

gulp.task('serve', function(cb) {
  exec('nginx -p $(pwd) -c nginx.conf', function (err, stdout, stderr) {
    if (stderr) {
      console.warn(stderr);
      console.warn('Is NGINX already running?\n');
    }
    cb();
  });
});

// Windows command to launch nginx serv
gulp.task('serve-win', function(cb) {
  exec('nginx -p %cd% -c nginx.conf', function (err, stdout, stderr) {
    if (stderr) {
      console.warn(stderr);
      console.warn('Is NGINX already running?\n');
    }
    cb();
  });
});

gulp.task('serve-stop', function(cb) {
  exec('kill -QUIT $(cat nginx.pid)', function (err, stdout, stderr) {
    if (stderr) console.log(stderr); else cb(err);
  });
});

gulp.task('watch', function() {
  gulp.watch(['app/index.html','app/icons/*.svg'], ['generateIndexHTML']);
  gulp.watch(['app/images/**','app/fonts/**'], ['copy']);
  gulp.watch('app/less/*.less', ['less']);
  gulp.watch('app/views/**/*', ['html2js']);
  gulp.watch('app/js/**/*.js', ['js']);
  gulp.watch('data/**/*.json', ['jsonToDB']);
  gulp.watch(['build/**', '!**/*.appcache'], ['appcache']);
});

gulp.task('cache-bust', function(done) {
  var revAll = new RevAll({ prefix: cdnHostStr, dontRenameFile: ['.html','db.json'] });
  var stream = gulp.src('build/**')
    .pipe(revAll.revision())
    .pipe(gulp.dest('build'))
    .pipe(revAll.manifestFile())
    .pipe(gulp.dest('build'));

  stream.on('end', function() {
    var manifest = require('./build/rev-manifest.json');
    var arr = [];
    for(var origFileName in manifest) {
      if(origFileName != manifest[origFileName]) { // For all files busted/renamed
        arr.push('./build/' + origFileName);       // Add the original filename to the list
      }
    }
    del(arr, done);     // Delete all originals files the were not busted/renamed
  });
  stream.on('error', done);
});

gulp.task('appcache', function(done) {
  // Since using a CDN manually build file list rather than using appCache mechanisms
  gulp.src(['build/**', '!build/index.html', '!**/*.json', '!**/logo/*', '!**/*.map','!**/*.appcache'])
    .pipe(gutil.buffer(function(err, stream) {
      var files = [];
      for (var i = 0; i < stream.length; i++) {
        if (!stream[i].isNull()) {
          files.push(cdnHostStr + '/' + stream[i].relative);
        }
      }

      gulp.src([])
        .pipe(appCache({
          preferOnline: true,
          cache: files,
          filename: 'coriolis.appcache',
          timestamp: true
         }))
        .pipe(gulp.dest('build'))
        .on('end', done);
    }));
});

gulp.task('upload', function(done) {
  exec([
      "rsync -e 'ssh -i ", process.env.CORIOLIS_PEM, "' -a --delete build/ ", process.env.CORIOLIS_USER, "@", process.env.CORIOLIS_HOST, ":~/www"
    ].join(''),
    done
  );
});

gulp.task('lint', ['js-lint', 'json-lint']);
gulp.task('clean', function (done) { del(['build'], done); });
gulp.task('build', function (done) { runSequence('clean', ['html2js','jsonToDB'], ['generateIndexHTML','bower','js','less','copy'], done); });
gulp.task('build-cache', function (done) { runSequence('build', 'appcache', done); });
gulp.task('dev', function (done) { runSequence('build-cache', 'serve','watch', done); });
gulp.task('deploy', function (done) {
  cdnHostStr = '//cdn.' + process.env.CORIOLIS_HOST;
  runSequence('lint', 'build','cache-bust', 'appcache', 'upload', done);
});
gulp.task('default', ['dev']);

