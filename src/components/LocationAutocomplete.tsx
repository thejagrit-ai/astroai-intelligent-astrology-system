import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MapPin, Loader2, Search } from 'lucide-react';
import { Input } from '@/components/ui/input';

interface LocationAutocompleteProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
}

export default function LocationAutocomplete({ 
  value, 
  onChange, 
  placeholder = "Enter city, country",
  className = "",
  required = false
}: LocationAutocompleteProps) {
  const [query, setQuery] = useState(value);
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.length < 3) {
      setSuggestions([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&addressdetails=1&limit=6`
        );
        const data = await response.json();
        const results = data.map((item: any) => item.display_name);
        setSuggestions(results);
        setShowDropdown(true);
      } catch (error) {
        console.error('Error fetching locations:', error);
      } finally {
        setLoading(false);
      }
    }, 400);

    return () => clearTimeout(timer);
  }, [query]);

  const handleSelect = (suggestion: string) => {
    setQuery(suggestion);
    onChange(suggestion);
    setShowDropdown(false);
  };

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <div className="relative group">
        <MapPin className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500 group-focus-within:text-indigo-400 transition-colors" size={18} />
        <Input
          required={required}
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            // Also update parent if it's being cleared
            if (e.target.value === '') onChange('');
          }}
          placeholder={placeholder}
          className={`pl-12 bg-slate-950/50 border-slate-800 focus:border-indigo-500 h-12 rounded-xl transition-all ${className}`}
          onFocus={() => query.length >= 3 && suggestions.length > 0 && setShowDropdown(true)}
        />
        {loading && (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <Loader2 className="animate-spin text-indigo-500" size={16} />
          </div>
        )}
      </div>

      <AnimatePresence>
        {showDropdown && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-[100] w-full mt-2 bg-[#0a0a14] border border-slate-800 rounded-2xl shadow-2xl overflow-hidden backdrop-blur-xl"
          >
            <div className="max-h-[240px] overflow-y-auto custom-scrollbar">
              {suggestions.map((suggestion, index) => (
                <button
                  key={index}
                  type="button"
                  onClick={() => handleSelect(suggestion)}
                  className="w-full text-left px-5 py-3 text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors border-b border-white/5 last:border-0 flex items-start gap-3"
                >
                  <Search size={14} className="mt-1 flex-shrink-0 text-slate-600" />
                  <span className="line-clamp-2">{suggestion}</span>
                </button>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
