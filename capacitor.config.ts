import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'com.atothei.carpentryjobs',
  appName: 'Carpentry Jobs',
  webDir: 'dist',
  backgroundColor: '#111827',
  android: {
    allowMixedContent: false,
  },
}

export default config
