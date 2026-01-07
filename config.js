// Configuration settings for the Open Author Clock
export const config = {
  // Data source
  dataUrl: 'data.json',
  
  // Update intervals (milliseconds)
  updateInterval: 60000,        // Quote updates (1 minute)
  weatherUpdateInterval: 600000, // Weather updates (10 minutes)
  
  // Transition settings
  fadeOutDuration: 1000,  // milliseconds
  fadeInDuration: 1000,   // milliseconds
  
  // Typography settings
  fontSize: {
    base: 5.5,                // Base font size in vw
    portraitMultiplier: 1.5,  // Multiplier for portrait orientation
    shortQuoteThreshold: 80, // Character count for "short" quotes
    longQuoteThreshold: 250,  // Character count for "long" quotes
    shortQuoteSize: 7,        // Font size for short quotes (vw)
    longQuoteSize: 4,         // Font size for long quotes (vw)
    weatherMultiplier: 1.3    // Weather text size multiplier (relative to author size)
  },
  
  // Quote truncation
  maxQuoteLength: 108,        // Maximum characters for 3-line display
  
  // Location settings
  location: {
    city: 'Evanston',
    state: 'IL',
    latitude: 42.0451,
    longitude: -87.6877,
    timezone: 'America/Chicago'
  },
  
  // Time settings
  timeSync: {
    useWebTime: false,          // Default to system time
    maxDiscrepancySeconds: 30,  // Switch to web time if system differs by more than this
    webTimeAPI: 'https://worldtimeapi.org/api/timezone/America/Chicago',
    fallbackToSystemTime: true  // Use system time if web time fails
  },
  
  // Screen wake lock settings
  enableWakeLock: true,
  wakeLockFallbackInterval: 30000, // milliseconds
  
  // Error messages
  messages: {
    noQuote: 'No quote found for',
    noSource: 'No source available',
    timeUnavailable: 'Time unavailable',
    weatherUnavailable: 'Weather unavailable',
    loadingQuote: 'Loading quote...',
    loadingWeather: 'Loading weather...'
  },
  
  // Selectors
  selectors: {
    quote: '#quote',
    author: '#author',
    quoteContainer: '#quoteContainer',
    datetimeDisplay: '#datetimeDisplay',
    weatherDisplay: '#weatherDisplay'
  }
};
