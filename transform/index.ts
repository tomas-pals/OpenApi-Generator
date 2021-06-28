import {GlobalContext, OperationObject, RootSchema} from '../types';
import {tsReadonly} from '../utils';
import _ from 'lodash';
import {transformSchemaObj} from './schema';
import {TransformedParameters, transformParametersArray} from './parameters';

export interface Parameter{
    name: string;
    type: string;
    description: string;
}

export class Endpoint{
    path = '';
    name = '';
    parameters:TransformedParameters = {} as TransformedParameters;
    body = '';
    response = '';
}

export function transformAll(schema: RootSchema, ctx: GlobalContext): string {
    const readonly = tsReadonly(ctx.immutableTypes);

    const endpoints: Endpoint[] = [];

    const transformSchemaObjOptions = {...ctx, required: new Set<string>([])};
    for (const path of Object.keys(schema.paths)) {
        const schemaEndpoints = schema.paths[path];
        for (const value of Object.values(schemaEndpoints)) {
            const schemaEndpoint: OperationObject = value;
            const endpoint = new Endpoint();
            endpoints.push(endpoint);
            endpoint.path = path;
            endpoint.name = _.upperFirst(schemaEndpoint.operationId);
            if(schemaEndpoint.parameters) {
                endpoint.parameters = transformParametersArray(schemaEndpoint.parameters, schema, {...ctx});
            }
            if(schemaEndpoint.responses) {
                const successfulResponseKey = schemaEndpoint.responses.hasOwnProperty('201') ? '201' : '200'
                const responseSchema = (schemaEndpoint.responses[successfulResponseKey] as any)['content']['application/json']['schema'];
                endpoint.response = transformSchemaObj(responseSchema, transformSchemaObjOptions);
            }
            if(schemaEndpoint.requestBody){
                const bodySchema = (schemaEndpoint.requestBody as any)['content']['application/json']['schema'];
                endpoint.body= transformSchemaObj(bodySchema, transformSchemaObjOptions)
            }
        }
    }

    console.log(endpoints);

    const output: string[] = [];
    const add = (line: string) => output.push(line);

    add('export type ValueForEndPoint<T extends Endpoint, TKey extends keyof TDefinition, TDefinition = ApiDefinition> = TDefinition extends {\n    endpoint: T;\n}\n    ? Pick<TDefinition, TKey>[TKey]\n    : never;')
    const properties = ['path', 'query', 'body', 'response']
    for (const property of properties) {
        add(`export type ${_.upperFirst(property)}<T extends Endpoint> = ValueForEndPoint<T, '${property}'>`)
    }

    add(`\nexport enum Endpoint {`);
    for (const endpoint of endpoints) {
        add(`    ${endpoint.name} = '${endpoint.name}',`);
    }
    add('}\n');

    add(`export const Paths: { [key in Endpoint]: string } = {`);
    for (const endpoint of endpoints) {
        add(`    [Endpoint.${endpoint.name}]: '${endpoint.path}',`);
    }
    add('};\n')

    add('export type ApiDefinition =');

    for (const endpoint of endpoints) {
        const queryParameters = !!endpoint.parameters.query ? endpoint.parameters.query : 'undefined'
        const pathParameters = !!endpoint.parameters.path ? endpoint.parameters.path :'undefined'
        add(`    | {
    endpoint: Endpoint.${endpoint.name};
    query: ${queryParameters}
    path: ${pathParameters}
    body: ${!!endpoint.body ? endpoint.body : 'undefined'};
    response: ${endpoint.response};
    }`);
    }

    if (schema.components?.schemas) {
        for (const componentName of Object.keys(schema.components.schemas)) {
            const componentSchema: any = schema.components.schemas[componentName];
            if(componentSchema.enum){
                const items: string[] = [];
                (componentSchema.enum as unknown[]).forEach((item) => {
                    if (typeof item === "string") items.push(`${item.replace(/'/g, "\\'")}`);
                    else if (typeof item === "number" || typeof item === "boolean") items.push(item.toString());
                    else if (item === null && !componentSchema.nullable) items.push("null");
                });
                add(`export enum ${componentName} {`);
                for (const item of items) {
                    add(`${item.split('_').map(x => _.capitalize(x)).join('')} = '${item}',`)
                }
                add(`}`);
            } else {
                add(`export type ${componentName} = ${transformSchemaObj(componentSchema, transformSchemaObjOptions)}`);
            }
        }
    }

    return output.join('\n');
    // let operations: Record<string, { operation: OperationObject; pathItem: PathItemObject }> = {};
    //
    // // --raw-schema mode
    // if (ctx.rawSchema) {
    //     const required = new Set(Object.keys(schema));
    //     switch (ctx.version) {
    //         case 2: {
    //             output.definitions = transformSchemaObjMap(schema, { ...ctx, required });
    //             return output;
    //         }
    //         case 3: {
    //             output.schemas = transformSchemaObjMap(schema, { ...ctx, required });
    //             return output;
    //         }
    //     }
    // }
    //
    // // #/paths (V2 & V3)
    // output.paths = ''; // open paths
    // if (schema.paths) {
    //     output.paths += transformPathsObj(schema.paths, {
    //         ...ctx,
    //         globalParameters:
    //             (schema.components && schema.components.parameters) || schema.parameters,
    //         operations
    //     });
    // }
    //
    // switch (ctx.version) {
    //     case 2: {
    //         // #/definitions
    //         if (schema.definitions) {
    //             output.definitions = transformSchemaObjMap(schema.definitions, {
    //                 ...ctx,
    //                 required: new Set(Object.keys(schema.definitions))
    //             });
    //         }
    //
    //         // #/parameters
    //         if (schema.parameters) {
    //             output.parameters = transformSchemaObjMap(schema.parameters, {
    //                 ...ctx,
    //                 required: new Set(Object.keys(schema.parameters))
    //             });
    //         }
    //
    //         // #/parameters
    //         if (schema.responses) {
    //             output.responses = transformResponsesObj(schema.responses, ctx);
    //         }
    //         break;
    //     }
    //     case 3: {
    //         // #/components
    //         output.components = '';
    //
    //         if (schema.components) {
    //             // #/components/schemas
    //             if (schema.components.schemas) {
    //                 output.components += `  ${readonly}schemas: {\n    ${transformSchemaObjMap(
    //                     schema.components.schemas,
    //                     {
    //                         ...ctx,
    //                         required: new Set(Object.keys(schema.components.schemas))
    //                     }
    //                 )}\n  }\n`;
    //             }
    //
    //             // #/components/responses
    //             if (schema.components.responses) {
    //                 output.components += `  ${readonly}responses: {\n    ${transformResponsesObj(
    //                     schema.components.responses,
    //                     ctx
    //                 )}\n  }\n`;
    //             }
    //
    //             // #/components/parameters
    //             if (schema.components.parameters) {
    //                 output.components += `  ${readonly}parameters: {\n    ${transformSchemaObjMap(
    //                     schema.components.parameters,
    //                     {
    //                         ...ctx,
    //                         required: new Set(Object.keys(schema.components.parameters))
    //                     }
    //                 )}\n  }\n`;
    //             }
    //
    //             // #/components/requestBodies
    //             if (schema.components.requestBodies) {
    //                 output.components += `  ${readonly}requestBodies: {\n    ${transformRequestBodies(
    //                     schema.components.requestBodies,
    //                     ctx
    //                 )}\n  }\n`;
    //             }
    //
    //             // #/components/headers
    //             if (schema.components.headers) {
    //                 output.components += `  ${readonly}headers: {\n    ${transformHeaderObjMap(
    //                     schema.components.headers,
    //                     {
    //                         ...ctx,
    //                         required: new Set<string>()
    //                     }
    //                 )}\n  }\n`;
    //             }
    //         }
    //         break;
    //     }
    // }
    //
    // // #/operations
    // output.operations = '';
    // if (Object.keys(operations).length) {
    //     for (const id of Object.keys(operations)) {
    //         const { operation, pathItem } = operations[id];
    //         if (operation.description) output.operations += comment(operation.description); // handle comment
    //         output.operations += `  ${readonly}"${id}": {\n    ${transformOperationObj(operation, {
    //             ...ctx,
    //             pathItem,
    //             globalParameters:
    //                 (schema.components && schema.components.parameters) || schema.parameters
    //         })}\n  }\n`;
    //     }
    // }
    //
    // // cleanup: trim whitespace
    // for (const k of Object.keys(output)) {
    //     if (typeof output[k] === 'string') {
    //         output[k] = output[k].trim();
    //     }
    // }
    //
    // return output;
}
