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


Promise.all([
  app.register({
    name: "module_a",
    async initialize(ctx) {
      const [modB, modC, modDFac] = await ctx.dependency(["module_b", "module_c", "module_d_factory"]);
      return {
        get name() {
          return `MODULE_A <-> ${modDFac().name}`;
        },
        toString() {
          return `modA ${modB} ${modC}`;
        }
      };
    }
  }),
  app.register({
    name: "module_b",
    initialize(ctx) {
      return new Promise((res, reject) => {
        ctx.dependency("module_c", modC => {
          console.log(`[module_b] Loading...`);
          setTimeout(_ => {
            console.log(`[module_b] Done!`);
            res({
              toString() {
                return `[modB ${modC}]`;
              }
            });
          }, 1000);
        });
      });
    }
  }),
  app.register({
    name: "module_c",
    initialize(ctx) {
      return {
        toString() {
          return "modC";
        }
      };
    }
  }),
  // Workaround for circular deps, create a factory
  app.register({
    name: "module_d_factory",
    initialize(ctx) {
      /** @type {Object|null|undefined} */
      let module;
      return () => {
        if(!module) {
          const modA = ctx.getModule("module_a");
          module = {
            name: "MODULE_D",
            toString() {
              return `[modD circular dep: ${modA.name}]`;
            }
          };
        }
        return module;
      };
    }
  })
]).then(async () => {
  console.log("Ready!");
  const modFac = app.getModule("module_d_factory"),
      mod = await modFac();
  console.log(mod.toString());
});



