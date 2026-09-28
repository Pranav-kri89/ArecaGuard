import React, { useState, useEffect, useRef } from 'react';
import {
  MapPin,
  Search,
  X,
  Compass,
  Check,
  Loader2,
  Navigation,
} from 'lucide-react';
import { LocationItem } from '../types';
import { POPULAR_LOCATIONS } from '../utils/locations';

interface LocationPickerModalProps {
  isOpen: boolean;
  onClose: () => void;
  selectedLocation: LocationItem;
  onSelectLocation: (loc: LocationItem) => void;
}

export const LocationPickerModal: React.FC<LocationPickerModalProps> = ({
  isOpen,
  onClose,
  selectedLocation,
  onSelectLocation,
}) => {
  const [query, setQuery] = useState('');
  const [searchResults, setSearchResults] = useState<LocationItem[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    } else {
      setQuery('');
      setSearchResults([]);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!query || query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/search-location?q=${encodeURIComponent(query.trim())}`);
        if (res.ok) {
          const data = await res.json();
          setSearchResults(data.results || []);
        }
      } catch (err) {
        console.warn('Geocoding search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 280);

    return () => clearTimeout(timer);
  }, [query]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-black/80 backdrop-blur-sm animate-fade-in">
      <div
        className="w-full max-w-md bg-slate-900 border border-slate-700/80 rounded-3xl p-4 sm:p-5 shadow-2xl flex flex-col max-h-[85vh] overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-xl bg-sky-500/10 text-sky-400">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-white">Select Farm Location</h3>
              <p className="text-[11px] text-slate-400">
                Weather radar & satellite forecast data source
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 text-slate-400 hover:text-white hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Search Bar */}
        <div className="my-3 relative">
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search city, town, taluk, village..."
            className="w-full bg-slate-950 border border-slate-700 rounded-2xl pl-10 pr-9 py-2.5 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-sky-500 focus:ring-1 focus:ring-sky-500"
          />
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3 pointer-events-none" />
          {isSearching ? (
            <Loader2 className="w-4 h-4 text-sky-400 animate-spin absolute right-3 top-3 pointer-events-none" />
          ) : query ? (
            <button
              onClick={() => setQuery('')}
              className="absolute right-3 top-3 text-slate-500 hover:text-slate-300 cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          ) : null}
        </div>

        {/* Search Results or Hubs List */}
        <div className="flex-1 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
          {query.trim().length >= 2 ? (
            searchResults.length > 0 ? (
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider">
                  Search Results
                </span>
                {searchResults.map((loc) => {
                  const isSelected =
                    selectedLocation.name === loc.name &&
                    Math.abs(selectedLocation.latitude - loc.latitude) < 0.05;
                  return (
                    <button
                      key={loc.id || `${loc.latitude}-${loc.longitude}`}
                      onClick={() => {
                        onSelectLocation(loc);
                        onClose();
                      }}
                      className={`w-full p-2.5 rounded-xl text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                        isSelected
                          ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
                          : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800/60'
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        <MapPin className="w-4 h-4 text-sky-400 shrink-0" />
                        <div>
                          <div className="font-bold text-white">{loc.name}</div>
                          <div className="text-[10px] text-slate-400">
                            {loc.region ? `${loc.region}, ` : ''}{loc.country}
                          </div>
                        </div>
                      </div>
                      {isSelected && <Check className="w-4 h-4 text-sky-400 shrink-0" />}
                    </button>
                  );
                })}
              </div>
            ) : !isSearching ? (
              <div className="text-center py-8 text-xs text-slate-500">
                No locations found matching &quot;{query}&quot;. Try a nearby city or district.
              </div>
            ) : null
          ) : (
            <div className="space-y-2">
              {/* Current Active Location */}
              <div className="p-3 rounded-2xl bg-sky-950/40 border border-sky-500/40 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full bg-sky-400 animate-pulse shrink-0" />
                  <div>
                    <span className="text-[10px] font-bold uppercase text-sky-400">
                      Currently Selected
                    </span>
                    <div className="text-xs font-bold text-white">{selectedLocation.name}</div>
                    <div className="text-[10px] text-slate-400">{selectedLocation.region}</div>
                  </div>
                </div>
                <span className="text-[10px] font-mono text-sky-300 bg-sky-900/60 px-2 py-0.5 rounded border border-sky-500/30">
                  Active
                </span>
              </div>

              {/* Popular Agricultural Hubs */}
              <div className="pt-2">
                <span className="text-[10px] font-bold text-slate-400 px-2 uppercase tracking-wider block mb-1.5">
                  Popular Arecanut &amp; Agricultural Hubs
                </span>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                  {POPULAR_LOCATIONS.map((loc) => {
                    const isSelected = selectedLocation.name === loc.name;
                    return (
                      <button
                        key={loc.name}
                        onClick={() => {
                          onSelectLocation(loc);
                          onClose();
                        }}
                        className={`p-2.5 rounded-xl text-left text-xs transition-all flex items-center justify-between cursor-pointer ${
                          isSelected
                            ? 'bg-sky-500/20 text-sky-200 border border-sky-500/50'
                            : 'bg-slate-950/60 hover:bg-slate-800 text-slate-300 border border-slate-800/60'
                        }`}
                      >
                        <div className="truncate pr-1">
                          <div className="font-semibold text-white truncate">{loc.name}</div>
                          <div className="text-[10px] text-slate-500 truncate">{loc.region}</div>
                        </div>
                        {isSelected ? (
                          <Check className="w-3.5 h-3.5 text-sky-400 shrink-0" />
                        ) : (
                          <Compass className="w-3 h-3 text-slate-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="pt-3 mt-2 border-t border-slate-800 text-center text-[11px] text-slate-500 flex items-center justify-center gap-1">
          <Navigation className="w-3 h-3 text-slate-400" />
          <span>Coordinates: {selectedLocation.latitude.toFixed(3)}° N, {selectedLocation.longitude.toFixed(3)}° E</span>
        </div>
      </div>
    </div>
  );
};
