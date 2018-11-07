#/bin/sh

echo "Cleaning core project"
rm -rf dist/ node_modules/ *.tgz

echo "Cleaning examples/angular2/"
rm -rf examples/angular2/coverage/ examples/angular2/node_modules/

echo "Cleaning examples/angularjs/"
rm -rf examples/angularjs/coverage/ examples/angularjs/node_modules/

echo "Cleaning examples/gulp/"
rm -rf examples/gulp/node_modules/ examples/gulp/src/bar/coverage/ examples/gulp/src/foo/coverage/

echo "Cleaning examples/mocha/"
rm -rf examples/mocha/coverage/ examples/mocha/node_modules/

echo "Cleaning examples/typescript-1.6.2/"
rm -rf examples/typescript-1.6.2/coverage/ examples/typescript-1.6.2/node_modules/

echo "Cleaning examples/typescript-latest/"
rm -rf examples/typescript-latest/coverage/ examples/typescript-latest/node_modules/

echo "Cleaning tests/integration-1.8.10/"
rm -rf tests/integration-1.8.10/coverage/ tests/integration-1.8.10/node_modules/

echo "Cleaning tests/integration-latest/"
rm -rf tests/integration-latest/coverage/ tests/integration-latest/node_modules/

echo "Cleaning transforms/angular/"
rm -rf transforms/angular/coverage/ transforms/angular/dist transforms/angular/node_modules/ transforms/angular/*.tgz

echo "Cleaning transforms/cssmodules/"
rm -rf transforms/cssmodules/coverage/ transforms/cssmodules/dist transforms/cssmodules/node_modules/ transforms/cssmodules/*.tgz

echo "Cleaning transforms/es6/"
rm -rf transforms/es6/coverage/ transforms/es6/dist transforms/es6/node_modules/ transforms/es6/*.tgz

echo "Cleaning transforms/postcss/"
rm -rf transforms/postcss/coverage/ transforms/postcss/dist transforms/postcss/node_modules/ transforms/postcss/*.tgz

echo "Done"