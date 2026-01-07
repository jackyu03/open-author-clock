import { config } from './config.js';

// State management
let quotes = [];
let wakeLock = null;

/**
 * Apply text alignment from config
 */
function applyTextAlignment() {
  const root = document.documentElement;
  root.style.setProperty('--text-align', config.textAlign);
  console.log('Text alignment set to:', config.textAlign);
}

/**
 * Setup precise minute timing
 */
async function setupPreciseMinuteTiming() {
  const { seconds } = await getCurrentTime();
  
  // Calculate milliseconds until next minute
  const msUntilNextMinute = (60 - seconds) * 1000;
  
  console.log(`Syncing to next minute in ${60 - seconds} seconds`);
  
  // Wait until the next minute, then start regular interval
  setTimeout(() => {
    updateQuote(); // Update immediately at minute change
    setInterval(updateQuote, 60000); // Then every 60 seconds
  }, msUntilNextMinute);
}

/**
 * Initialize the application
 */
async function init() {
  try {
    await loadQuotes();
    setupWakeLock();
    setupFallbackKeepAwake();
    applyEReaderStyles();
    
    // Apply text alignment from config
    applyTextAlignment();
    
    // Initialize datetime display immediately
    console.log('Initializing datetime display...');
    await updateDateTimeDisplay();
    console.log('Datetime display initialized');
    
    // Initialize weather display
    updateWeatherDisplay();
    
    // Initial quote update
    await updateQuote();
    
    // Setup precise minute timing for updates
    setupPreciseMinuteTiming();
    
    // Update weather every configured interval
    setInterval(updateWeatherDisplay, config.weatherUpdateInterval);
  } catch (error) {
    console.error('Failed to initialize application:', error);
    displayError('Failed to load quotes. Please refresh the page.');
  }
}

/**
 * Load quotes from external JSON file
 */
async function loadQuotes() {
  try {
    const response = await fetch(config.dataUrl);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    quotes = await response.json();
    console.log(`Loaded ${quotes.length} quotes`);
  } catch (error) {
    console.error('Error loading quotes:', error);
    throw error;
  }
}

/**
 * Convert time string (HH:MM) to minutes since midnight
 */
function convertTimeToMinutes(timeString) {
  const [hours, minutes] = timeString.split(':').map(Number);
  return hours * 60 + minutes;
}

/**
 * Get current time with smart fallback system
 */
async function getCurrentTime() {
  try {
    console.log('Getting current time...');
    
    // Get system time first
    const systemTime = new Date();
    const systemTimeData = {
      hours: systemTime.getHours(),
      minutes: systemTime.getMinutes(),
      seconds: systemTime.getSeconds()
    };
    
    console.log('System time:', systemTimeData);
    
    // If web time is disabled, just use system time
    if (!config.timeSync.useWebTime) {
      console.log('Using system time (web time disabled)');
      return systemTimeData;
    }
    
    console.log('Fetching web time...');
    // Try to get web time
    const response = await fetch(config.timeSync.webTimeAPI);
    const data = await response.json();
    const webTime = new Date(data.datetime);
    
    const webTimeData = {
      hours: webTime.getHours(),
      minutes: webTime.getMinutes(),
      seconds: webTime.getSeconds()
    };
    
    console.log('Web time:', webTimeData);
    
    // Check discrepancy between system and web time
    const systemMinutes = systemTime.getHours() * 60 + systemTime.getMinutes();
    const webMinutes = webTime.getHours() * 60 + webTime.getMinutes();
    const discrepancyMinutes = Math.abs(systemMinutes - webMinutes);
    
    // If discrepancy is large, use web time
    if (discrepancyMinutes * 60 > config.timeSync.maxDiscrepancySeconds) {
      console.log(`Time discrepancy detected: ${discrepancyMinutes} minutes. Using web time.`);
      return webTimeData;
    }
    
    // Otherwise use system time
    console.log('Using system time (no significant discrepancy)');
    return systemTimeData;
    
  } catch (error) {
    console.error('Failed to fetch web time:', error);
    
    if (config.timeSync.fallbackToSystemTime) {
      console.log('Falling back to system time');
      const systemTime = new Date();
      return {
        hours: systemTime.getHours(),
        minutes: systemTime.getMinutes(),
        seconds: systemTime.getSeconds()
      };
    }
    
    throw new Error('Time unavailable');
  }
}

