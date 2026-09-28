import { LocationItem } from '../types';

export const POPULAR_LOCATIONS: LocationItem[] = [
  // Primary Arecanut Belt - Coastal & Malnad Karnataka
  {
    id: 'mangalore',
    name: 'Mangalore (Mangaluru)',
    region: 'Dakshina Kannada, Karnataka',
    country: 'India',
    latitude: 12.9141,
    longitude: 74.8560,
    isArecaHub: true,
  },
  {
    id: 'shivamogga',
    name: 'Shivamogga (Shimoga)',
    region: 'Malnad, Karnataka',
    country: 'India',
    latitude: 13.9299,
    longitude: 75.5681,
    isArecaHub: true,
  },
  {
    id: 'sullia',
    name: 'Sullia / Puttur',
    region: 'Dakshina Kannada, Karnataka',
    country: 'India',
    latitude: 12.5607,
    longitude: 75.3887,
    isArecaHub: true,
  },
  {
    id: 'sirsi',
    name: 'Sirsi',
    region: 'Uttara Kannada, Karnataka',
    country: 'India',
    latitude: 14.6195,
    longitude: 74.8354,
    isArecaHub: true,
  },
  {
    id: 'chikkamagaluru',
    name: 'Chikkamagaluru',
    region: 'Karnataka',
    country: 'India',
    latitude: 13.3161,
    longitude: 75.7720,
    isArecaHub: true,
  },
  {
    id: 'kasaragod',
    name: 'Kasaragod',
    region: 'Kerala',
    country: 'India',
    latitude: 12.4996,
    longitude: 74.9869,
    isArecaHub: true,
  },
  {
    id: 'wayanad',
    name: 'Wayanad / Kalpetta',
    region: 'Kerala',
    country: 'India',
    latitude: 11.6050,
    longitude: 76.0827,
    isArecaHub: true,
  },
  // Major Indian Agricultural & Metropolises
  {
    id: 'bengaluru',
    name: 'Bengaluru',
    region: 'Karnataka',
    country: 'India',
    latitude: 12.9716,
    longitude: 77.5946,
  },
  {
    id: 'mumbai',
    name: 'Mumbai',
    region: 'Maharashtra',
    country: 'India',
    latitude: 19.0760,
    longitude: 72.8777,
  },
  {
    id: 'delhi',
    name: 'New Delhi',
    region: 'Delhi NCR',
    country: 'India',
    latitude: 28.6139,
    longitude: 77.2090,
  },
  {
    id: 'chennai',
    name: 'Chennai',
    region: 'Tamil Nadu',
    country: 'India',
    latitude: 13.0827,
    longitude: 80.2707,
  },
  {
    id: 'kolkata',
    name: 'Kolkata',
    region: 'West Bengal',
    country: 'India',
    latitude: 22.5726,
    longitude: 88.3639,
  },
  {
    id: 'hyderabad',
    name: 'Hyderabad',
    region: 'Telangana',
    country: 'India',
    latitude: 17.3850,
    longitude: 78.4867,
  },
  {
    id: 'guwahati',
    name: 'Guwahati (Assam Areca Belt)',
    region: 'Assam',
    country: 'India',
    latitude: 26.1445,
    longitude: 91.7362,
    isArecaHub: true,
  },
  // International Centers
  {
    id: 'singapore',
    name: 'Singapore',
    region: 'Southeast Asia',
    country: 'Singapore',
    latitude: 1.3521,
    longitude: 103.8198,
  },
  {
    id: 'tokyo',
    name: 'Tokyo',
    region: 'Kanto',
    country: 'Japan',
    latitude: 35.6762,
    longitude: 139.6503,
  },
  {
    id: 'london',
    name: 'London',
    region: 'England',
    country: 'United Kingdom',
    latitude: 51.5074,
    longitude: -0.1278,
  },
  {
    id: 'newyork',
    name: 'New York',
    region: 'NY',
    country: 'United States',
    latitude: 40.7128,
    longitude: -74.0060,
  },
];

export function getWeatherCondition(code: number): { label: string; icon: string; severity: 'clear' | 'cloudy' | 'rain' | 'storm' } {
  // WMO Weather interpretation codes (WW)
  if (code === 0) return { label: 'Clear Sky (Full Sun)', icon: 'Sun', severity: 'clear' };
  if (code === 1 || code === 2) return { label: 'Partly Cloudy', icon: 'CloudSun', severity: 'cloudy' };
  if (code === 3) return { label: 'Overcast Cloud Layer', icon: 'Cloud', severity: 'cloudy' };
  if (code === 45 || code === 48) return { label: 'Fog / Morning Mist', icon: 'CloudFog', severity: 'cloudy' };
  if (code >= 51 && code <= 55) return { label: 'Drizzle / Light Mist', icon: 'CloudDrizzle', severity: 'rain' };
  if (code >= 61 && code <= 65) return { label: 'Active Rain Showers', icon: 'CloudRain', severity: 'rain' };
  if (code >= 80 && code <= 82) return { label: 'Heavy Rain Pouring', icon: 'CloudRain', severity: 'rain' };
  if (code >= 95 && code <= 99) return { label: 'Thunderstorm with Downpour', icon: 'CloudLightning', severity: 'storm' };
  return { label: 'Variable Skies', icon: 'Cloud', severity: 'cloudy' };
}
