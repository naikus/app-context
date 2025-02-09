const AppContext = require("../lib/context"),
    dGraph = require("../lib/dgraph"),
    app = AppContext.create();

/*
const g = dGraph();
g.addV("a");
g.addV("b");
g.addV("c");
g.addV("d");
g.addV("e");
g.addV("f");

g.addE("a", "b");
g.addE("a", "c");
g.addE("a", "d");
g.addE("b", "c");
g.addE("b", "d");
g.addE("c", "d");
g.addE("d", "e");

// Circular dependency, will throw error
// g.addE("e", "a");
console.log(g.checkDeps("a"));
*/



app.on("module:", /** @param {string} mod */ (mod) => {
  console.log(`[Example] Loaded module ${mod}`);
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
  name: "module_a",
  async initialize(ctx) {
    const [modB, modC, modDFac] = await ctx.dependency(["module_b", "module_c", "module_d_factory"]);
    return {
      get name() {
        return `Module A`;
      }
    };
  }
});
app.register({
  name: "module_b",
  async initialize(ctx) {
    const [modC, modDFac] = await ctx.dependency(["module_c", "module_d_factory"]);

    /*
    ctx.once("module:module_a", mod => {
      console.log("[module_b] Got module_a:", mod.name);
    });
    */

    console.log("[module_b] module_c", modC.name);

    return delayReturn({
      get name() {
        return `Module B`;
      }
    });
  }
});
app.register({
  name: "module_c",
  async initialize(ctx) {
    // Circular dependency, will throw error
    /*
    ctx.dependency("module_b", (modB) => {
      console.log("found", modB.name);
    });
    */
    // Can't call start() from within a module, will throw error
    // ctx.start();

    // throw new Error("Raising error!");
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
  name: "module_d_factory",
  async initialize(ctx) {
    /** @type {Object|null|undefined} */
    const [modC] = await ctx.dependency("module_c");
    console.log("[module_d_factory] module_c", modC.title);
    /** @type {{
     *  name: string,
     *  sayHello(): string
     * }} 
     */
    let module;
    return function dFactory() {
      if(!module) {
        const modA = ctx.getModule("module_a");
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
app.dependency(["module_a"], (m) => {
  console.log("context.dependency() from outside a module:", m.name);
})
*/

app.start()
  .then(async () => {
    console.log("Ready!");
    const modFac = app.getModule("module_d_factory");
    // console.log(modFac);
    const mod = await modFac();
    console.log(mod.sayHello());
  })
  .catch(err => {
    console.error(err);
  });

