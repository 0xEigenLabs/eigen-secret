import { prepareJson } from "./utils";

export const succResp = function(data: any) {
  data = prepareJson(data);
  return new AppError({ errno: 0, data: data });
}

export const errResp = function(errno: ErrCode, message: string) {
  return new AppError({ errno: errno, message: message });
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

interface AppErrorArgs {
  data?: any;
  errno: ErrCode;
  message?: string;
  isOperational?: boolean;
}

export class AppError extends Error {
  public readonly message: string;
  public readonly data: any;
  public readonly errno: ErrCode;
  // set isOperational to false when throwing a critical error.
  public readonly isOperational: boolean = true;

  static errCodeToString: Record<ErrCode, string> = {
    [ErrCode.Success]: "Success",
    [ErrCode.Unknown]: "Unknown",
    [ErrCode.InvalidAuth]: "InvalidAuth",
    [ErrCode.InvalidInput]: "InvalidInput",
    [ErrCode.CryptoError]: "CryptoError",
    [ErrCode.DBCreateError]: "DBCreateError",
    [ErrCode.DuplicatedRecordError]: "DuplicatedRecordError",
    [ErrCode.RecordNotExist]: "RecordNotExist",
    [ErrCode.InvalidProof]: "InvalidProof"
  };

  constructor(args: AppErrorArgs) {
    super(args.message);

    Object.setPrototypeOf(this, new.target.prototype);

    this.message = args.message || AppError.errCodeToString[args.errno];
    this.errno = args.errno;
    this.data = args.data || "";

    if (args.isOperational !== undefined) {
      this.isOperational = args.isOperational;
    }

    Error.captureStackTrace(this);
  }
}

