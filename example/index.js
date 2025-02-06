const createAppContext = require("../lib/context"),
    dGraph = require("../lib/dgraph"),
    app = createAppContext();


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
g.addE("c", "d");
g.addE("d", "e");
// g.addE("e", "a");

// console.log(g.checkDeps("a").reverse().join("->"));




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
        return `MODULE_A <-> ${modDFac().toString()}`;
      },
      toString() {
        return `modA`;
      }
    };
  }
});
app.register({
  name: "module_b",
  async initialize(ctx) {
    const modC = await ctx.dependency(["module_c"]);
    return delayReturn({
      get name() {
        return `MODULE_B <-> ${modC.toString()}`;
      },
      toString() {
        return `modB`;
      }
    });
  }
});
app.register({
  name: "module_c",
  initialize(ctx) {
    return {
      toString() {
        return "modC";
      }
    };
  }
});
// Workaround for circular deps, create a factory
app.register({
  name: "module_d_factory",
  async initialize(ctx) {
    /** @type {Object|null|undefined} */
    // const modA = await ctx.dependency("module_a");
    /** @type {{
     *  name: string,
     *  toString(): string
     * }} 
     */
    let module;
    return () => {
      if(!module) {
        const modA = ctx.getModule("module_a");
        module = {
          name: "MODULE_D",
          toString() {
            return `[modD circular dep: ${modA}]`;
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
  console.log(mod.toString());
});

