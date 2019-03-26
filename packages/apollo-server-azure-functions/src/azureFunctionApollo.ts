import {
  Context,
  HttpRequest
} from '@azure/functions';
import { HttpResponse } from 'azure-functions-ts-essentials';
import {
  GraphQLOptions,
  HttpQueryError,
  runHttpQuery,
} from 'apollo-server-core';
import { Headers, ValueOrPromise } from 'apollo-server-env';

export interface AzureFunctionGraphQLOptionsFunction {
  (request: HttpRequest, context: Context): ValueOrPromise<
    GraphQLOptions
  >;
}

export interface AzureFunctionHandler {
  (
    context: Context,
    request: HttpRequest,
    callback: (err?: any, output?: HttpResponse) => void,
  ): void;
}

export function graphqlAzureFunction(
  options: GraphQLOptions | AzureFunctionGraphQLOptionsFunction,
): AzureFunctionHandler {
  if (!options) {
    throw new Error('Apollo Server requires options.');
  }

  if (arguments.length > 1) {
    throw new Error(
      `Apollo Server expects exactly one argument, got ${arguments.length}`,
    );
  }

  const graphqlHandler: AzureFunctionHandler = (
    context,
    request,
    callback,
  ): void => {
    if (request.method === 'POST' && !request.body) {
      callback(null, {
        body: 'POST body missing.',
        status: 500,
      });
      return;
    }
    runHttpQuery([request, context], {
      method: request.method,
      options: options,
      query:
        request.method === 'POST' && request.body
          ? request.body
          : request.query,
      request: {
        url: request.url,
        method: request.method,
        headers: new Headers(request.headers),
      },
    }).then(
      ({ graphqlResponse, responseInit }) => {
        callback(null, {
          body: graphqlResponse,
          status: 200,
          headers: responseInit.headers,
        });
      },
      (error: HttpQueryError) => {
        if ('HttpQueryError' !== error.name) {
          callback(error);
        } else {
          callback(null, {
            body: error.message,
            status: error.statusCode,
            headers: error.headers,
          });
        }
      },
    );
  };

  return graphqlHandler;
}
