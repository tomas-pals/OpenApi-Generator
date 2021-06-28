const fs = require('fs');
const path = require('path');
import meow from 'meow';
import openapiTS from './index';
const timeStart = process.hrtime();


const cli = meow(
	`Usage
  $ openapi-typescript [input] [options]

Options
  --help                       display this
  --output, -o                 Specify output file (default: stdout)
  --name, -n                 Specify name of Api
  --auth                       (optional) Provide an authentication token for private URL
  --immutable-types, -it       (optional) Generates immutable types (readonly properties and readonly array)
  --additional-properties, -ap (optional) Allow arbitrary properties for all schema objects without "additionalProperties: false"
  --default-non-nullable       (optional) If a schema object has a default value set, don’t mark it as nullable
  --prettier-config, -c        (optional) specify path to Prettier config file
  --raw-schema                 (optional) Parse as partial schema (raw components)
  --version                    (optional) Force schema parsing version
`,
	{
		flags: {
			output: {
				type: "string",
				alias: "o",
			},
			name: {
				type: "string",
				alias: 'n'
			},
			auth: {
				type: "string",
			},
			immutableTypes: {
				type: "boolean",
				alias: "it",
			},
			defaultNonNullable: {
				type: "boolean",
			},
			additionalProperties: {
				type: "boolean",
				alias: "ap",
			},
			prettierConfig: {
				type: "string",
				alias: "c",
			},
			rawSchema: {
				type: "boolean",
			},
			version: {
				type: "number",
			},
		},
	}
);

const OUTPUT_FILE = "FILE";
const OUTPUT_STDOUT = "STDOUT";

async function main() {
	const output = cli.flags.output ? OUTPUT_FILE : OUTPUT_STDOUT; // FILE or STDOUT
	const pathToSpec = cli.input[0];
	if(!pathToSpec){
		return;
	}
	const result = await openapiTS(pathToSpec, {
		additionalProperties: cli.flags.additionalProperties,
		auth: cli.flags.auth,
		defaultNonNullable: cli.flags.defaultNonNullable,
		immutableTypes: cli.flags.immutableTypes,
		prettierConfig: cli.flags.prettierConfig,
		rawSchema: cli.flags.rawSchema,
		silent: output === OUTPUT_STDOUT,
		version: cli.flags.version,
	});

	// output
	let outputFile = path.resolve(process.cwd(), 'appApi.ts'); // note: may be directory
	const isDir = fs.existsSync(outputFile) && fs.lstatSync(outputFile).isDirectory();
	if (isDir) {
		const filename = pathToSpec.replace(
			new RegExp(`${path.extname(pathToSpec)}$`),
			'.ts'
		);
		outputFile = path.join(outputFile, filename);
	}

	await fs.promises.writeFile(outputFile, result, 'utf8');

	const timeEnd = process.hrtime(timeStart);
	const time = timeEnd[0] + Math.round(timeEnd[1] / 1e6);
	console.log(`🚀 ${pathToSpec} -> ${outputFile} [${time}ms]`);

	return result;
}

main();
