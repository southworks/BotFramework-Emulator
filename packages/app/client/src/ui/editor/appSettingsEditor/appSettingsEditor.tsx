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

import { FrameworkSettings } from '@bfemulator/app-shared';
import {
  Checkbox,
  Column,
  PrimaryButton,
  Row,
  RowAlignment,
  RowJustification,
  SmallHeader,
  TextField,
} from '@bfemulator/ui-react';
import * as React from 'react';
import { ChangeEvent } from 'react';

import { GenericDocument } from '../../layout';

import * as styles from './appSettingsEditor.scss';

export interface AppSettingsEditorProps {
  documentId?: string;
  dirty?: boolean;
  framework?: FrameworkSettings;

  discardChanges?: () => void;
  getFrameworkSettings?: () => void;
  openBrowseForNgrok: () => Promise<string>;
  saveFrameworkSettings?: (framework: FrameworkSettings) => void;
  setDirtyFlag?: (dirty: boolean) => void;
}

export interface AppSettingsEditorState extends Partial<FrameworkSettings> {
  dirty?: boolean;
  pendingUpdate?: boolean;
}

function shallowEqual(x: any, y: any) {
  return Object.keys(x).length === Object.keys(y).length && Object.keys(x).every(key => key in y && x[key] === y[key]);
}

export class AppSettingsEditor extends React.Component<AppSettingsEditorProps, AppSettingsEditorState> {
  public state = {} as AppSettingsEditorState;

  public static getDerivedStateFromProps(
    newProps: AppSettingsEditorProps,
    prevState: AppSettingsEditorState
  ): AppSettingsEditorState {
    if (newProps.framework.hash === prevState.hash) {
      return prevState;
    }

    return {
      ...newProps.framework,
      dirty: newProps.dirty,
      pendingUpdate: false,
    };
  }

  public componentDidMount(): void {
    this.props.getFrameworkSettings();
  }

