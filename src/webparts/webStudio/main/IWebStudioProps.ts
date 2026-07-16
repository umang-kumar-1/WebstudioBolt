// Standalone React app no longer receives SPFx web part property-pane values
// (description/isDarkTheme/hasTeamsContext/etc.); WebStudio takes no required props.
export interface IWebStudioProps {
  description?: string;
  isDarkTheme?: boolean;
  environmentMessage?: string;
  hasTeamsContext?: boolean;
  userDisplayName?: string;
}
