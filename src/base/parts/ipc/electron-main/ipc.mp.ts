import { BrowserWindow, ipcMain, IpcMainEvent, MessagePortMain } from "electron";
import { Event } from "base/common/event";
import { IDisposable } from "base/common/lifecycle";
import { generateUuid } from "base/common/uuid";
import { Client as MessagePortClient } from "base/parts/ipc/common/ipc.mp";

/**
 * An implementation of a `IPCClient` on top of Electron `MessagePortMain`.
 */
export class Client extends MessagePortClient implements IDisposable {
  /**
   * @param clientId a way to uniquely identify this client among
   * other clients. this is important for routing because every
   * client can also be a server
   */
  constructor(port: MessagePortMain, clientId: string) {
    super(
      {
        addEventListener: (type, listener) => port.addListener(type, listener),
        removeEventListener: (type, listener) => port.removeListener(type, listener),
        postMessage: message => port.postMessage(message),
        start: () => port.start(),
        close: () => port.close(),
      },
      clientId
    );
  }
}

/**
 * This method opens a message channel connection
 * in the target window. The target window needs
 * to use the `Server` from `electron-sandbox/ipc.mp`.
 */
export async function connect(window: BrowserWindow): Promise<MessagePortMain> {
  // Assert healthy window to talk to
  if (window.isDestroyed() || window.webContents.isDestroyed()) {
    throw new Error("ipc.mp#connect: Cannot talk to window because it is closed or destroyed");
  }

  // Ask to create message channel inside the window
  // and send over a UUID to correlate the response
  const nonce = generateUuid();
  window.webContents.send("hi:createMessageChannel", nonce);

  // Wait until the window has returned the `MessagePort`
  // We need to filter by the `nonce` to ensure we listen
  // to the right response.
  const onMessageChannelResult = Event.fromNodeEventEmitter<{ nonce: string; port: MessagePortMain }>(ipcMain, "hi:createMessageChannelResult", (e: IpcMainEvent, nonce: string) => ({ nonce, port: e.ports[0] }));
  const { port } = await Event.toPromise(Event.once(Event.filter(onMessageChannelResult, e => e.nonce === nonce)));

  return port;
}