/**
 * Check if device is using UTC time
 */
function isDeviceTimeUTC() {
  const offset = new Date().getTimezoneOffset();
  return offset === 0;
}

/**
 * Find quote for current time
 */
async function findQuoteForCurrentTime() {
  const { hours, minutes } = await getCurrentTime();
  const currentTimeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
  
  // Try to find exact match only
  let matchedQuote = quotes.find(q => q.time === currentTimeString);
  
  return matchedQuote;
}

/**
 * Adjust font size based on quote length and screen orientation
 */
function adjustFontSizeForQuote(quoteLength) {
  const quoteElement = document.querySelector(config.selectors.quote);
  if (!quoteElement) return;
  
  const isPortrait = window.innerHeight > window.innerWidth;
  const baseSize = isPortrait 
    ? config.fontSize.base * config.fontSize.portraitMultiplier 
    : config.fontSize.base;
  
  let fontSize;
  if (quoteLength < config.fontSize.shortQuoteThreshold) {
    fontSize = config.fontSize.shortQuoteSize;
  } else if (quoteLength > config.fontSize.longQuoteThreshold) {
    fontSize = config.fontSize.longQuoteSize;
  } else {
    fontSize = baseSize;
  }
  
  quoteElement.style.fontSize = `${fontSize}vw`;
}

/**
 * Truncate quote to fit within three lines
 */
function truncateQuoteToThreeLines(quoteText, timeString) {
  const quoteElement = document.querySelector(config.selectors.quote);
  if (!quoteElement) return quoteText;
  
  // Create a temporary element to measure text height
  const tempElement = document.createElement('div');
  tempElement.style.cssText = window.getComputedStyle(quoteElement).cssText;
  tempElement.style.position = 'absolute';
  tempElement.style.visibility = 'hidden';
  tempElement.style.height = 'auto';
  tempElement.style.maxHeight = 'none';
  tempElement.style.width = quoteElement.offsetWidth + 'px';
  document.body.appendChild(tempElement);
  
  // Get line height
  tempElement.innerHTML = 'Test line';
  const lineHeight = tempElement.offsetHeight;
  const maxHeight = lineHeight * 3;
  
  // Test full quote
  const highlightedQuote = highlightTimeString(quoteText, timeString);
  tempElement.innerHTML = `"${highlightedQuote}"`;
  
  if (tempElement.offsetHeight <= maxHeight) {
    document.body.removeChild(tempElement);
    return quoteText;
  }
  
  // Truncate word by word until it fits
  const words = quoteText.split(' ');
  let truncatedText = '';
  
  for (let i = 0; i < words.length; i++) {
    const testText = truncatedText + (truncatedText ? ' ' : '') + words[i];
    const testHighlighted = highlightTimeString(testText + '...', timeString);
    tempElement.innerHTML = `"${testHighlighted}"`;
    
    if (tempElement.offsetHeight > maxHeight) {
      break;
    }
    truncatedText = testText;
  }
  
  document.body.removeChild(tempElement);
  return truncatedText + '...';
}
/**
 * Update weather display with error handling
 */
