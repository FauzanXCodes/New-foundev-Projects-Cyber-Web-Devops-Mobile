import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds everything static. This adds the one thing that depends on where the invite page is
// actually hosted: Associated Domains, which is what lets a tapped invite link open the app directly
// instead of a browser (Apple's universal links). Set INVITE_DOMAIN, for example
//   INVITE_DOMAIN=rally.example.com eas build
// and serve /.well-known/apple-app-site-association from that host (the API does, given APPLE_TEAM_ID).
export default ({ config }: ConfigContext): ExpoConfig => {
  const domain = process.env.INVITE_DOMAIN;
  return {
    ...config,
    name: config.name ?? 'Rally',
    slug: config.slug ?? 'fitness-challenge',
    ios: {
      ...config.ios,
      associatedDomains: domain ? [`applinks:${domain}`] : config.ios?.associatedDomains,
      // The Apple developer team that signs the build. Read from the environment so a personal team id
      // is not committed: APPLE_TEAM_ID=XXXXXXXXXX npx expo prebuild
      appleTeamId: process.env.APPLE_TEAM_ID ?? config.ios?.appleTeamId,
    },
  };
};
