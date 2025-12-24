import { build, BuildOptions } from "esbuild";
import { statSync } from "node:fs";
import { resolve } from "node:path";
import { format } from "./pretty-bytes";
import { green } from "console-log-colors";

interface Options extends BuildOptions {
	outfile: string;
}

const options: Options = {
	entryPoints: ["./src/index.ts"],
	minify: false,
	bundle: true,
	outfile: "./dist/index.js",
	target: "node22",
	platform: "node",
	format: "cjs",
	sourcemap: true,
};

// Log success message
const logSuccess = () => {
	const outfile = options.outfile;
	const distSize = statSync(resolve(outfile)).size;
	console.log(`${format(distSize)}    ${outfile}`);
	console.log("\u{2714}" + green(" Finished successfully!"));
};

// Build and log result
build(options)
	.catch((err) => {
		console.error(err);
		process.exit(1);
	})
	.then(logSuccess);
