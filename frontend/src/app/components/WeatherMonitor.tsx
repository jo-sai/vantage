import { useState, useEffect } from "react";
import { 
  Sun, Cloud, CloudRain, CloudSnow, CloudLightning, 
  Wind, Thermometer, Droplets, AlertTriangle, MapPin, 
  Loader2, RefreshCw, Sparkles, CheckCircle2
} from "lucide-react";

interface WeatherData {
  current: {
    temp: number;
    humidity: number;
    windSpeed: number;
    weatherCode: number;
    precipitation: number;
  };
  daily: Array<{
    date: string;
    tempMax: number;
    tempMin: number;
    weatherCode: number;
    windSpeedMax: number;
    precipitationSum: number;
    risk: {
      level: "low" | "medium" | "high";
      message: string;
    };
  }>;
}

function getWeatherDetails(code: number) {
  if (code === 0) return { label: "Clear Sky", Icon: Sun, color: "text-amber-400" };
  if ([1, 2, 3].includes(code)) return { label: "Partly Cloudy", Icon: Cloud, color: "text-blue-300" };
  if ([45, 48].includes(code)) return { label: "Foggy", Icon: Cloud, color: "text-gray-400" };
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { label: "Rainy", Icon: CloudRain, color: "text-cyan-400" };
  if ([71, 73, 75, 85, 86].includes(code)) return { label: "Snowy", Icon: CloudSnow, color: "text-blue-100" };
  if ([95, 96, 99].includes(code)) return { label: "Thunderstorm", Icon: CloudLightning, color: "text-purple-400" };
  return { label: "Cloudy", Icon: Cloud, color: "text-gray-300" };
}

interface WeatherMonitorProps {
  onWeatherImpactsChange?: (impacts: Array<{ day: number; severity: "medium" | "high"; description: string }>) => void;
  selectedSiteName?: string;
  onSiteNameChange?: (name: string) => void;
}

