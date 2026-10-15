import type { StorybookConfig } from '@storybook/react-vite';

const config: StorybookConfig = {
  framework: '@storybook/react-vite',
  stories: ['../src/**/*.stories.tsx'],
  // The seed icons, at the URLs the app loads icons from, so stories don't need the server
  staticDirs: [{ from: '../../server/seed/icons', to: '/icons' }],
  core: { disableTelemetry: true },
};

export default config;
