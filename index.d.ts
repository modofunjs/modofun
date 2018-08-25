/*!
 * modofun
 * Copyright (c) 2018 Filipe Tavares
 * MIT Licensed
 */

export = modofun;

interface Func {
  (...args: any[]): any;
}

interface Handlers {
  [key: string]: Func | (Middleware | Func)[],
}

interface Middleware {
  (request: any, response: any, next?: (err?: any) => void): void;
}

interface Options {
  type?: 'gcloud' | 'aws' | 'azure';
  mode?: 'function' | 'reqres';
  middleware?: Middleware[];
  checkArity?: boolean;
  errorHandler?: (error: any, request: any, response: any) => void;
}

declare function modofun(handlers: Handlers, options: Options): Func;

declare function modofun(handlers: Handlers, middleware?: Middleware[]): Func;

declare namespace modofun {
  function arity(amount: number): Middleware;
}
