import http from "http";
import dotenv from "dotenv";

dotenv.config();

type Colors = {
  background: string;
  panel: string;
  border: string;
  accent1: string;
  accent2: string;
  accent3: string;
  text: string;
  muted: string;
};

type Config = {
  port: number;
  name: string;
  description: string;
  font: string;
  theme: string;
  shell: string;
  os: string;
  githubUser: string;
  githubToken: string;
  weatherLocation: string;
  weatherLat: number | null;
  weatherLon: number | null;
  locale: string;
  timezone: string;
  colors: Colors;
  asciiArt: string;
};

type GithubStats = {
  followers: number | null;
  stars: number | null;
  streak: number | null;
  contributions: number[];
};

type WeatherInfo = {
  temperature: number | null;
  summary: string;
  location: string;
};

type ViewData = {
  datetime: string;
  github: GithubStats;
  weather: WeatherInfo;
};

const defaultAsciiArt = `
             88MM             
            %$$$$W            
         $$$$$8M$$$$$         
      $$$$$8888MMMM$$$$$      
    MM$$$$@8      M@$$$$88    
$$$$$$MMM$$$$$  $$$$$888$$$$$$
MMM8$$$$$MMMB$$$$@888$$$$$B888
MMMMMMM$$$$$8MM88B$$$$$8888888
MMM88MMMMM$$$$$$$$$$88888MM888
MMM888  MMMMMB$$@88888  MMM888
MMM888     MMMM8888     MMM888
MMM888      MMM888      MMM888
MMM888      MMM888      MMM888
MMM888       MM88       MMM888
 MM88                    MM88 
`.trimEnd();

const env = (key: string, fallback: string = "") => {
  const value = process.env[key];
  if (value === undefined || value === "") return fallback;
  return value;
};

const envNumber = (key: string, fallback: number | null = null) => {
  const raw = process.env[key];
  if (raw === undefined || raw === "") return fallback;
  const value = Number(raw);
  return Number.isFinite(value) ? value : fallback;
};

const parseAsciiArt = () => {
  const art = process.env.ASCII_ART;
  if (!art) return defaultAsciiArt;
  return art.replace(/\\n/g, "\n");
};

const loadConfig = (): Config => ({
  port: envNumber("PORT") || 8787,
  name: env("OWNER_NAME"),
  description: env("OWNER_DESCRIPTION"),
  font: env("TERMINAL_FONT"),
  theme: env("TERMINAL_THEME"),
  shell: env("SHELL_NAME"),
  os: env("OS_NAME"),
  githubUser: env("GITHUB_USER"),
  githubToken: env("GITHUB_TOKEN"),
  weatherLocation: env("WEATHER_LOCATION"),
  weatherLat: envNumber("WEATHER_LAT"),
  weatherLon: envNumber("WEATHER_LON"),
  locale: env("DATETIME_LOCALE"),
  timezone: env("DATETIME_TIMEZONE"),
  colors: {
    background: env("COLOR_BACKGROUND", "#0e141c"),
    panel: env("COLOR_PANEL", "#121c27"),
    border: env("COLOR_BORDER", "#233443"),
    accent1: env("COLOR_ACCENT_1", "#66c2e6"),
    accent2: env("COLOR_ACCENT_2", "#ffc27a"),
    accent3: env("COLOR_ACCENT_3", "#98a7d3"),
    text: env("COLOR_TEXT", "#e7ecec"),
    muted: env("COLOR_MUTED", "#7d8a99"),
  },
  asciiArt: parseAsciiArt(),
});

