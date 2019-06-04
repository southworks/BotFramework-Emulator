//
// Copyright (c) Microsoft. All rights reserved.
// Licensed under the MIT license.
//
// Microsoft Bot Framework: http://botframework.com
//
// Bot Framework Emulator Github:
// https://github.com/Microsoft/BotFramwork-Emulator
//
// Copyright (c) Microsoft Corporation
// All rights reserved.
//
// MIT License:
// Permission is hereby granted, free of charge, to any person obtaining
// a copy of this software and associated documentation files (the
// "Software"), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED ""AS IS"", WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

import { LogLevel, textItem } from '@bfemulator/sdk-shared';
import { newNotification, SharedConstants } from '@bfemulator/app-shared';
import { CommandServiceImpl, CommandServiceInstance } from '@bfemulator/sdk-shared';

import { emulatorApplication } from './main';
import { RestServer } from './restServer';

/**
 * Communicates with the bot.
 */
export class BotFrameworkService {
  @CommandServiceInstance()
  private commandService: CommandServiceImpl;

  public server: RestServer;
  private _serverUrl: string;
  private _serverPort: number;

  public get serverUrl() {
    return this._serverUrl;
  }

  public get serverPort() {
    return this._serverPort;
  }

  /**
   * Applies configuration changes.
   */
  public async recycle(port: number) {
    if (this.server) {
      await this.server.close();
    }

    this.server = new RestServer();
    try {
      const { url, port: serverChosenPort } = await this.server.listen(port);

      this._serverUrl = url;
      this._serverPort = serverChosenPort;
    } catch (e) {
      if (e.code === 'EADDRINUSE') {
        const notification = newNotification(
          `Port ${port} is in use and the Emulator cannot start. Please free this port so the emulator can use it.`
        );
        await this.commandService.remoteCall(SharedConstants.Commands.Notifications.Add, notification);
      }
    }
  }

  public report(conversationId: string) {
    const serverUrl = this.serverUrl.replace('[::]', 'localhost');
    emulatorApplication.mainWindow.logService.logToChat(
      conversationId,
      textItem(LogLevel.Debug, `Emulator listening on ${serverUrl}`)
    );
  }
}
