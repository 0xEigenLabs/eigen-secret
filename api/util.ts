// util.ts
/**
 * Provide some useful utility functions
 *
 * @module util
 */

import consola from "consola";

const require_env_variables = (envVars: Array<string>) => {
  for (const envVar of envVars) {
    if (!process.env[envVar]) {
      throw new Error(`Error: set your '${envVar}' environmental variable `);
    }
  }
  consola.success("Environmental variables properly set 👍");
};

const BaseResp = function (errno: ErrCode, message: string, data: string) {
  return { errno: errno, message: message, data: data };
};
const Succ = function (data: any) {
  return BaseResp(0, "", data);
};
const Err = function (errno: ErrCode, message: string) {
  return BaseResp(errno, message, "");
};

/**
 * Error code for a JSON responce.
 *
 * @enum
 */
export enum ErrCode {
  Success = 0,
  Unknown = 1,
  InvalidAuth = 2,
  InvalidInput = 3,
  CryptoError = 4
}

const has_value = function (variable: any) {
  if (variable === undefined) {
    return false;
  }
  if (typeof variable === "string" && variable.trim() === "") {
    return false;
  }
  return true;
};

export { BaseResp, Succ, Err, has_value, require_env_variables };
