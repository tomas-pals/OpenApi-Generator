import { bold, yellow } from 'kleur';
import load, { resolveSchema } from './load';
import { swaggerVersion } from './utils';
import { transformAll } from './transform/index';
import {GlobalContext, OpenAPI2, OpenAPI3, RootSchema, SchemaObject, SwaggerToTSOptions} from './types';
import {format, Options, resolveConfig} from 'prettier';
import parser from 'prettier/parser-typescript';
import path from 'path';
export * from './types'; // expose all types to consumers

export const WARNING_MESSAGE = `/**
* This file was auto-generated by openapi-typescript.
* Do not make direct changes to the file.
*/


`;

export default async function openapiTS(
    schema: string | OpenAPI2 | OpenAPI3 | Record<string, SchemaObject>,
    options: SwaggerToTSOptions = {} as any
): Promise<string> {
    const ctx: GlobalContext = {
        additionalProperties: options.additionalProperties || false,
        auth: options.auth,
        defaultNonNullable: options.defaultNonNullable || false,
        formatter:
            options && typeof options.formatter === 'function' ? options.formatter : undefined,
        immutableTypes: options.immutableTypes || false,
        rawSchema: options.rawSchema || false,
        version: options.version || 3
    } as any;

    // note: we may be loading many large schemas into memory at once; take care to reuse references without cloning

    // 1. load schema
    let rootSchema: RootSchema = {} as RootSchema;
    let external: Record<string, Record<string, any>> = {};
    if (typeof schema === 'string') {
        const schemaURL = resolveSchema(schema);
        if (options.silent === false)
            console.log(yellow(`🔭 Loading spec from ${bold(schemaURL.href)}…`));
        const schemas: Record<string, Record<string, any>> = {};
        await load(schemaURL, {
            ...ctx,
            schemas,
            rootURL: schemaURL // as it crawls schemas recursively, it needs to know which is the root to resolve everything relative to
        });
        for (const k of Object.keys(schemas)) {
            if (k === schemaURL.href) {
                rootSchema = schemas[k] as RootSchema;
            } else {
                external[k] = schemas[k];
            }
        }
    } else {
        rootSchema = schema as RootSchema;
    }
    ctx.rootSchema = rootSchema;
    // 2. generate raw output
    let output = WARNING_MESSAGE;

    // 2a. root schema
    if (!options?.version && !ctx.rawSchema) ctx.version = swaggerVersion(rootSchema as any); // note: root version cascades down to all subschemas
    output += transformAll(rootSchema, { ...ctx });
    // for (const k of Object.keys(rootTypes)) {
    //     if (typeof rootTypes[k] === 'string') {
    //         output += `export interface ${k} {\n  ${rootTypes[k]}\n}\n\n`;
    //     }
    // }

    // 2b. external schemas (subschemas)
    // output += `export interface external {\n`;
    // const externalKeys = Object.keys(external);
    // externalKeys.sort((a, b) => a.localeCompare(b, 'en', { numeric: true })); // sort external keys because they may have resolved in a different order each time
    // for (const subschemaURL of externalKeys) {
    //     output += `  "${subschemaURL}": {\n`;
    //     const subschemaTypes = transformAll(external[subschemaURL], {
    //         ...ctx,
    //         namespace: subschemaURL
    //     });
    //     for (const k of Object.keys(subschemaTypes)) {
    //         output += `    "${k}": {\n      ${subschemaTypes[k]}\n    }\n`;
    //     }
    //     output += `  }\n`;
    // }
    // output += `}\n\n`;

    // 3. Prettify
    let prettierOptions: Options = {
        parser: 'typescript',
        // plugins: [parser]
    };
    if (options && options.prettierConfig) {
        try {
            const userOptions = await resolveConfig(
                path.resolve(process.cwd(), options.prettierConfig)
            );
            prettierOptions = {
                ...(userOptions || {}),
                ...prettierOptions,
                // plugins: [
                    ...(prettierOptions.plugins as Plugin[]),
                    ...((userOptions && userOptions.plugins) || [])
                // ]
            };
        } catch (err) {
            console.error(`❌ ${err}`);
        }
    }
    return format(output, prettierOptions);
}