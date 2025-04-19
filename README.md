## app-context
A tiny, dead simple context &amp; dependency container for node-js applications. Now checks for
missing modules and cyclic dependencies

### Usage

In your package.json, add it as a dependency
```json5
{
  "name": "my-app",
  "version": "1.0.0",
  "description": "My Application",
  "main": "index.js"
  // ...
  "dependencies": {
    // ...other deps
    "app-context": "github:naikus/app-context#error-reporting"
  }
}
```


Define a module/service or multiple services (in their own files)
```js
// File users/index.js
const createUserService = require("./service");
/**
 * @type {ModuleDefn}
 */
module.exports = {
  name: "users",
  /**
   * Initializes the users module
   * @param {AppContext} context The application context
   */
  async initialize(context) {
    // "api-router" & "persistence" are modules that are registered with the app context elsewhere
    const [apiRouter, db] = await context.dependency(["api-router", "db"]),
        service = createUserService(db);

    // Alternatively you can also use the following syntax
    context.dependency(["api-router", "db"], (apiRouter, db) => {
      // Do something
    });

    // Get notified for events from context or other modules
    const unsub = context.on("some:event", data => {
      // do something
    });

    // Emit events
    context.emit("users:add", {name: "Alice"});
    
    // Whatever you return here will me made available via context.getModule(name) which is safe
    // to call after context has started
    // const userService = context.getModule("users");
    return service;
  }
};
```


Then in your main file, wire all the modules. The order is not important, app-context will instantiate
your modules in the right order.
```js
const apiRouter = require("./api-router"),
  db = require("./db"),
  users = require("./users");

const AppContext = require("app-context"),
  context = AppContext.create();

// ....

// Later in your main start function
context.register(users)
  .register(apiRouter)
  .register(db)
  // You can also register inline modules
  .register({
    name: "config",
    initialize: () => ({
      property: "value"
    })
  });

try {    
  await context.start();
  logger.info("Application started 🚀");
  context.emit("app:initialize");
}catch(error) {
  logger.error("Application failed to start", error);
  process.exit(1);
};
```


### How to get around cyclic dependencies
If your modules depend on one another, i.e. cyclic dependencies, you can get around by registering an
event listener on app-context
```js
  const context = AppContex.create();
  context.register({
    name: "module_a",
    async initialize(ctx) {
      const [moduleB] = await ctx.dependency("module_b");
      // Do something with moduleB...
      moduleB.sayHello();
  
      // Return the actual module
      return {
        sayHello() {
          console.log("Hello from module_a");
        }
      };
    }
  });
  
  context.register({
    name: "module_b",
    async initialize(ctx) {
      // This will throw error (cyclic dependencies)
      // const [moduleA] = await ctx.dependency("module_a");

      // Instead do this:
      ctx.once("module:module_a", moduleA => {
        // module_a is now available
      });
  
      // Return the actual module
      return {
        sayHello() {
          console.log("Hello from module_b");
        }
      };
    }
  });
  context.start();

```

