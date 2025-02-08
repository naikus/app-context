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
    /** @type {[Webapp, Knex]} */
    const [webserver, db] = await context.dependency(["webserver", "persistence"]),
        service = createUserService(db);

    webserver.routes(router => {
      router.get("/users", (req, res) => {
        const users = service.findAll();
        res.send(users);
      });
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

Then in your main file, wire all the services. The order is not important, app-context will instantiate
your services in the right order.
```js
const webServer = require("./webserver"),
  persistence = require("./persistence"),
  auth = require("./auth"),
  users = require("./users"),
  AppContext = require("app-context"),
  context = AppContext.create();

// ....

// Later in your main start function
context.register(webServer)
  .register(auth)
  .register(users)
  .register(persistence)
  .register({
    name: "config",
    initialize: () => {
      property: "value"
    }
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


