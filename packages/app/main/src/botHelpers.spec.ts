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
// Software), to deal in the Software without restriction, including
// without limitation the rights to use, copy, modify, merge, publish,
// distribute, sublicense, and/or sell copies of the Software, and to
// permit persons to whom the Software is furnished to do so, subject to
// the following conditions:
//
// The above copyright notice and this permission notice shall be
// included in all copies or substantial portions of the Software.
//
// THE SOFTWARE IS PROVIDED AS IS, WITHOUT WARRANTY OF ANY KIND,
// EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
// MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
// NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
// LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
// OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
// WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
//

import { normalize } from 'path';

import {
  BotConfigWithPath,
  BotConfigWithPathImpl,
  CommandServiceImpl,
  CommandServiceInstance,
} from '@bfemulator/sdk-shared';
import { SharedConstants } from '@bfemulator/app-shared';
import { BotConfiguration } from 'botframework-config';

import { BotHelpers } from './botHelpers';

jest.mock('electron', () => ({
  app: {
    getPath: () => '/downloads',
  },
  ipcMain: new Proxy(
    {},
    {
      get(): any {
        return () => ({});
      },
      has() {
        return true;
      },
    }
  ),
  ipcRenderer: new Proxy(
    {},
    {
      get(): any {
        return () => ({});
      },
      has() {
        return true;
      },
    }
  ),
}));

jest.mock('./data/store', () => ({
  getStore: () => ({
    getState: () => ({
      bot: {
        activeBot: {
          name: 'someBot',
          description: '',
          padlock: '',
          path: 'somePath',
          services: [],
        },
        botFiles: [
          { path: 'path1', displayName: 'name1', secret: '' },
          { path: 'path2', displayName: 'name2', secret: '' },
          { path: 'path3', displayName: 'name3', secret: '' },
          { path: 'path4', displayName: 'name4', secret: 'ffsafsdfdsa' },
        ],
      },
    }),
    dispatch: () => null,
  }),
}));

