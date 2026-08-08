export interface AppConfig {
  production: boolean;
  apiBaseUrl: string;
  authStorageKey: string;
  features: {
    assessmentEnabled: boolean;
    matchingEnabled: boolean;
    chatbotEnabled: boolean;
  };
}

export const APP_CONFIG: AppConfig = {
  production: false,
  apiBaseUrl: 'http://localhost:3000/v1',
  authStorageKey: 'spark-match.auth',
  features: {
    assessmentEnabled: true,
    matchingEnabled: true,
    chatbotEnabled: false
  }
};
