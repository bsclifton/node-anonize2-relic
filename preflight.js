const mkdir = require('fs').mkdir;
const platform = require('os').platform();
const spawn = require('child_process').spawn;

var configure = { darwin : [ '-DOPSYS=MACOS', '-DSTLIB=ON', '-DSHLIB=OFF', '-DALLOC=AUTO', '-DBENCH=0', '-DTESTS=0' ],
                  linux  : [ '-DOPSYS=LINUX' ],
                  win32  : [ '-DOPSYS=WINDOWS' ]//, '-DARITH=gmp' ]
                }[platform];

if (!configure) {
  console.log('unsupported platform: ' + platform);
  process.exit(1);
}

const generator = platform === 'win32' ? 'Visual Studio 14 2015 Win64' : 'Unix Makefiles';
const args = [ '../relic', '-G', generator,
             '-DCHECK=on', '-DDEBUG=on', '-DARCH=X64', '-DALIGN=16', '-DCOLOR=OFF', '-DSEED=UDEV',
             '-DWITH=BN;DV;FP;FPX;EP;EPX;PP;MD', '-DBN_PRECI=256', '-DBN_MAGNI=DOUBLE'
           ].concat(configure);
const target = './anonize2/relic-build';

mkdir(target, parseInt('755', 8), function (err) {
  var out;

  if ((err) && (err.code !== 'EEXIST')) throw err;

  if (platform === 'win32') {
    const execSync = require('child_process').execSync;

    // Create project files, etc needed to build relic
    const cmakeCommand = 'cmake "' + args.join('" "') + '"';
    console.log('Running CMake: (this should take ~5-10 seconds)\n' + cmakeCommand + '\n');
    out = execSync(cmakeCommand, { cwd: target });
    console.log('output:\n' + out.toString());

    // Build relic w/ Visual Studio
    // TODO: this fails! :( only works w/ GCC
    const buildArgs = [
      'pushd .',
      'cd "\\Program Files (x86)\\Microsoft Visual Studio 14.0\\VC"',
      'vcvarsall x86',
      'popd',
      'devenv RELIC.sln /build'
    ];
    const buildCommand = buildArgs.join(' && ');
    console.log('Building using Visual Studio 2015:\n' + buildCommand + '\n');
    out = execSync(buildCommand, { cwd: target });
    console.log('output:\n' + out.toString());

  } else {
    var println = function (more) { out = Buffer.concat([ out, more ]); };

    var loser = function (s, err) {
      console.log(s);
      console.log(err.toString());
      console.log(out.toString());
      process.exit(1);
    };

    out = new Buffer(0);
    var cmake = spawn('cmake', args, { cwd: target }).on('error', function (err) {
      loser('cmake failed', err);
    }).on('close', function (code) {
      if (code) process.exit(code);

      out = new Buffer(0);
      var make = spawn('make', [], { cwd: target }).on('error', function (err) {
        loser('make failed', err);
      }).on('close', process.exit);

      make.stdout.on('data', function (more) { console.log(more.toString().trim()); });
      make.stderr.on('data', println);
    });

    cmake.stdout.on('data', println);
    cmake.stderr.on('data', println);
  }
});
