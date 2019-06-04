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
import { newNotification, SharedConstants } from '@bfemulator/app-shared';
import { combineReducers, createStore } from 'redux';
import { CommandRegistry, CommandServiceImpl, CommandServiceInstance } from '@bfemulator/sdk-shared';

import { clientAwareSettingsChanged } from '../data/action/clientAwareSettingsActions';
import { beginAdd } from '../data/action/notificationActions';
import { bot } from '../data/reducer/bot';
import { chat } from '../data/reducer/chat';
import { clientAwareSettings } from '../data/reducer/clientAwareSettingsReducer';
import { editor } from '../data/reducer/editor';
import { framework } from '../data/reducer/frameworkSettingsReducer';
import { RootState } from '../data/store';
import { frameworkSettingsChanged } from '../data/action/frameworkSettingsActions';

import { EmulatorCommands } from './emulatorCommands';

const mockEndpoint = {
  endpoint: 'https://localhost:8080/api/messages',
};

let mockStore;
jest.mock('../data/store', () => ({
  get store() {
    return mockStore;
  },
}));

jest.mock('electron', () => ({
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

describe('The emulator commands', () => {
  let commandService: CommandServiceImpl;
  let registry: CommandRegistry;
  beforeAll(() => {
    new EmulatorCommands();
    const decorator = CommandServiceInstance();
    const descriptor = decorator({ descriptor: {} }, 'none') as any;
    commandService = descriptor.descriptor.get();
    registry = commandService.registry;
  });

  beforeEach(() => {
    mockStore = createStore(combineReducers({ bot, chat, clientAwareSettings, editor, framework }));
    mockStore.dispatch(
      clientAwareSettingsChanged({
        users: { currentUserId: '1234' },
        cwd: 'path',
        locale: 'en-us',
        serverUrl: 'https://localhost',
        debugMode: 1,
        appPath: '',
        savedBotUrls: [],
      })
    );
  });

  it('Should open a new emulator tabbed document for an endpoint', () => {
    const handler = registry.getCommand(SharedConstants.Commands.Emulator.NewLiveChat);
    const documentId = handler(mockEndpoint, false);
    const state: RootState = mockStore.getState();
    const documentIds = Object.keys(state.chat.chats);
    const document = state.chat.chats[documentId];
    expect(document.userId).toEqual('1234');
    expect(documentIds.length).toBe(1);
    expect(state.editor.editors.primary.activeDocumentId).toBe(documentId);
  });

  it('should open a new emulator tabbed document for an endpoint and use the custom user id', () => {
    let state: RootState = mockStore.getState();
    mockStore.dispatch(frameworkSettingsChanged({ ...state.framework, userGUID: 'customUserId' }));
    const handler = registry.getCommand(SharedConstants.Commands.Emulator.NewLiveChat);
    const documentId = handler(mockEndpoint, false);
    state = mockStore.getState();
    const document = state.chat.chats[documentId];
    expect(document.userId).toEqual('customUserId');
  });

  it('should set the active tab of an existing chat', () => {
    const handler = registry.getCommand(SharedConstants.Commands.Emulator.NewLiveChat);
    const documentId = handler(mockEndpoint, false);
    const secondDocumentId = handler({
      endpoint: 'https://localhost:8181/api/messages',
    });
    // At this point we should have 2 open documents
    // with the second on
    expect(mockStore.getState().editor.editors.primary.activeDocumentId).toBe(secondDocumentId);
    handler(mockEndpoint, true); // re-open the original document
    expect(mockStore.getState().editor.editors.primary.activeDocumentId).toBe(documentId);
  });

  it('should open a transcript', () => {
    const handler = registry.getCommand(SharedConstants.Commands.Emulator.OpenTranscript);
    const filePath = 'transcript.transcript';
    handler(filePath, filePath);

    const state = mockStore.getState();
    expect(state.chat.chats[filePath]).toBeTruthy();
    expect(state.editor.editors.primary.activeDocumentId).toBe(filePath);
  });

  it('Should prompt to open a transcript', async () => {
    const handler = registry.getCommand(SharedConstants.Commands.Emulator.PromptToOpenTranscript);
    const remoteCallSpy = jest.spyOn(commandService, 'remoteCall').mockResolvedValue('transcript.transcript');
    const callSpy = jest.spyOn(commandService, 'call').mockResolvedValue(null);

    await handler();

    expect(remoteCallSpy).toHaveBeenCalledWith('shell:showExplorer-open-dialog', {
      buttonLabel: 'Choose file',
      filters: [{ extensions: ['transcript'], name: 'Transcript Files' }],
      properties: ['openFile'],
      title: 'Open transcript file',
    });
    expect(remoteCallSpy).toHaveBeenCalledWith(SharedConstants.Commands.Telemetry.TrackEvent, 'transcriptFile_open', {
      method: 'file_menu',
    });

    expect(callSpy).toHaveBeenCalledWith('transcript:open', 'transcript.transcript');
  });

  it('should dispatch a notification when opening a transcript fails', async () => {
    const handler = registry.getCommand(SharedConstants.Commands.Emulator.PromptToOpenTranscript);
    const remoteCallSpy = jest.spyOn(commandService, 'remoteCall').mockResolvedValue('transcript.transcript');
    const callSpy = jest.spyOn(commandService, 'call').mockImplementationOnce(() => {
      throw new Error('Oh noes!');
    });
    const dispatchSpy = jest.spyOn(mockStore, 'dispatch');
    const errMsg = `Error while opening transcript file: Error: Oh noes!`;
    const notification = newNotification(errMsg);
    const action = beginAdd(notification);
    action.payload.notification.timestamp = jasmine.any(Number) as any;
    action.payload.notification.id = jasmine.any(String) as any;
    await handler();
    expect(remoteCallSpy).toHaveBeenCalled();
    expect(callSpy).toHaveBeenCalledWith('transcript:open', 'transcript.transcript');
    expect(dispatchSpy).toHaveBeenCalledWith(action);
    jest.restoreAllMocks();
  });

  it('should reload a transcript', async () => {
    const openTranscriptHandler = registry.getCommand(SharedConstants.Commands.Emulator.OpenTranscript);
    await openTranscriptHandler('transcript.transcript');
    let state = mockStore.getState();
    expect(state.chat.changeKey).toBe(1);
    const handler = registry.getCommand(SharedConstants.Commands.Emulator.ReloadTranscript);
    await handler('transcript.transcript');
    state = mockStore.getState();
    expect(state.chat.changeKey).toBe(3);
  });

  it('should open a chat file', async () => {
    const callSpy = jest.spyOn(commandService, 'call').mockResolvedValue(true);
    const remoteCallSpy = jest.spyOn(commandService, 'remoteCall').mockResolvedValue(true);

    const openChatFileHandler = registry.getCommand(SharedConstants.Commands.Emulator.OpenChatFile);
    await openChatFileHandler('some/path.chat', true);
    expect(remoteCallSpy).toHaveBeenCalledWith(SharedConstants.Commands.Emulator.OpenChatFile, 'some/path.chat');
    expect(callSpy).toHaveBeenCalledWith(
      SharedConstants.Commands.Emulator.ReloadTranscript,
      'some/path.chat',
      undefined,
      {
        activities: undefined,
        inMemory: true,
      }
    );
  });
});
