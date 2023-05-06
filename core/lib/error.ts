import { prepareJson } from "./utils";

export const baseResp = function(errno: ErrCode, message: string, data: string) {
  return { errno: errno, message: message, data: data };
}

export const succResp = function(data: any) {
  data = prepareJson(data);
  return baseResp(0, "", data);
}

export const errResp = function(errno: ErrCode, message: string) {
  return baseResp(errno, message, "");
}

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
  CryptoError = 4,
  DBCreateError = 5,
  DuplicatedRecordError = 6,
  RecordNotExist = 7,
  InvalidProof = 8
}