  public render(): JSX.Element {
    const {
      ngrokPath = '',
      useCustomId = false,
      bypassNgrokLocalhost = true,
      runNgrokAtStartup = false,
      localhost = '',
      locale = '',
      use10Tokens = false,
      useCodeValidation = false,
      userGUID = '',
      autoUpdate = false,
      usePrereleases = false,
    } = this.state;

    const inputProps = {
      disabled: !useCustomId,
    };

    return (
      <GenericDocument className={styles.appSettingsEditor}>
        <Row>
          <Column className={styles.spacing}>
            <SmallHeader>Service</SmallHeader>
            <p>
              <a href="https://ngrok.com/" target="_blank" rel="noopener noreferrer">
                ngrok
              </a>{' '}
              is network tunneling software. The Bot Framework Emulator works with ngrok to communicate with bots hosted
              remotely. Read the{' '}
              <a
                href="https://github.com/Microsoft/BotFramework-Emulator/wiki/Tunneling-(ngrok)"
                target="_blank"
                rel="noopener noreferrer"
              >
                wiki page
              </a>{' '}
              to learn more about using ngrok and to download it.
            </p>
            <Row align={RowAlignment.Center} className={styles.marginBottomRow}>
              <TextField
                className={styles.appSettingsInput}
                inputContainerClassName={styles.inputContainer}
                readOnly={false}
                value={ngrokPath}
                onChange={this.onInputChange}
                name="ngrokPath"
                label={'Path to ngrok'}
              />
              <PrimaryButton onClick={this.onClickBrowse} text="Browse" className={styles.browseButton} />
            </Row>
            <Checkbox
              className={styles.checkboxOverrides}
              checked={bypassNgrokLocalhost}
              onChange={this.onChangeCheckBox}
              id="ngrok-bypass"
              label="Bypass ngrok for local addresses"
              name="bypassNgrokLocalhost"
            />
            <Checkbox
              className={styles.checkboxOverrides}
              checked={runNgrokAtStartup}
              onChange={this.onChangeCheckBox}
              id="ngrok-startup"
              label="Run ngrok when the Emulator starts up"
              name="runNgrokAtStartup"
            />
            <Row align={RowAlignment.Center} className={styles.marginBottomRow}>
              <TextField
                className={styles.appSettingsInput}
                inputContainerClassName={styles.inputContainer}
                readOnly={false}
                value={localhost}
                onChange={this.onInputChange}
                name="localhost"
                label="localhost override"
              />
            </Row>
            <Row align={RowAlignment.Center}>
              <TextField
                className={styles.appSettingsInput}
                inputContainerClassName={styles.inputContainer}
                readOnly={false}
                value={locale}
                name="locale"
                onChange={this.onInputChange}
                label="Locale"
              />
            </Row>
          </Column>
          <Column className={[styles.rightColumn, styles.spacing].join(' ')}>
            <SmallHeader>User settings</SmallHeader>
            <Checkbox
              className={styles.checkboxOverrides}
              checked={use10Tokens}
              onChange={this.onChangeCheckBox}
              id="auth-token-version"
              label="Use version 1.0 authentication tokens"
              name="use10Tokens"
            />
            <Checkbox
              className={styles.checkboxOverrides}
              checked={useCodeValidation}
              onChange={this.onChangeCheckBox}
              id="use-validation-code"
              label="Use a sign-in verification code for OAuthCards"
              name="useCodeValidation"
            />
            <Checkbox
              className={styles.checkboxOverrides}
              checked={useCustomId}
              onChange={this.onChangeCheckBox}
              id="use-custom-id"
              label="Use your own user ID to communicate with the bot"
              name="useCustomId"
            />

            <Row align={RowAlignment.Top}>
              <TextField
                {...inputProps}
                label="User ID"
                placeholder={useCustomId ? '' : 'There is no ID configured'}
                className={styles.appSettingsInput}
                inputContainerClassName={styles.inputContainer}
                readOnly={false}
                value={userGUID}
                name="userGUID"
                onChange={this.onInputChange}
                required={useCustomId}
                errorMessage={userGUID ? '' : 'Enter a User ID'}
              />
            </Row>

            <SmallHeader>Application Updates</SmallHeader>
            <Checkbox
              className={styles.checkboxOverrides}
              checked={autoUpdate}
              onChange={this.onChangeCheckBox}
              label="Automatically download and install updates"
              name="autoUpdate"
            />
            <Checkbox
              className={styles.checkboxOverrides}
              checked={usePrereleases}
              onChange={this.onChangeCheckBox}
              label="Use pre-release versions"
              name="usePrereleases"
            />
            <SmallHeader>Data Collection</SmallHeader>
            <Checkbox
              className={styles.checkboxOverrides}
              checked={false}
              onChange={this.onChangeCheckBox}
              label="Help improve the Emulator by allowing us to collect usage data."
              name="collectUsageData"
              disabled={true}
            />
            <a target="_blank" href="https://aka.ms/bot-framework-emulator-data-collection" rel="noopener noreferrer">
              Learn more.
            </a>
          </Column>
        </Row>
        <Row className={styles.buttonRow} justify={RowJustification.Right}>
          <PrimaryButton text="Cancel" onClick={this.props.discardChanges} className={styles.cancelButton} />
          <PrimaryButton
            text="Save"
            onClick={this.onSaveClick}
            className={styles.saveButton}
            disabled={this.disableSaveButton()}
          />
        </Row>
      </GenericDocument>
    );
  }

  private disableSaveButton(): boolean {
    return this.state.useCustomId ? !this.state.userGUID || !this.state.dirty : !this.state.dirty;
  }

  private onChangeCheckBox = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = event.target;
    const change = { [name]: checked };
    this.setState(change);
    if (name === 'useCustomId' && checked === false) {
      this.setState({ userGUID: '' });
    }
    this.updateDirtyFlag(change);
  };

  private onClickBrowse = async (): Promise<void> => {
    const ngrokPath = await this.props.openBrowseForNgrok();
    if (ngrokPath === null) {
      return; // Cancelled browse dialog
    }
    const change = { ngrokPath };
    this.setState(change);
    this.updateDirtyFlag(change);
  };

  private onInputChange = (event: ChangeEvent<HTMLInputElement>): void => {
    const { value, name } = event.target;
    const change = { [name]: value };
    this.setState(change);
    this.updateDirtyFlag(change);
  };

  private onSaveClick = () => {
    this.props.saveFrameworkSettings(this.state);
  };

  private updateDirtyFlag(change: { [prop: string]: any }) {
    const dirty = !shallowEqual({ ...this.state, ...change }, this.props.framework);
    this.setState({ dirty });
    this.props.setDirtyFlag(dirty);
  }
}
