// Generates the engine's API docs in code_docs/ with TypeDoc.
//
//   npm run docs
const {Application, TSConfigReader} = require("typedoc");

async function main() {
    const app = await Application.bootstrap(
        {
            entryPoints: ["base"],
            entryPointStrategy: "expand",
            exclude: ["**/{types,dist,code_docs,node_modules,static,scripts}/**/*.*"],
            name: "Sunspire Saga engine API",
            skipErrorChecking: true,
        },
        [new TSConfigReader()]
    );

    const project = await app.convert();
    if (!project) {
        throw new Error("TypeDoc conversion failed");
    }

    await app.generateDocs(project, "code_docs");
}

main().catch(err => {
    console.error(err);
    process.exit(1);
});