describe('The botHelpers', () => {
  let commandService: CommandServiceImpl;
  beforeAll(() => {
    const decorator = CommandServiceInstance();
    const descriptor = decorator({ descriptor: {} }, 'none') as any;
    commandService = descriptor.descriptor.get();
  });

  it('getActiveBot() should retrieve the active bot', () => {
    const activeBot = BotHelpers.getActiveBot();
    expect(activeBot).toEqual({
      name: 'someBot',
      description: '',
      padlock: '',
      path: 'somePath',
      services: [],
    });
  });

  it('getBotInfoByPath() should get the bot info matching the specified path', () => {
    const info = BotHelpers.getBotInfoByPath('path2');
    expect(info).toEqual({ path: 'path2', displayName: 'name2', secret: '' });
  });

  it('pathExistsInRecentBots() should determine if the specified path exists in the recent bot list', () => {
    const pathExists = BotHelpers.pathExistsInRecentBots('path1');
    expect(pathExists).toBe(true);
  });

  it(`removeBotFromList() should remove the bot from the list based on the specified path`, async () => {
    const spy = jest.spyOn(commandService, 'remoteCall').mockResolvedValueOnce(true);
    await BotHelpers.removeBotFromList('path3');

    // should have sync'd up list with remaining 2 bot entries (3rd was removed)
    expect(spy).toHaveBeenCalledWith(SharedConstants.Commands.Bot.SyncBotList, [
      { path: 'path1', displayName: 'name1', secret: '' },
      { path: 'path2', displayName: 'name2', secret: '' },
      { displayName: 'name4', path: 'path4', secret: 'ffsafsdfdsa' },
    ]);
  });

  it('cloneBot() should clone the specified bot as expected', () => {
    const bot1 = null;
    expect(BotHelpers.cloneBot(bot1)).toBe(null);

    const bot2: BotConfigWithPath = BotConfigWithPathImpl.fromJSON({
      version: '',
      name: 'someName',
      description: 'someDescription',
      padlock: 'somePadlock',
      services: [],
      path: 'somePath',
      overrides: null,
    });
    expect(BotHelpers.cloneBot(bot2)).toEqual(bot2);
  });

  it('toSavableBot() should convert the specified bot to a savable instance', () => {
    const bot1 = null;
    expect(() => BotHelpers.toSavableBot(bot1)).toThrowError('Cannot convert null bot to savable bot.');

    const bot2: BotConfigWithPath = BotConfigWithPathImpl.fromJSON({
      version: '',
      name: 'someName',
      description: 'someDescription',
      services: [],
      path: 'somePath',
      overrides: null,
    });
    const secret = 'lgCbJPXnfOlatjbBDKMbh0ie6bc8PD/cjqA/2tPgMS0=';
    const savableBot = BotHelpers.toSavableBot(bot2, secret);

    const expectedBot = new BotConfiguration();
    expectedBot.name = 'someName';
    expectedBot.description = 'someDescription';
    expectedBot.services = [];

    expect(savableBot.name).toEqual(expectedBot.name);
    expect(savableBot.description).toEqual(expectedBot.description);
    expect(savableBot.services).toEqual(expectedBot.services);
    // secret key should've been refreshed
    expect(savableBot.padlock).not.toEqual(secret);
  });

  it('promptForSecretAndRetry() should prompt the user for the bot secret', async () => {
    commandService.remoteCall = jest
      .fn()
      .mockImplementationOnce(() => Promise.resolve(null))
      .mockImplementation(() => Promise.resolve('secret'));

    // if prompt for secret is dismissed, this should return null
    expect(await BotHelpers.promptForSecretAndRetry('somePath')).toBe(null);

    // should throw because it will get to the end of the function and try
    // to load a .bot file at 'somePath'
    try {
      await BotHelpers.promptForSecretAndRetry('somePath');
    } catch (e) {
      expect(e.code).toBe('ENOENT');
    }
  });

  it('saveBot() should save a bot', async () => {
    let saved = false;
    jest.spyOn(BotConfiguration, 'fromJSON').mockReturnValue({
      internal: {},
      validateSecret: () => true,
      save: async () => {
        saved = true;
      },
    });
    await BotHelpers.saveBot({
      path: 'path4',
    } as any);
    expect(saved).toBeTruthy();
  });

  describe('loadBotWithRetry()', () => {
    it('should prompt the user for the secret and retry if no secret was given for an encrypted bot', async () => {
      const botConfigLoadSpy = jest.spyOn(BotConfiguration, 'load').mockResolvedValue({ padlock: '55sdgfd' });
      const result = await BotHelpers.loadBotWithRetry('path');
      expect(botConfigLoadSpy).toHaveBeenCalledWith('path', undefined);

      expect(result).toEqual({
        description: '',
        name: '',
        overrides: null,
        padlock: '55sdgfd',
        path: 'path',
        services: [],
        version: '2.0',
      });
    });

    it('should update the secret when the specified secret does not match the one on record', async () => {
      const botConfigLoadSpy = jest.spyOn(BotConfiguration, 'load').mockResolvedValue({ padlock: 'newSecret' });
      const remoteCallSpy = jest.spyOn(commandService, 'remoteCall').mockResolvedValue('newSecret');
      const result = await BotHelpers.loadBotWithRetry('path1');
      expect(botConfigLoadSpy).toHaveBeenCalledWith('path1', undefined);
      expect(result).toEqual({
        description: '',
        name: '',
        overrides: null,
        padlock: 'newSecret',
        path: 'path1',
        services: [],
        version: '2.0',
      });
      expect(remoteCallSpy).toHaveBeenCalledWith('bot:list:sync', [
        { displayName: 'name1', path: 'path1', secret: 'newSecret' },
        { displayName: 'name2', path: 'path2', secret: '' },
        { displayName: 'name3', path: 'path3', secret: '' },
        { path: 'path4', displayName: 'name4', secret: 'ffsafsdfdsa' },
      ]);
    });
  });

  describe('getTranscriptsPath()', async () => {
    it('should return a value directory path with an active bot', async () => {
      const result = BotHelpers.getTranscriptsPath({ path: '/foo/bar' } as any, { mode: 'livechat' } as any);
      expect(result).toBe(normalize('/foo/transcripts'));
    });

    it('should return a value directory path with a bot opened via url', async () => {
      const result = BotHelpers.getTranscriptsPath({ path: '/foo/bar' } as any, { mode: 'livechat-url' } as any);
      expect(result).toBe(normalize('/downloads/transcripts'));
    });
  });
});