const formatDatetime = (locale: string, timezone: string) => {
  const now = new Date();
  const formatter = new Intl.DateTimeFormat(locale, {
    timeZone: timezone,
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return formatter.format(now);
};

const sign = (value: number) => {
  if (value > 0) return `+${value}`;
  if (value < 0) return `${value}`;
  return "0";
};

const mapWeatherCode = (code: number) => {
  if (code === 0) return "Clear";
  if (code === 1 || code === 2 || code === 3) return "Clouds";
  if (code === 45 || code === 48) return "Fog";
  if (code === 51 || code === 53 || code === 55) return "Drizzle";
  if (code === 56 || code === 57) return "Freezing Drizzle";
  if (code === 61 || code === 63 || code === 65) return "Rain";
  if (code === 66 || code === 67) return "Freezing Rain";
  if (code === 71 || code === 73 || code === 75) return "Snow";
  if (code === 77) return "Snow Grains";
  if (code === 80 || code === 81 || code === 82) return "Rain Showers";
  if (code === 85 || code === 86) return "Snow Showers";
  if (code === 95) return "Thunderstorm";
  if (code === 96 || code === 99) return "Storm";
  return "N/A";
};

const truncated = (value: string, size: number) =>
  value.length <= size ? value : `${value.slice(0, size - 3)}...`;

const wrapText = (value: string, width: number) => {
  const words = value.split(" ");
  const lines: string[] = [];
  let current = "";
  for (const word of words) {
    if (current.length === 0) {
      current = word;
      continue;
    }
    if (current.length + 1 + word.length > width) {
      lines.push(current);
      current = word;
    } else {
      current += " " + word;
    }
  }
  if (current.length > 0) lines.push(current);
  return lines.length ? lines : [value];
};

const fetchJson = async (url: string, init?: RequestInit) => {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`Request failed ${res.status}`);
  return res.json();
};

const githubHeaders = (token: string) => {
  const headers: Record<string, string> = { "User-Agent": "kitty-fastfetch-widget" };
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
};

const fetchGithubStars = async (user: string, token: string) => {
  let page = 1;
  let stars = 0;
  while (page < 10) {
    const repos = await fetchJson(
      `https://api.github.com/users/${user}/repos?per_page=100&page=${page}`,
      { headers: githubHeaders(token) }
    );
    if (!Array.isArray(repos) || repos.length === 0) break;
    stars += repos.reduce(
      (acc: number, repo: { stargazers_count?: number }) =>
        acc + (repo.stargazers_count || 0),
      0
    );
    if (repos.length < 100) break;
    page += 1;
  }
  return stars;
};

const fetchGithubFollowers = async (user: string, token: string) => {
  const data = await fetchJson(`https://api.github.com/users/${user}`, {
    headers: githubHeaders(token),
  });
  return typeof data.followers === "number" ? data.followers : null;
};

const fetchGithubStreak = async (user: string, token: string) => {
  if (!token) return { streak: null, contributions: [] };
  const body = {
    query: `
      query($login:String!){
        user(login:$login){
          contributionsCollection{
            contributionCalendar{
              weeks{
                contributionDays{
                  date
                  contributionCount
                }
              }
            }
          }
        }
      }
    `,
    variables: { login: user },
  };
  const res = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: { ...githubHeaders(token), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) return { streak: null, contributions: [] };
  const payload = await res.json();
  const weeks =
    payload?.data?.user?.contributionsCollection?.contributionCalendar?.weeks;
  if (!weeks || !Array.isArray(weeks)) return { streak: null, contributions: [] };
  const days = weeks.flatMap(
    (week: { contributionDays: Array<{ date: string; contributionCount: number }> }) =>
      week.contributionDays
  );
  days.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  let streak = 0;
  for (const day of days) {
    const date = new Date(day.date);
    if (date.getTime() > Date.now()) continue;
    if (day.contributionCount > 0) streak += 1;
    else break;
  }
  const recent = days
    .filter((day) => new Date(day.date).getTime() <= Date.now())
    .slice(0, 98)
    .reverse()
    .map((day) => day.contributionCount ?? 0);
  return { streak, contributions: recent };
};

let githubCache: { data: GithubStats; at: number } | null = null;
const fetchGithubStats = async (config: Config) => {
  const ttl = 5 * 60 * 1000;
  if (githubCache && Date.now() - githubCache.at < ttl) return githubCache.data;
  try {
    const [followers, stars, streakData] = await Promise.all([
      fetchGithubFollowers(config.githubUser, config.githubToken),
      fetchGithubStars(config.githubUser, config.githubToken),
      fetchGithubStreak(config.githubUser, config.githubToken),
    ]);
    const data: GithubStats = {
      followers,
      stars,
      streak: streakData.streak,
      contributions: streakData.contributions,
    };
    githubCache = { data, at: Date.now() };
    return data;
  } catch {
    return { followers: null, stars: null, streak: null, contributions: [] };
  }
};

const fetchCoords = async (config: Config) => {
  if (config.weatherLat !== null && config.weatherLon !== null) {
    return { lat: config.weatherLat, lon: config.weatherLon };
  }
  const results = await fetchJson(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(
      config.weatherLocation
    )}&count=1`
  );
  const record = results?.results?.[0];
  if (!record) return null;
  return { lat: record.latitude, lon: record.longitude };
};

const fetchWeather = async (config: Config) => {
  const ttl = 10 * 60 * 1000;
  if (weatherCache && Date.now() - weatherCache.at < ttl) return weatherCache.data;
  try {
    const coords = await fetchCoords(config);
    if (!coords) throw new Error("coords");
    const data = await fetchJson(
      `https://api.open-meteo.com/v1/forecast?latitude=${coords.lat}&longitude=${coords.lon}&current_weather=true`
    );
    const weather = data?.current_weather;
    const node: WeatherInfo = {
      temperature:
        typeof weather?.temperature === "number" ? Math.round(weather.temperature) : null,
      summary:
        typeof weather?.weathercode === "number" ? mapWeatherCode(weather.weathercode) : "N/A",
      location: config.weatherLocation,
    };
    weatherCache = { data: node, at: Date.now() };
    return node;
  } catch {
    return { temperature: null, summary: "N/A", location: config.weatherLocation };
  }
};

