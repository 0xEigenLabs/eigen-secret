import { httpTerminator, server } from "./app";
import { Response } from "express";
import { AppError } from "@eigen-secret/core/dist-node/error";

class ErrorHandler {
  public handleError(error: Error | AppError, response?: Response): void {
    if (this.isTrustedError(error) && response) {
      this.handleTrustedError(error as AppError, response);
    } else {
      this.handleUntrustedError(error, response);
    }
  }

  public isTrustedError(error: Error): boolean {
    if (error instanceof AppError) {
      return error.isOperational;
    }

    return false;
  }

  private handleTrustedError(error: AppError, response: Response): void {
    response.json(error);
  }

  private handleUntrustedError(error: Error | AppError, response?: Response): void {
    if (response) {
      response.json(error);
    }

    console.log("Application encountered an untrusted error.");
    console.log(error);
    exitHandler.handleExit(1);
  }
}

const errorHandler = new ErrorHandler();

class ExitHandler {
  public async handleExit(code: number, timeout = 5000): Promise<void> {
    try {
      console.log(`Attempting a graceful shutdown with code ${code}`);

      setTimeout(() => {
        console.log(`Forcing a shutdown with code ${code}`);
        process.exit(code);
      }, timeout).unref();

      if (server.listening) {
        console.log("Terminating HTTP connections");
        await httpTerminator.terminate();
      }

      console.log(`Exiting gracefully with code ${code}`);
      process.exit(code);
    } catch (error) {
      console.log("Error shutting down gracefully");
      console.log(error);
      console.log(`Forcing exit with code ${code}`);
      process.exit(code);
    }
  }
}

process.on("unhandledRejection", (reason: Error | any) => {
  console.log(`Unhandled Rejection: ${reason.message || reason}`);

  throw new Error(reason.message || reason);
});

process.on("uncaughtException", (error: Error) => {
  console.log(`Uncaught Exception: ${error.message}`);

  errorHandler.handleError(error);
});

const exitHandler = new ExitHandler();
process.on("SIGTERM", () => {
  console.log(`Process ${process.pid} received SIGTERM: Exiting with code 0`);
  exitHandler.handleExit(0);
});

process.on("SIGINT", () => {
  console.log(`Process ${process.pid} received SIGINT: Exiting with code 0`);
  exitHandler.handleExit(0);
});
