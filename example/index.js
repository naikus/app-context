const fs = require('fs');
const path = require('path');

const createAppContext = require("../lib/context"),
    app = createAppContext();


app.on(
  "module:",
  /**
   * @param {string} mod 
   */
  (mod) => {
    console.log(`[Example]  Loaded module ${mod}`);
  }
);


// Read the package.json file
const packageJsonPath = path.resolve(__dirname, '../package.json');
const packageJsonContent = fs.readFileSync(packageJsonPath, 'utf8');

// Parse the JSON content
const packageJson = JSON.parse(packageJsonContent);

// Access the dependencies
const dependencies = packageJson.dependencies;
const devDependencies = packageJson.devDependencies;

// Log the dependencies
// console.log(devDependencies);

// Register modules dynamically based on dependencies
/**
 * @param {Object} dependencies
 */

const registerModules = async (dependencies) => {
  if (!dependencies)
    return;
  const modulePromises = Object.keys(dependencies).map(dep => {
    return app.register({
      name: dep,
      initialize(ctx) {
        return {
          toString() {
            return dep;
          }
        };
      }
    });
  });

  await Promise.all(modulePromises);
};

// Register modules dynamically based on devDependencies
/**
 * @param {Object} devDependencies
 */
const registerDevModules = async (devDependencies) => {
  const modulePromises = Object.keys(devDependencies).map(dep => {
    return app.register({
      name: dep,
      initialize(ctx) {
        return {
          toString() {
            return dep;
          }
        };
      }
    });
  });

  await Promise.all(modulePromises);
};

// Register both dependencies and devDependencies
Promise.all([
  registerModules(dependencies),
  registerDevModules(devDependencies),
]).then(async () => {
  console.log("Ready!");
});