let weatherCache: { data: WeatherInfo; at: number } | null = null;

const buildInfoLines = (config: Config, data: ViewData) => {
  const innerWidth = 50;
  const labelWidth = 11;
  const lines: Array<string> = [];
  const available = innerWidth - labelWidth - 3;
  const line = (label: string, value: string) => {
    const safe = truncated(value, available);
    const spacing = Math.max(innerWidth - labelWidth - 2 - safe.length, 0);
    lines.push(`│ ${label.padEnd(labelWidth, " ")}${safe}${" ".repeat(spacing)} │`);
  };
  const wrapped = (label: string, value: string) => {
    const chunks = wrapText(value, available);
    chunks.forEach((chunk, idx) => {
      const labelText = (idx === 0 ? label : "").padEnd(labelWidth, " ");
      const spacing = Math.max(innerWidth - labelWidth - 2 - chunk.length, 0);
      lines.push(`│ ${labelText}${chunk}${" ".repeat(spacing)} │`);
    });
  };
  const title = " manukq.sh ";
  const topBorder = `┌${title}${"─".repeat(innerWidth - title.length)}┐`;
  const bottomBorder = `└${"─".repeat(innerWidth)}┘`;
  lines.push(topBorder);
  line("name", config.name);
  wrapped("desc", config.description);
  line("datetime", data.datetime);
  lines.push(`├${"─".repeat(innerWidth)}┤`);
  line("font", config.font);
  line("theme", config.theme);
  line("shell", config.shell);
  line("os", config.os);
  lines.push(`├${"─".repeat(innerWidth)}┤`);
  line("streaks", formatNumber(data.github.streak));
  line("stars", formatNumber(data.github.stars));
  line("followers", formatNumber(data.github.followers));
  lines.push(`├${"─".repeat(innerWidth)}┤`);
  const weatherValue =
    data.weather.temperature === null
      ? "—"
      : `${data.weather.location}: ${sign(data.weather.temperature)}C ${data.weather.summary}`;
  line("weather", weatherValue);
  lines.push(bottomBorder);
  return { lines, innerWidth };
};

const formatNumber = (value: number | null) => (value === null ? "—" : `${value}`);