async function updateWeatherDisplay() {
  const weatherElement = document.querySelector(config.selectors.weatherDisplay);
  if (!weatherElement) return;
  
  try {
    // Show loading state
    weatherElement.textContent = `${config.location.city} • ${config.messages.loadingWeather}`;
    
    // Using Open-Meteo API with weather conditions
    const response = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${config.location.latitude}&longitude=${config.location.longitude}&current_weather=true&temperature_unit=celsius`);
    
    if (!response.ok) {
      throw new Error(`Weather API responded with status: ${response.status}`);
    }
    
    const data = await response.json();
    
    if (data.current_weather) {
      const temp = Math.round(data.current_weather.temperature);
      const weatherCode = data.current_weather.weathercode;
      
      // Convert weather code to condition
      const condition = getWeatherCondition(weatherCode);
      
      weatherElement.textContent = `${config.location.city} • ${temp}°C • ${condition}`;
    } else {
      throw new Error('No weather data received');
    }
  } catch (error) {
    console.error('Weather fetch failed:', error);
    weatherElement.textContent = `${config.location.city} • ${config.messages.weatherUnavailable}`;
  }
}

/**
 * Convert weather code to readable condition
 */
function getWeatherCondition(code) {
  const conditions = {
    0: 'Clear',
    1: 'Mostly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Foggy',
    48: 'Rime Fog',
    51: 'Light Drizzle',
    53: 'Drizzle',
    55: 'Heavy Drizzle',
    61: 'Light Rain',
    63: 'Rain',
    65: 'Heavy Rain',
    71: 'Light Snow',
    73: 'Snow',
    75: 'Heavy Snow',
    77: 'Snow Grains',
    80: 'Light Showers',
    81: 'Showers',
    82: 'Heavy Showers',
    85: 'Light Snow Showers',
    86: 'Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm with Hail',
    99: 'Heavy Thunderstorm'
  };
  
  return conditions[code] || 'Unknown';
}
/**
 * Update datetime display with error handling
 */
async function updateDateTimeDisplay() {
  const datetimeElement = document.querySelector(config.selectors.datetimeDisplay);
  if (!datetimeElement) return;
  
  try {
    const { hours, minutes } = await getCurrentTime();
    const now = new Date();
    
    // Format date: "Mon, Jan 6"
    const dateStr = now.toLocaleDateString('en-US', { 
      weekday: 'short', 
      month: 'short', 
      day: 'numeric' 
    });
    
    // Format time: "12:55"
    const timeStr = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    
    // Combine in single line: "Mon, Jan 6 • 12:55"
    datetimeElement.textContent = `${dateStr} • ${timeStr}`;
  } catch (error) {
    console.error('Failed to update datetime display:', error);
    datetimeElement.textContent = config.messages.timeUnavailable;
  }
}
function smartTruncateQuote(quoteText, timeString) {
  // Rough estimate: ~120 characters per 3 lines at typical font sizes
  const maxLength = 120;
  
  if (quoteText.length <= maxLength) {
    return quoteText;
  }
  
  // Find the time string position
  const timeIndex = quoteText.toLowerCase().indexOf(timeString.toLowerCase());
  if (timeIndex === -1) {
    // Time not found, just truncate from beginning
    return quoteText.substring(0, maxLength - 3) + '...';
  }
  
  const timeLength = timeString.length;
  const timeEnd = timeIndex + timeLength;
  
  // Calculate ideal window to use full 120 characters
  let startIndex = Math.max(0, timeIndex - Math.floor((maxLength - timeLength) / 2));
  let endIndex = Math.min(quoteText.length, startIndex + maxLength);
  
  // If we hit the end, shift the window back to use full length
  if (endIndex === quoteText.length && quoteText.length > maxLength) {
    startIndex = Math.max(0, quoteText.length - maxLength);
    endIndex = quoteText.length;
  }
  
  // If we hit the beginning, shift the window forward to use full length
  if (startIndex === 0 && quoteText.length > maxLength) {
    endIndex = Math.min(quoteText.length, maxLength);
  }
  
  // Ensure we don't exceed maxLength
  if (endIndex - startIndex > maxLength) {
    endIndex = startIndex + maxLength;
  }
  
  // Find word boundaries to avoid cutting words
  if (startIndex > 0) {
    const spaceIndex = quoteText.indexOf(' ', startIndex);
    if (spaceIndex !== -1 && spaceIndex < startIndex + 15) {
      startIndex = spaceIndex + 1;
    }
  }
  
  if (endIndex < quoteText.length) {
    const spaceIndex = quoteText.lastIndexOf(' ', endIndex);
    if (spaceIndex !== -1 && spaceIndex > endIndex - 15) {
      endIndex = spaceIndex;
    }
  }
  
  let result = quoteText.substring(startIndex, endIndex);
  
  if (startIndex > 0) result = '...' + result;
  if (endIndex < quoteText.length) result = result + '...';
  
  return result;
}

function highlightTimeString(quoteText, timeString) {
  // Escape special regex characters
  const escapedTimeString = timeString.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${escapedTimeString})`, 'gi');
  return quoteText.replace(regex, '<strong>$1</strong>');
}

