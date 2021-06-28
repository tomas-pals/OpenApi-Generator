import {GlobalContext, ParameterObject, ReferenceObject, RootSchema} from "../types";
import {comment, getDescendantProp, nodeType, SchemaObjectType, tsReadonly} from "../utils";
import {transformSchemaObj} from "./schema";
import _ from 'lodash';

interface TransformParametersOptions extends GlobalContext {
  globalParameters?: Record<string, ParameterObject>;
}

export interface TransformedParameters{
  query: string;
  path: string;
}

export function transformParametersArray(
  parameters: (ReferenceObject | ParameterObject)[],
  schema: RootSchema,
  ctx: GlobalContext
): TransformedParameters {
  const readonly = tsReadonly(ctx.immutableTypes);

  // sort into map
  let mappedParams: Record<string, Record<string, ParameterObject>> = {};
  for (const paramObj of parameters as any[]) {
    if (paramObj.$ref) {
      const reference = getDescendantProp(schema, paramObj.$ref);
      if (reference) {
        if (!mappedParams[reference.in]) mappedParams[reference.in] = {};
            mappedParams[reference.in][reference.name] = {
              ...reference,
              schema: { $ref: paramObj.$ref },
            };
      }
      continue;
    }

    if (!paramObj.in || !paramObj.name) continue;
    if (!mappedParams[paramObj.in]) mappedParams[paramObj.in] = {};
    mappedParams[paramObj.in][paramObj.name] = paramObj;
  }

  // transform output
  const result: TransformedParameters = {
    query: '',
    path: ''
  }
  for (const [paramIn, paramGroup] of Object.entries(mappedParams)) {
    let output =  `  {\n`; // open in
    for (const [paramName, paramObj] of Object.entries(paramGroup)) {
      let paramComment = "";
      if (paramObj.deprecated) paramComment += `@deprecated `;
      if (paramObj.description) paramComment += paramObj.description;
      if (paramComment) output += comment(paramComment);

      const required = paramObj.required ? `` : `?`;
      let schemaToTransform: any = paramObj.schema;
      if(schemaToTransform.$ref){
        const ref = schemaToTransform.$ref ?? '';
        schemaToTransform = getDescendantProp(ctx.rootSchema, ref).schema;
        if (schemaToTransform.enum) {
          schemaToTransform.enumName = _.last(ref.split('.')) ?? '';
        }
      }
      let paramType = schemaToTransform
            ? transformSchemaObj(schemaToTransform, { ...ctx, required: new Set<string>() })
            : "unknown";
      output += `    ${readonly}"${paramName}"${required}: ${paramType};\n`;
    }
    output += `  }`; // close in
    result[paramIn as 'query' | 'path'] = output;
  }

  return result;
}
