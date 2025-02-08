const createAppContext = require("../lib/context"),
    dGraph = require("../lib/dgraph"),
    app = createAppContext();

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
    const modC = await ctx.dependency(["module_c", "module_d_factory"]);

    ctx.once("module:module_a", mod => {
      console.log("[module_b] Got module_a:", mod.name);
    });

    return delayReturn({
      get name() {
        return `Module B`;
      }
    });
  }
});
app.register({
  name: "module_c",
  initialize(ctx) {
    // Circular dependency, will throw error
    /*
    ctx.dependency("module_b", (modB) => {
      console.log("found", modB.name);
    });
    */
    // Can't call start() from within a module, will throw error
    // ctx.start();
    return {
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
    const modA = await ctx.dependency("module_a");
    /** @type {{
     *  name: string,
     *  sayHello(): string
     * }} 
     */
    let module;
    return () => {
      if(!module) {
        const modA = ctx.getModule("module_a");
        module = {
          name: "MODULE_D",
          sayHello() {
            return `Hello from ${modA.name}`;
          }
        };
      }
      return module;
    };
  }
});

app.dependency(["module_a"], (m) => {
  console.log("found", m.name);
})

app.start().then(async () => {
  console.log("Ready!");
  const modFac = app.getModule("module_d_factory");
  // console.log(modFac);
  const mod = await modFac();
  console.log(mod.sayHello());
});

