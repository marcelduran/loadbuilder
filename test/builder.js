var builder = require('loadbuilder/builder'),
    asset   = require('loadbuilder/asset'),
    assert  = require('assert'),
    fs      = require('fs');

var opts = {
  docroot: __dirname,
  path: 'modules'
};

module.exports = {
  testBuildShouldProvideSourceOfAllAssetsInCollection: function() {
    assert.equal(
      "alert('hello world');\nalert('hello world again');",
      builder(opts).include('fixtures/simple.js', 'fixtures/simple2.js').toSource()
    );
  },
  testShouldDedupeAssetsInACollection: function() {
    assert.equal(
      "alert('hello world');\nalert('hello world again');",
      builder(opts).include('fixtures/simple.js', 'fixtures/simple2.js', 'fixtures/simple.js').toSource()
    );
  },
  testShouldBeAbleToExcludeFiles: function() {
    assert.equal(
      "alert('hello world');",
      builder(opts).include('fixtures/simple.js', 'fixtures/simple2.js').exclude('fixtures/simple2.js').toSource()
    );
  },
  testShouldBeAbleToExcludeALowLevelDep: function() {
    assert.equal(
      builder(opts).include('mod_with_dep').exclude('named').toSource(),
      "provide('mod_with_dep', function (exports) {\n    using('named', function () {\n        exports(3);\n    });\n});"
    );
  },
  testShouldCollectDependencies: function() {
    assert.equal(
      "alert('hello dep1');\nusing('fixtures/dep1dep.js');\nalert('hello');\nusing('fixtures/dep1.js', 'fixtures/dep2.js');",
      builder(opts).include('fixtures/has_dep.js').toSource()
    );
  },
  testShouldGenerateManifestList: function() {
    assert.deepEqual(
      ["fixtures/dep1dep.js","fixtures/dep1.js","fixtures/dep2.js","fixtures/has_dep.js"],
      builder(opts).include('fixtures/has_dep.js').manifest()
    );
  },
  testShouldExcludeDependenciesOfExcludedAsset: function() {
    assert.equal(
      "alert('hello');\nusing('fixtures/dep1.js', 'fixtures/dep2.js');",
      builder(opts).include('fixtures/has_dep.js').exclude('fixtures/dep1.js').toSource()
    );
  },
  testShouldBeAbleToExcludeMultipleDependencies: function() {
    assert.equal(
      "using('fixtures/dep1.js', 'fixtures/dep2.js');",
      builder(opts).include('fixtures/has_dep.js').exclude('fixtures/dep1.js', 'fixtures/dep2.js').toSource()
    );
  },
  testShouldBeAbleToExcludeABundle: function() {
    var a = builder(opts).include('fixtures/dep1.js', 'fixtures/dep2.js'),
        result = builder(opts).include('fixtures/has_dep.js').exclude(a).toSource();
    assert.equal(
      "using('fixtures/dep1.js', 'fixtures/dep2.js');",
      result
    );
  },
  testShouldBeAbleToExcludeADeepDep: function() {
    var a = builder(opts).include('mod_with_dep'),
        result = builder(opts).include('mod_with_same_dep').exclude(a).toSource();
    assert.equal(
      "provide('mod_with_same_dep', function (exports) {\n    using('named', function () {\n        exports(3);\n    });\n});",
      result
    );
  },
  testShouldBeAbleToExcludeABundleWithoutBreakingCommonJS: function() {
    assert.equal(
      "define(\"bananas\",[\"module\",\"require\",\"exports\",\"anon\"],function(module, require, exports) {\nvar a = require('anon');\n});",
      builder(opts).include('bananas').exclude('anon').toSource()
    );
  },
  testShouldBeAbleToWriteToAFile: function() {
    var path = __dirname + '/bundle.js', expected = {};
    builder(opts).include('fixtures/simple.js', 'fixtures/simple2.js').write(path, function(manifest) {
      assert.equal("alert('hello world');\nalert('hello world again');",fs.readFileSync(path, 'utf8'));
      expected[path] = ["fixtures/simple.js","fixtures/simple2.js"];
      assert.deepEqual(expected, manifest);
      fs.unlinkSync(path);
    });
  },
  testShouldBeAbleToSuccessFullyLoadANamedModule: function() {
    assert.equal(
      "/*! license */\nprovide('named', function (exports) {\n    exports('hi');\n});",
      builder(opts).include('named').toSource()
    );
  }
};