import * as React from 'react';
import ImageManagementParent from './ImageManagementParent';

export const ImageContext = React.createContext<any>(null);

export interface IImageManagementContextProviderProps {
  context: any;
  targetLibrary: string;
  service: any; // PhotoGalleryService
}

export default class ImageManagementContextProvider extends React.Component<IImageManagementContextProviderProps, {}> {
  public render(): React.ReactElement<IImageManagementContextProviderProps> {
    const { context, targetLibrary, service } = this.props;

    // Creating a context value simpler than before
    const contextValue = {
      context,
      targetLibrary,
      service
    };

    return (
      <ImageContext.Provider value={contextValue}>
        <ImageManagementParent
          context={context}
          service={service}
          targetLibrary={targetLibrary}
        />
      </ImageContext.Provider>
    );
  }
}