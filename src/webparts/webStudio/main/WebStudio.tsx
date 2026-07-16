import * as React from 'react';
import type { IWebStudioProps } from './IWebStudioProps';
import App from '../components/App';
import { SPServiceProvider } from '../contexts/SPServiceContext';
import '../webStudioStyles';

export default class WebStudio extends React.Component<IWebStudioProps> {
  public render(): React.ReactElement<IWebStudioProps> {
    return (
      <SPServiceProvider>
        <App />
      </SPServiceProvider>
    );
  }
}
