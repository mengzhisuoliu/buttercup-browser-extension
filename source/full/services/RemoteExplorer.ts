import path from "path-posix";
import EventEmitter from "eventemitter3";
import { DropboxInterface, FileItem, FileSystemInterface } from "@buttercup/file-interface";
import { DropboxClient } from "@buttercup/dropbox-client";

export class RemoteExplorer extends EventEmitter {
    private __contents: Record<string, Array<FileItem> | null>;
    private __dir: string = "/";
    private __int: FileSystemInterface;
    private __root: string = "/";

    constructor(fsInt: FileSystemInterface) {
        super();
        this.__int = fsInt;
    }

    changeDirectory(newDir: string) {}

    protected loadDirectory(newDir: string): void {}
}

export function initialiseDropboxExplorer(dropboxToken: string) {
    const dropboxClient = new DropboxClient(dropboxToken, {
        compat: true,
        compatCorsHack: true
    });
    const dbInt = new DropboxInterface({ dropboxClient });
    return new RemoteExplorer(dbInt);
}
