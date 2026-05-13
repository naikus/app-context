const createAppContext = require("../lib/context"),
    dGraph = require("../lib/dgraph"),
    app = createAppContext();

app.on("module:", /** @param {string} mod */ (mod, data) => {
  console.log(`[Example]    Loaded module ${mod}`, data.name);
});

/**
 * @template T
 * @param {T} object
 * @param {number} ms
 * @return {Promise<T>}
 */
async function delayReturn(object, ms = 1000) {
  return new Promise(res => {
    setTimeout(() => {
      res(object);
    }, ms);
  });
}


app.register({
  name: "mod-a",
  async initialize(ctx) {
    const [modB, modC, modDFac] = await ctx.dependency(["mod-b", "mod-c", "mod-d-fac"]);
    return {
      get name() {
        return `Module A`;
      }
    };
  }
});
app.register({
  name: "mod-b",
  async initialize(ctx) {
    const [modC, modDFac] = await ctx.dependency(["mod-c", "mod-d-fac"]);

    /*
    ctx.once("module:mod-a", mod => {
      console.log("[mod-b] Got mod-a:", mod.name);
    });
    */

    console.log("[mod-b]      mod-c", modC.name);

    return delayReturn({
      get name() {
        return `Module B`;
      }
    });
  }
});
app.register({
  name: "mod-c",
  async initialize(ctx) {
    // cyclic dependency, will throw error
    /*
    ctx.dependency("mod-b", (modB) => {
      console.log("found", modB.name);
    });
    */
    // Can't call start() from within a module, will throw error
    // ctx.start();

    // Modules can also register new modules, these will be initialized immediately
    ctx.register({
      name: "mod-c:child",
      async initialize(c) {
        const [mc] = await c.dependency("mod-c");
        return {
          name:"Module C:Child"
        }
      }
    });

    // This will also throw cyclic dependency error
    /*
    ctx.dependency("mod-c:child", (modB) => {
      console.log("found", modB.name);
    });
    */

    ctx.once("module:mod-d-fac", dFac => {
      const modD = dFac();
      console.log("[mod-c]     ", modD.sayHello());
    });
    
    return {
      title: "Hello",
      get name() {
        return "Module C";
      }
    };
  }
});
// Workaround for circular deps, create a factory
app.register({
  name: "mod-d-fac",
  async initialize(ctx) {
    /** @type {Object|null|undefined} */
    const [modC] = await ctx.dependency("mod-c");
    console.log("[mod-d-fac]  mod-c", modC.title);
    /** @type {{
     *  name: string,
     *  sayHello(): string
     * }} 
     */
    let module;
    return function dFactory() {
      if(!module) {
        const modA = ctx.getModule("mod-c");
        module = {
          name: "Module D",
          sayHello() {
            return `Hello to ${modA.name}`;
          }
        };
      }
      return module;
    };
  }
});

// Call dependency() from outside a module
/*
app.dependency(["mod-a"], (m) => {
  console.log("context.dependency() from outside a module:", m.name);
})
*/

app.start()
  .then(async () => {
    console.log("Ready!");
  })
  .catch(err => {
    console.error(err);
  });

