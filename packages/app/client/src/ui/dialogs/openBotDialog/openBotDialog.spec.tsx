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

import { ClientAwareSettings, UserSettings } from '@bfemulator/app-shared';
import { mount } from 'enzyme';
import * as React from 'react';
import { Provider } from 'react-redux';
import { combineReducers, createStore } from 'redux';
import { User } from '@bfemulator/sdk-shared';

import * as botActions from '../../../data/action/botActions';
import * as BotActions from '../../../data/action/botActions';
import { clientAwareSettingsChanged } from '../../../data/action/clientAwareSettingsActions';
import { bot } from '../../../data/reducer/bot';
import { clientAwareSettings } from '../../../data/reducer/clientAwareSettingsReducer';
import { DialogService } from '../service';

import { OpenBotDialog } from './openBotDialog';
import { OpenBotDialogContainer } from './openBotDialogContainer';

let mockStore;
jest.mock('./openBotDialog.scss', () => ({}));
jest.mock('../../../data/store', () => ({
  get store() {
    return mockStore;
  },
}));
jest.mock('../service', () => ({
  DialogService: {
    showDialog: () => Promise.resolve(true),
    hideDialog: () => Promise.resolve(false),
  },
}));
jest.mock('../dialogStyles.scss', () => ({}));
jest.mock('../../editor/recentBotsList/recentBotsList.scss', () => ({}));
jest.mock('../', () => ({}));

const bots = [
  {
    path: '/some/path',
    displayName: 'mockMock',
    transcriptsPath: '/Users/microsoft/Documents/testbot/transcripts',
    chatsPath: '/Users/microsoft/Documents/testbot/dialogs',
  },
];

describe('The OpenBotDialog', () => {
  let node;
  let parent;
  let instance;
  beforeEach(() => {
    mockStore = createStore(combineReducers({ bot, clientAwareSettings }));
    mockStore.dispatch(BotActions.loadBotInfos(bots));
    mockStore.dispatch(
      clientAwareSettingsChanged({
        serverUrl: 'http://localhost:3543',
        users: {
          usersById: { user1: {} as User },
          currentUserId: 'user1',
        } as UserSettings,
      } as ClientAwareSettings)
    );
    parent = mount(
      <Provider store={mockStore}>
        <OpenBotDialogContainer isDebug={false} mode={'livechat'} savedBotUrls={['http://localhost/api/messages']} />
      </Provider>
    );
    node = parent.find(OpenBotDialog);
    instance = node.instance();
  });

  it('should hide the dialog when cancel is clicked', () => {
    const spy = jest.spyOn(DialogService, 'hideDialog');
    instance.props.onDialogCancel();
    expect(spy).toHaveBeenCalled();
  });

  it('should properly set the state when the input changes', () => {
    instance.onInputChange({
      target: {
        name: 'botUrl',
        type: 'text',
        value: 'http://localhost:6500/api/messages',
      },
    } as any);

    expect(instance.state.botUrl).toBe('http://localhost:6500/api/messages');

    instance.onInputChange({
      target: {
        type: 'file',
        name: 'botUrl',
        files: { item: () => ({ path: 'some/path/to/myBot.bot' }) },
      },
    } as any);

    expect(instance.state.botUrl).toBe('some/path/to/myBot.bot');
  });

  it('should properly set the state when the "debug" checkbox is clicked', () => {
    instance.onCheckboxClick({
      currentTarget: {
        name: 'mode',
        type: 'input',
        checked: 'true',
      },
    } as any);

    expect(instance.state.mode).toBe('debug');
    expect(instance.state.isDebug).toBeTruthy();
  });

  it('should open a bot when a path is provided', async () => {
    instance.onInputChange({
      target: {
        name: 'botUrl',
        type: 'file',
        files: { item: () => ({ path: 'some/path/to/myBot.bot' }) },
      },
    } as any);

    const spy = jest.spyOn(botActions, 'openBotViaFilePathAction');
    await instance.onSubmit();

    expect(spy).toHaveBeenCalledWith('some/path/to/myBot.bot');
  });

  it('should open a bot when a URL is provided', async () => {
    instance.onInputChange({
      target: {
        name: 'botUrl',
        type: 'text',
        value: 'http://localhost',
      },
    } as any);

    const spy = jest.spyOn(botActions, 'openBotViaUrlAction');
    await instance.onSubmit();

    expect(spy).toHaveBeenCalledWith({
      appId: '',
      appPassword: '',
      endpoint: 'http://localhost',
      mode: 'livechat',
    });
  });

  it('should handle a bot url change', () => {
    instance.onBotUrlChange('http://localhost:3978');

    expect(instance.state.botUrl).toBe('http://localhost:3978');
  });
});