const escapeXml = (str: string) => 
  str.replace(/&/g, "&amp;")
     .replace(/</g, "&lt;")
     .replace(/>/g, "&gt;")
     .replace(/"/g, "&quot;")
     .replace(/'/g, "&apos;");

const renderSvg = (config: Config, data: ViewData) => {
  const asciiLines = config.asciiArt.split("\n");
  const { lines, innerWidth } = buildInfoLines(config, data);
  
  const lineHeight = 20;
  const fontSize = 15;
  const charWidth = 8.6;
  
  const maxAsciiChars = asciiLines.reduce((max, line) => Math.max(max, line.length), 0);
  const asciiWidth = Math.ceil(maxAsciiChars * charWidth);
  const asciiHeight = asciiLines.length * lineHeight;
  
  const maxInfoChars = lines.reduce((max, line) => Math.max(max, line.length), 0);
  const infoWidth = Math.ceil(maxInfoChars * charWidth);
  const infoHeight = lines.length * lineHeight;
  
  const padding = 24;
  const gap = 32;
  const topMargin = 48;
  
  const contentWidth = asciiWidth + gap + infoWidth;
  const totalWidth = contentWidth + padding * 2;
  
  const startX = padding;
  const asciiX = startX;
  const infoX = asciiX + asciiWidth + gap;
  
  const maxContentHeight = Math.max(asciiHeight, infoHeight);
  const asciiY = topMargin + (maxContentHeight > asciiHeight ? (maxContentHeight - asciiHeight) / 2 : 0);
  const infoY = topMargin + (maxContentHeight > infoHeight ? (maxContentHeight - infoHeight) / 2 : 0);
  
  const paletteY = asciiY + asciiHeight + 16;
  const paletteColors = ["#1e1e2e", "#f38ba8", "#f9e2af", "#a6e3a1", "#89b4fa", "#f5c2e7", "#94e2d5", "#cdd6f4"];
  const paletteSquareSize = 26;
  
  const chartY = infoY + infoHeight;
  
  const contributions = data.github.contributions.length
    ? data.github.contributions.slice(-98)
    : Array.from({ length: 98 }, () => 0);
  const maxContrib = Math.max(...contributions, 1);
  
  const rows = 7;
  const cols = 14;
  const chartContentWidth = infoWidth - 32;
  const totalSquareSpace = chartContentWidth;
  const squareSize = Math.floor((totalSquareSpace - (cols - 1) * 3) / cols);
  const squareGap = 3;
  const chartPadding = 16;
  const chartTopPadding = 42;
  
  const squares = contributions.slice(0, cols * rows).map((value, idx) => {
    const col = idx % cols;
    const row = Math.floor(idx / cols);
    const x = chartPadding + col * (squareSize + squareGap);
    const y = chartTopPadding + row * (squareSize + squareGap);
    const intensity = Math.min(1, value / maxContrib);
    const colorIdx = col % 3;
    const baseColor = colorIdx === 0 ? config.colors.accent1 : colorIdx === 1 ? config.colors.accent2 : config.colors.accent3;
    const opacity = intensity === 0 ? 0.12 : 0.35 + intensity * 0.65;
    return `<rect x="${x}" y="${y}" width="${squareSize}" height="${squareSize}" fill="${baseColor}" opacity="${opacity}" rx="2"/>`;
  }).join("");
  
  const activityHeight = chartTopPadding + rows * (squareSize + squareGap) + 16;
  const chartHeight = activityHeight + 20;
  
  const totalHeight = Math.max(paletteY + 40, chartY + chartHeight) + padding + 20;
  
  const activityTitle = " activity ";
  const activityTopBorder = `┌${activityTitle}${"─".repeat(innerWidth - activityTitle.length)}┐`;
  const activityLines: string[] = [];
  activityLines.push(activityTopBorder);
  const activityBottomBorder = `└${"─".repeat(innerWidth)}┘`;
  
  return [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalWidth}" height="${totalHeight}" viewBox="0 0 ${totalWidth} ${totalHeight}" role="img" aria-label="MNQ Shell widget">`,
    `<rect x="0" y="0" width="${totalWidth}" height="${totalHeight}" fill="${config.colors.panel}"/>`,
    `<rect x="0" y="0" width="${totalWidth}" height="32" rx="0" fill="${config.colors.background}" stroke="${config.colors.border}" stroke-width="1"/>`,
    `<circle cx="${padding + 14}" cy="16" r="5" fill="#ff5f56"/>`,
    `<circle cx="${padding + 32}" cy="16" r="5" fill="#ffbd2e"/>`,
    `<circle cx="${padding + 50}" cy="16" r="5" fill="#27c93f"/>`,
    `<text x="${padding + 72}" y="20" fill="${config.colors.text}" font-family="${config.font}, ui-monospace, monospace" font-size="13">MNQ Shell</text>`,
    `<g transform="translate(${asciiX} ${asciiY})">`,
    asciiLines
      .map((line, index) =>
        `<text x="0" y="${(index + 1) * lineHeight}" fill="${config.colors.accent1}" font-family="${config.font}, ui-monospace, monospace" font-size="${fontSize}" xml:space="preserve">${escapeXml(line)}</text>`
      )
      .join(""),
    `</g>`,
    `<g transform="translate(${asciiX} ${paletteY})">`,
    paletteColors.map((color, idx) => 
      `<rect x="${idx * paletteSquareSize}" y="0" width="${paletteSquareSize}" height="${paletteSquareSize}" fill="${color}" rx="0"/>`
    ).join(""),
    `</g>`,
    `<g transform="translate(${infoX} ${infoY})">`,
    lines.map((line, index) => {
      if (index === 0 || index === lines.length - 1) {
        return `<text x="0" y="${(index + 1) * lineHeight}" fill="${config.colors.border}" font-family="${config.font}, ui-monospace, monospace" font-size="${fontSize}" xml:space="preserve">${line}</text>`;
      }
      const decorated = line
        .replace(/[│┌┐└┘├┤─]/g, (char) => `<tspan fill="${config.colors.border}">${char}</tspan>`)
        .replace(/\b(name|desc|datetime|font|theme|shell|os|streaks|stars|followers|weather)\b/g, (match) => {
          const colorMap: Record<string, string> = {
            name: config.colors.accent1,
            font: config.colors.accent1,
            streaks: config.colors.accent1,
            os: config.colors.accent1,
            desc: config.colors.accent2,
            theme: config.colors.accent2,
            stars: config.colors.accent2,
            datetime: config.colors.accent3,
            shell: config.colors.accent3,
            followers: config.colors.accent3,
            weather: config.colors.accent3,
          };
          return `<tspan fill="${colorMap[match] || config.colors.text}">${match}</tspan>`;
        });
      return `<text x="0" y="${(index + 1) * lineHeight}" fill="${config.colors.muted}" font-family="${config.font}, ui-monospace, monospace" font-size="${fontSize}" xml:space="preserve">${decorated}</text>`;
    }).join(""),
    `</g>`,
    `<g transform="translate(${infoX} ${chartY})">`,
    `<text x="0" y="14" fill="${config.colors.border}" font-family="${config.font}, ui-monospace, monospace" font-size="${fontSize}" xml:space="preserve">${activityTopBorder}</text>`,
    squares,
    `<text x="0" y="${activityHeight + 6}" fill="${config.colors.border}" font-family="${config.font}, ui-monospace, monospace" font-size="${fontSize}" xml:space="preserve">${activityBottomBorder}</text>`,
    `</g>`,
    `</svg>`,
  ].join("");
};

const buildViewData = async (config: Config): Promise<ViewData> => {
  const [github, weather] = await Promise.all([fetchGithubStats(config), fetchWeather(config)]);
  return {
    datetime: formatDatetime(config.locale, config.timezone),
    github,
    weather,
  };
};

const config = loadConfig();

const server = http.createServer(async (req, res) => {
  if (!req.url) {
    res.writeHead(400, { "Content-Type": "text/plain" });
    res.end("Bad Request");
    return;
  }
  if (req.url.startsWith("/health")) {
    res.writeHead(200, { "Content-Type": "text/plain" });
    res.end("ok");
    return;
  }
  try {
    const data = await buildViewData(config);
    const svg = renderSvg(config, data);
    res.writeHead(200, {
      "Content-Type": "image/svg+xml",
      "Cache-Control": "no-store",
    });
    res.end(svg);
  } catch (error) {
    res.writeHead(500, { "Content-Type": "text/plain" });
    res.end("Internal Server Error");
  }
});

server.listen(config.port, () => {
  process.stdout.write(`Widget running on http://localhost:${config.port}\n`);
});
