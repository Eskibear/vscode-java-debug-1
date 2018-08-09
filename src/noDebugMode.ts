// Copyright (c) Microsoft Corporation. All rights reserved.
// Licensed under the MIT license.

import { ChildProcess, spawn } from "child_process";
import * as Net from "net";
import * as path from "path";
import * as vscode from "vscode";
import { DebugSession, Event, InitializedEvent, OutputEvent, TerminatedEvent } from "vscode-debugadapter";
import { DebugProtocol } from "vscode-debugprotocol";

export class RunSession extends DebugSession {
    private _process: ChildProcess;
    private _server: Net.Server;

    public constructor() {
        super();
        this._server = Net.createServer((socket) => {
            this.setRunAsServer(true);
            this.start(<NodeJS.ReadableStream>socket, socket);
        }).listen(0);
    }

    public port() {
        return this._server.address().port;
    }

    protected initializeRequest(response: DebugProtocol.InitializeResponse, args: DebugProtocol.InitializeRequestArguments): void {
        console.log("initializeRequest");
        response.body = response.body || {};
        this.sendResponse(response);
        this.sendEvent(new InitializedEvent());
    }
    protected launchRequest(response: DebugProtocol.LaunchResponse, args: DebugProtocol.LaunchRequestArguments): void {
        console.log("launchRequest");
        const javaBinary: string = process.env.JAVA_HOME + path.sep + "bin" + path.sep + "java"; // What if JAVA_HOME not specified?
        const launchParams: string[] = constructLaunchParameters(args as any);

        this._process = spawn(javaBinary, launchParams);
        this._process.stdout.on("data", (data: string | Buffer): void => {
            console.log(data.toString());
            const e: DebugProtocol.OutputEvent = new OutputEvent(data.toString());
            this.sendEvent(e);
        });
        this._process.stderr.on("data", (data: string | Buffer) => {
            console.error(data.toString());
            const e: DebugProtocol.OutputEvent = new OutputEvent(data.toString());
            this.sendEvent(e);
        });
        this._process.on("error", (err: Error) => {
            const e: DebugProtocol.TerminatedEvent = new TerminatedEvent();
            this.sendEvent(e);
        });
        this._process.on("exit", (code: number, signal: string) => {
            this.sendEvent(new Event("exited", {exitCode: code}));
        });
    }
    protected disconnectRequest(response: DebugProtocol.DisconnectResponse, args: DebugProtocol.DisconnectArguments): void {
        console.log("disconnectRequest");
        if (this._process) {
            this._process.kill("SIGTERM");
        }
    }
}

function constructLaunchParameters(config: vscode.DebugConfiguration): string[] {
    const launchParams: string[] = [];
    // vmArgs
    if (config.vmArgs) {
        launchParams.push(config.vmArgs);
    }
    // modulePaths
    if (config.modulePaths && config.modulePaths.length) {
        launchParams.push("--module-path");
        launchParams.push(config.modulePaths.join(path.delimiter));
    }
    // classPaths
    if (config.classPaths && config.classPaths.length) {
        launchParams.push("-cp");
        launchParams.push(config.classPaths.join(path.delimiter));
    }
    // For java 9 project, should specify "-m $MainClass".
    const mainClasses: string[] = config.mainClass.split("/");
    if ((config.modulePaths && config.modulePaths.length) || mainClasses.length === 2) {
        launchParams.push("-m");
    }
    launchParams.push(config.mainClass)
    // args
    if (config.args) {
        launchParams.push(config.args);
    }
    return launchParams;
}

export function spawnJavaProcessWithoutDebugging(config: vscode.DebugConfiguration) {
    const session = new RunSession();
    return session.port();
    // const javaBinary: string = process.env.JAVA_HOME + path.sep + "bin" + path.sep + "java"; // What if JAVA_HOME not specified?

    // const launchParams: string[] = constructLaunchParameters(config);

    // return new Promise((resolve, reject) => {
    //     const javaProcess: ChildProcess = spawn(javaBinary, launchParams);
    //     javaProcess.stdout.on("data", (data: string | Buffer): void => {
    //         console.log(data.toString());
    //     });
    //     javaProcess.stderr.on("data", (data: string | Buffer) => {
    //         console.error(data.toString());
    //     });
    //     javaProcess.on("error", (err: Error) => {
    //         return reject(err);
    //     });
    //     javaProcess.on("exit", (code: number, signal: string) => {
    //         return resolve();
    //     });
    // });
}

// export async function spawnJavaProcessWithoutDebugging(config: vscode.DebugConfiguration) {

//     const javaBinary: string = process.env.JAVA_HOME + path.sep + "bin" + path.sep + "java"; // What if JAVA_HOME not specified?

//     const launchParams: string[] = constructLaunchParameters(config);

//     return new Promise((resolve, reject) => {
//         const javaProcess: ChildProcess = spawn(javaBinary, launchParams);
//         javaProcess.stdout.on("data", (data: string | Buffer): void => {
//             console.log(data.toString());
//         });
//         javaProcess.stderr.on("data", (data: string | Buffer) => {
//             console.error(data.toString());
//         });
//         javaProcess.on("error", (err: Error) => {
//             return reject(err);
//         });
//         javaProcess.on("exit", (code: number, signal: string) => {
//             return resolve();
//         });
//     });
// }