/**
 * Update displayed quote
 */
async function updateQuote() {
  const matchedQuote = await findQuoteForCurrentTime();
  
  const quoteElement = document.querySelector(config.selectors.quote);
  const authorElement = document.querySelector(config.selectors.author);
  
  if (!quoteElement || !authorElement) {
    console.error('Quote or author element not found');
    return;
  }
  
  // Update datetime display
  await updateDateTimeDisplay();
  
  // Fade out
  quoteElement.style.opacity = '0';
  authorElement.style.opacity = '0';
  
  setTimeout(async () => {
    if (!matchedQuote) {
      // No quote found for this time - get current time for display
      const { hours, minutes } = await getCurrentTime();
      const timeString = `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
      
      quoteElement.innerHTML = `"${config.messages.noQuote} <strong>${timeString}</strong>..."`;
      authorElement.textContent = config.messages.noSource;
      console.warn('No quote found for current time:', timeString);
    } else {
      // Update content with found quote
      const truncatedQuote = smartTruncateQuote(matchedQuote.quote, matchedQuote.timeString);
      const highlightedQuote = highlightTimeString(truncatedQuote, matchedQuote.timeString);
      quoteElement.innerHTML = `"${highlightedQuote}"`;
      authorElement.textContent = `${matchedQuote.title} – ${matchedQuote.author}`;
    }
    
    // Adjust font size
    const textLength = matchedQuote ? matchedQuote.quote.length : 50;
    adjustFontSizeForQuote(textLength);
    
    // Fade in
    quoteElement.style.opacity = '1';
    authorElement.style.opacity = '1';
  }, config.fadeOutDuration);
}

/**
 * Display error message to user
 */
function displayError(message) {
  const container = document.querySelector(config.selectors.quoteContainer);
  if (container) {
    container.innerHTML = `
      <div style="text-align: center; color: #ff6b6b; padding: 2rem;">
        <h2>Error</h2>
        <p>${message}</p>
      </div>
    `;
  }
}

/**
 * Setup screen wake lock to prevent screen from sleeping
 */
async function setupWakeLock() {
  if (!config.enableWakeLock || !('wakeLock' in navigator)) {
    console.log('Wake Lock API not supported');
    return;
  }
  
  try {
    wakeLock = await navigator.wakeLock.request('screen');
    console.log('Wake Lock active');
    
    wakeLock.addEventListener('release', () => {
      console.log('Wake Lock released');
    });
    
    // Reacquire wake lock when page becomes visible
    document.addEventListener('visibilitychange', async () => {
      if (document.visibilityState === 'visible' && wakeLock !== null) {
        try {
          wakeLock = await navigator.wakeLock.request('screen');
          console.log('Wake Lock reacquired');
        } catch (err) {
          console.error('Failed to reacquire wake lock:', err);
        }
      }
    });
  } catch (err) {
    console.error('Wake Lock request failed:', err);
  }
}

/**
 * Fallback method to keep screen awake on older devices
 */
function setupFallbackKeepAwake() {
  setInterval(() => {
    window.scrollBy(0, 1);
    window.scrollBy(0, -1);
  }, config.wakeLockFallbackInterval);
}

/**
 * Apply special styles for e-reader devices
 */
function applyEReaderStyles() {
  const isEReader = /\b(Kindle|NOOK|Kobo|Sony Reader)\b/i.test(navigator.userAgent);
  
  if (isEReader) {
    // Keep dark theme consistent across all devices
    document.body.style.backgroundColor = '#1a1a1a';
    document.body.style.color = '#e0e0e0';
    console.log('E-reader dark styles applied');
  }
}

// Start the application when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
