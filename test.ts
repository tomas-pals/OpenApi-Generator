import openapiTS from './index';
import fs from 'fs';
import path from 'path';

const timeStart = process.hrtime();
async function main() {
    const result = await openapiTS('app-api.yaml', {
        prettierConfig: '.prettierrc'
    });

    // output
    let outputFile = path.resolve(process.cwd(), 'appApi.ts'); // note: may be directory
    const isDir = fs.existsSync(outputFile) && fs.lstatSync(outputFile).isDirectory();
    if (isDir) {
        const filename = 'app-api.yaml'.replace(
            new RegExp(`${path.extname('app-api.yaml')}$`),
            '.ts'
        );
        outputFile = path.join(outputFile, filename);
    }

    await fs.promises.writeFile(outputFile, result, 'utf8');

    const timeEnd = process.hrtime(timeStart);
    const time = timeEnd[0] + Math.round(timeEnd[1] / 1e6);
    console.log(`🚀 ${'app-api.yaml'} -> ${outputFile} [${time}ms]`);

    return result;
}

main();