export function WeatherMonitor({ onWeatherImpactsChange, selectedSiteName, onSiteNameChange }: WeatherMonitorProps) {
  const [activeSiteName, setActiveSiteName] = useState<string>("Seattle");
  const [resolvedCountry, setResolvedCountry] = useState<string>("United States");
  const [weatherData, setWeatherData] = useState<WeatherData | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [syncToTimeline, setSyncToTimeline] = useState<boolean>(true);
  const [searchInput, setSearchInput] = useState<string>("");

  const fetchWeather = async (cityName: string, countryName: string, lat: number, lng: number) => {
    setLoading(true);
    setError(null);
    try {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current=temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_sum,wind_speed_10m_max&timezone=auto`;
      const response = await fetch(url);
      if (!response.ok) throw new Error("Failed to fetch live weather data.");
      const data = await response.json();

      // Transform API response to our custom interface
      const current = {
        temp: data.current.temperature_2m,
        humidity: data.current.relative_humidity_2m,
        windSpeed: data.current.wind_speed_10m,
        weatherCode: data.current.weather_code,
        precipitation: data.current.precipitation,
      };

      const daily = data.daily.time.map((timeStr: string, idx: number) => {
        const weatherCode = data.daily.weather_code[idx];
        const windSpeedMax = data.daily.wind_speed_10m_max[idx];
        const precip = data.daily.precipitation_sum[idx];
        
        // Formulate smart construction risks
        let level: "low" | "medium" | "high" = "low";
        let message = "No weather risks. Perfect for operations.";

        if ([95, 96, 99].includes(weatherCode)) {
          level = "high";
          message = "Thunderstorm Alert: Immediate suspension of all exterior and structural framework.";
        } else if (windSpeedMax > 22) {
          level = "high";
          message = `High Winds (${Math.round(windSpeedMax)} km/h): Crane and scaffolding operations restricted.`;
        } else if (precip > 15) {
          level = "high";
          message = `Heavy Rain (${precip}mm): Concrete pouring and site excavation delayed.`;
        } else if (precip > 2) {
          level = "medium";
          message = `Moderate Drizzle (${precip}mm): Exterior painting/finishing suspended.`;
        } else if ([71, 73, 75].includes(weatherCode)) {
          level = "high";
          message = "Snowfall: Freezing hazards, scaffolding safety check required.";
        }

        return {
          date: new Date(timeStr).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" }),
          tempMax: data.daily.temperature_2m_max[idx],
          tempMin: data.daily.temperature_2m_min[idx],
          weatherCode,
          windSpeedMax,
          precipitationSum: precip,
          risk: { level, message }
        };
      });

      const parsedData: WeatherData = { current, daily };
      setWeatherData(parsedData);

      // Trigger callback if we need to sync to timeline
      if (onWeatherImpactsChange && syncToTimeline) {
        const generatedImpacts = daily
          .map((d: any, idx: number) => {
            if (d.risk.level !== "low") {
              return {
                day: 18 + idx,
                severity: d.risk.level,
                description: `${d.risk.message.split(":")[0]} (${cityName})`
              };
            }
            return null;
          })
          .filter(Boolean) as Array<{ day: number; severity: "medium" | "high"; description: string }>;

        onWeatherImpactsChange(generatedImpacts);
      }

    } catch (err: any) {
      console.error(err);
      setError("Unable to sync with live weather satellites. Please verify your internet connection.");
    } finally {
      setLoading(false);
    }
  };

  const geocodeCity = async (cityName: string) => {
    if (!cityName.trim()) return;
    setLoading(true);
    setError(null);
    try {
      const geoUrl = `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cityName.trim())}&count=1&language=en&format=json`;
      const geoRes = await fetch(geoUrl);
      if (!geoRes.ok) throw new Error("Geocoding service unavailable.");
      const geoData = await geoRes.json();
      
      if (!geoData.results || geoData.results.length === 0) {
        throw new Error(`City "${cityName}" not found. Please verify spelling.`);
      }

      const result = geoData.results[0];
      const name = result.name;
      const country = result.country || "";
      const lat = result.latitude;
      const lng = result.longitude;

      setActiveSiteName(name);
      setResolvedCountry(country);
      
      // Fetch live weather data for coordinates
      await fetchWeather(name, country, lat, lng);
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to resolve city location.");
      setLoading(false);
    }
  };

  // Sync with parent-directed location changes
  useEffect(() => {
    if (selectedSiteName) {
      geocodeCity(selectedSiteName);
    }
  }, [selectedSiteName]);

  // Initial geocoding on mount
  useEffect(() => {
    if (!selectedSiteName) {
      geocodeCity("Seattle");
    }
  }, []);

  // Handle manual trigger when toggle changes
  useEffect(() => {
    if (weatherData && onWeatherImpactsChange) {
      if (syncToTimeline) {
        const generatedImpacts = weatherData.daily
          .map((d, idx) => {
            if (d.risk.level !== "low") {
              return {
                day: 18 + idx,
                severity: d.risk.level,
                description: `${d.risk.message.split(":")[0]} (${activeSiteName})`
              };
            }
            return null;
          })
          .filter(Boolean) as Array<{ day: number; severity: "medium" | "high"; description: string }>;
        onWeatherImpactsChange(generatedImpacts);
      } else {
        onWeatherImpactsChange([]);
      }
    }
  }, [syncToTimeline, activeSiteName]);

  const handleSearch = () => {
    if (searchInput.trim()) {
      geocodeCity(searchInput);
      if (onSiteNameChange) {
        onSiteNameChange(searchInput.trim());
      }
      setSearchInput("");
    }
  };

  const currentDetails = weatherData ? getWeatherDetails(weatherData.current.weatherCode) : null;
  const CurrentIcon = currentDetails ? currentDetails.Icon : Cloud;

  return (
    <div className="rounded-lg bg-[var(--glass-bg)] border border-[var(--glass-border)] p-5 backdrop-blur-xl transition-all shadow-[0_4px_30px_rgba(0,0,0,0.2)]">
      {/* Top Selector Panel */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[var(--glass-border)]">
        <div className="flex items-center gap-3">
          <div className="size-10 rounded-lg bg-orange-500/10 flex items-center justify-center border border-orange-500/30">
            <MapPin size={20} className="text-orange-400 animate-pulse" />
          </div>
          <div>
            <h3 className="text-white text-base font-semibold flex items-center gap-2">
              Live Weather Monitoring Station
              <span className="px-2 py-0.5 rounded text-[10px] bg-sky-500/20 text-sky-400 border border-sky-500/30 flex items-center gap-1 font-normal animate-pulse">
                <Sparkles size={10} /> Live Geocoding API
              </span>
            </h3>
            <p className="text-xs text-[var(--cool-gray)]">Predictive global operational risk analyzer for site workflows</p>
          </div>
        </div>

        <div className="flex items-center gap-4">
          {/* Sync Switch */}
          <button
            onClick={() => setSyncToTimeline(!syncToTimeline)}
            className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all flex items-center gap-1.5 ${
              syncToTimeline 
                ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]'
                : 'bg-white/5 border-[var(--glass-border)] text-[var(--cool-gray)]'
            }`}
          >
            {syncToTimeline ? <CheckCircle2 size={13} /> : <RefreshCw size={13} />}
            <span>{syncToTimeline ? "Connected to Gantt" : "Static Gantt Mode"}</span>
          </button>

          {/* City Free-text Search Input */}
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search any city..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              className="px-3 py-1.5 bg-[var(--deep-slate)] border border-[var(--glass-border)] rounded-lg text-white text-xs font-medium focus:outline-none focus:ring-2 focus:ring-[var(--action-blue)] transition-all placeholder:text-[var(--cool-gray)]/50 w-40"
            />
            <button
              onClick={handleSearch}
              className="px-3 py-1.5 rounded-lg bg-[var(--action-blue)] hover:bg-[var(--action-blue)]/80 text-white text-xs font-semibold transition-all shadow-[0_0_15px_rgba(59,130,246,0.25)]"
            >
              Search
            </button>
          </div>

          <button
            onClick={() => geocodeCity(activeSiteName)}
            className="p-1.5 rounded-lg hover:bg-white/5 border border-[var(--glass-border)] text-[var(--cool-gray)] hover:text-white transition-all"
            disabled={loading}
          >
            <RefreshCw size={14} className={loading ? "animate-spin" : ""} />
          </button>
        </div>
      </div>

      {loading ? (
        <div className="h-48 flex flex-col items-center justify-center gap-3">
          <Loader2 className="animate-spin text-[var(--action-blue)]" size={32} />
          <span className="text-sm text-[var(--cool-gray)]">Contacting satellite relays...</span>
        </div>
      ) : error ? (
        <div className="py-8 flex flex-col items-center text-center">
          <AlertTriangle className="text-red-500 mb-2" size={36} />
          <span className="text-sm text-white mb-1 font-medium">Location Lookup Error</span>
          <p className="text-xs text-[var(--cool-gray)] max-w-sm">{error}</p>
          <button 
            onClick={() => geocodeCity("Seattle")}
            className="mt-4 px-3 py-1.5 rounded bg-white/5 border border-[var(--glass-border)] text-xs text-white hover:bg-white/10"
          >
            Reset to Seattle
          </button>
        </div>
      ) : weatherData ? (
        <div className="mt-5 space-y-5">
          {/* Main Current Panel */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 rounded-xl bg-gradient-to-br from-white/[0.03] to-transparent border border-white/5">
            {/* Temp & Status */}
            <div className="flex items-center gap-4 md:border-r border-white/5 pr-4">
              <CurrentIcon size={44} className={`${currentDetails?.color} drop-shadow-[0_0_15px_currentColor]`} />
              <div>
                <div className="text-3xl font-extrabold text-white tracking-tight">
                  {Math.round(weatherData.current.temp)}°C
                </div>
                <div className="text-xs font-medium text-white/80">{currentDetails?.label}</div>
                <div className="text-[10px] text-[var(--cool-gray)] mt-1 flex items-center gap-1 font-semibold text-orange-400">
                  📍 {activeSiteName}{resolvedCountry ? `, ${resolvedCountry}` : ""}
                </div>
              </div>
            </div>

            {/* Humidity */}
            <div className="flex items-center gap-3 md:border-r border-white/5 pr-4 md:pl-4">
              <Droplets size={20} className="text-sky-400" />
              <div>
                <div className="text-xs text-[var(--cool-gray)]">Relative Humidity</div>
                <div className="text-sm font-semibold text-white">{weatherData.current.humidity}%</div>
                <div className="text-[10px] text-white/50">{weatherData.current.precipitation}mm current precip.</div>
              </div>
            </div>

            {/* Wind */}
            <div className="flex items-center gap-3 md:border-r border-white/5 pr-4 md:pl-4">
              <Wind size={20} className="text-teal-400" />
              <div>
                <div className="text-xs text-[var(--cool-gray)]">Wind Velocity</div>
                <div className="text-sm font-semibold text-white">{Math.round(weatherData.current.windSpeed)} km/h</div>
                <div className="text-[10px] text-white/50">
                  {weatherData.current.windSpeed > 22 ? "🚨 Crane operations unsafe" : "🟢 Safe wind speed limits"}
                </div>
              </div>
            </div>

            {/* Realtime Risk Status */}
            <div className="flex flex-col justify-center md:pl-4">
              <span className="text-xs text-[var(--cool-gray)] mb-1">Operational Threat Level</span>
              {weatherData.daily[0].risk.level === "high" ? (
                <div className="px-2.5 py-1 rounded bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-semibold flex items-center gap-1.5 w-fit animate-pulse">
                  <AlertTriangle size={12} /> HIGH RISK LIMIT
                </div>
              ) : weatherData.daily[0].risk.level === "medium" ? (
                <div className="px-2.5 py-1 rounded bg-amber-500/10 border border-amber-500/20 text-amber-400 text-xs font-semibold flex items-center gap-1.5 w-fit">
                  <AlertTriangle size={12} /> MODERATE RISK
                </div>
              ) : (
                <div className="px-2.5 py-1 rounded bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold flex items-center gap-1.5 w-fit">
                  <CheckCircle2 size={12} /> OPTIMAL SAFETY
                </div>
              )}
            </div>
          </div>

          {/* 7-Day Forecast Grid */}
          <div>
            <h4 className="text-xs font-bold text-white uppercase tracking-wider mb-3">7-Day Operational Outlook & Risks</h4>
            <div className="grid grid-cols-2 md:grid-cols-7 gap-2">
              {weatherData.daily.map((day, idx) => {
                const dayDetails = getWeatherDetails(day.weatherCode);
                const DayIcon = dayDetails.Icon;
                const isHighRisk = day.risk.level === "high";
                const isMedRisk = day.risk.level === "medium";

                return (
                  <div 
                    key={idx} 
                    className={`p-3 rounded-lg border flex flex-col items-center text-center transition-all ${
                      isHighRisk 
                        ? 'bg-red-500/[0.08] border-red-500/30 shadow-[0_0_15px_rgba(239,68,68,0.1)]' 
                        : isMedRisk 
                          ? 'bg-amber-500/[0.08] border-amber-500/30' 
                          : 'bg-white/[0.01] border-white/5 hover:bg-white/[0.03]'
                    }`}
                  >
                    <span className="text-[10px] text-[var(--cool-gray)] font-medium mb-1.5">{day.date}</span>
                    <DayIcon size={22} className={`${dayDetails.color} mb-1.5`} />
                    <div className="text-xs font-bold text-white mb-0.5">
                      {Math.round(day.tempMax)}°<span className="text-[var(--cool-gray)] font-normal">/{Math.round(day.tempMin)}°</span>
                    </div>
                    
                    {/* Risk Dot Indicator */}
                    <div className="mt-2 w-full flex justify-center">
                      {isHighRisk ? (
                        <div className="size-2 rounded-full bg-red-400 animate-pulse animate-ping" title={day.risk.message}></div>
                      ) : isMedRisk ? (
                        <div className="size-2 rounded-full bg-amber-400" title={day.risk.message}></div>
                      ) : (
                        <div className="size-1.5 rounded-full bg-white/25"></div>
                      )}
                    </div>

                    {/* Simple Risk Tooltip description under */}
                    {(isHighRisk || isMedRisk) && (
                      <span className="text-[9px] text-[var(--cool-gray)] mt-1.5 max-w-[80px] truncate" title={day.risk.message}>
                        {day.risk.message.split(":")[0]}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Active Risk Advisories Banner */}
          {weatherData.daily.some(d => d.risk.level !== "low") && (
            <div className="p-3 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-start gap-3">
              <AlertTriangle size={16} className="text-orange-400 shrink-0 mt-0.5" />
              <div>
                <div className="text-xs font-bold text-white">Active Timeline Risk Advisories</div>
                <div className="text-[11px] text-[var(--cool-gray)] mt-1 space-y-1">
                  {weatherData.daily.map((day, idx) => {
                    if (day.risk.level !== "low") {
                      return (
                        <div key={idx} className="flex items-center gap-1.5">
                          <span className="font-bold text-orange-400">{day.date} (Day {18 + idx}):</span>
                          <span>{day.risk.message}</span>
                        </div>
                      );
                    }
                    return null;
                  })}
                </div>
              </div>
            </div>
          )}
        </div>
      ) : null}
    </div>
  );
}
