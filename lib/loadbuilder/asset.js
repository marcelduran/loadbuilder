var util     = require('./util'),
    analyzer = require('./analyzer'),
    path     = require('path'),
    jshint   = require('jshint').JSHINT,
    file     = require('./file');

var ARRAY_ARG = {
  type: "ArrayExpression",
  elements: null
};
var STRING_ARG = {
  type: "Literal",
  value: null
};

var dependencyCache = {};
var dependencyCacheLastUpdate = {};

function Script(id) {
  this.id = id;
}

util.extend(Script.prototype, {
  dependencies: function() {
    var usings, dependencies = [];

    usings = this.fromFile().usings();

    usings.forEach(function(call) {
      var args = call.values[0];

      args.forEach(function(arg) {
        var dep, m;

        if (m = analyzer.match(STRING_ARG, arg)) {
           dep = this.builder.matchAsset(m[0]);
           dependencies = dependencies.concat(dep);
        } else if(m = analyzer.match(ARRAY_ARG, arg)) {
          arg[1].forEach(function(arg) {
            //  FIXME: duplicate code; un-nest this stuff
            //  nesty :(
            var dep, m;

            if (m = analyzer.match(STRING_ARG, arg)) {
               dep = this.builder.matchAsset(m[0]);
               dependencies = dependencies.concat(dep);
            }
          }, this);
        }
      }, this);
    }, this);
    return dependencies;
  },
  lint: function(options) {
    var lintOptions = util.extend({}, this.builder.options.lint || {});
    util.extend(lintOptions, options || {});

    if (!jshint(this.fromFile().source, lintOptions)) {
      this.report(jshint.errors);
      process.exit(1);
    }
  },
  ast: function() {
    return this.fromFile().ast();
  },
  addTranslationMarkers: function(fnName) {
    return this.fromFile().addTranslationMarkers(fnName);
  },
  toSource: function() {
    return this.deferWrapper(this.fromFile().generate());
  },
  fromFile: function() {
    if (!this.file) {
      this.file = file(this.fullPath(), this.builder.preProcessor);
    }
    this.file.load();
    return this.file;
  },
  fullPath: function() {
    if (this.id.match(/^\$/)) {
      return this.builder.modPath(this.id.replace(/^\$/, ''));
    } else {
      return this.builder.path(this.id);
    }
  },
  report: function(errors) {
    console.log('Errors in ' + this.fullPath() + ':\n');

    errors.forEach(function(e) {
      console.log('#' + e.line + ': ' + e.evidence);
      console.log(e.reason + ' line: ' + e.line +
                  ', col: ' + e.character + '\n');
    });
  },
  deferWrapper: function(source) {
    return this.builder.options.useDeferred === true ? "deferred('" +
           this.id + "', function() {\n" + source + "\n});" : source;
  }
});

function Module(id) {
  this.id = id;
}

Module.prototype = new Script;

util.extend(Module.prototype, {
  fullPath: function() {
    return this.builder.modPath(this.id + '.js');
  },
  toSource: function() {
    if (this.isCJS()) {
      return this.amdWrappedSource();
    } else {
      return this.addId();
    }
  },
  isCJS: function() {
    return !this.fromFile().provides().length;
  },
  amdWrappedSource: function() {
    var deps = ['module', 'require', 'exports'].concat(this.dependencies().map(function(d) { return d.id; })),
        preamble = "define(" + JSON.stringify(this.id) + "," +
                   JSON.stringify(deps) + ",function(module, require, exports) {\n",
        postamble = "\n});"

    return preamble + this.fromFile().generate() + postamble;
  },

  dependencies: function() {
    if (this.isCJS()) {
      return this.dependenciesFromRequire();
    } else {
      return Script.prototype.dependencies.call(this);
    }
  },
  dependenciesFromRequire: function() {
    var requires = this.fromFile().requires();

    return requires.map(function(r) {
      var asset = this.builder.matchAsset(r.values[0][0].value, false);
      return (asset.length==0) ? null : asset;
    }, this).filter(function(item){ return item!=null; });
  },
  addId: function() {
    var provides = this.fromFile().provides(),
        tree = this.ast(),
        provide;

    if (provides.length > 0) {
      provide = provides[0];

       // TODO make this nice - maybe have a transform function?
      if (analyzer.match(STRING_ARG, provide.values[0][0]) == null) {
        provide.parent.expression.arguments.unshift({
          type: "Literal",
          value: this.id
        });
        this.fromFile().taintAst();
      }
    }
    return this.fromFile().generate();
  }
});

module.exports = {
  Script: Script,
  Module: Module
};