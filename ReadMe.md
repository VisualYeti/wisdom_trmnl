## Daily Quotes from The Wisdom Project

Display a daily quote from Merlin Mann's "The Wisdom Project" - [wisdom.limo](http://wisdom.limo)

---

### Web client
Preview the [web client ](https://wisdom.visualyeti.com)

---
### TRMNL recipe and private plugin

#### Now available as a Trmnl recipe

Follow the link below and click install

[Wisdom Document Plugin Trmnl Recipe](https://usetrmnl.com/recipes/100671)

---

#### Private plugin install
To create your own version as a private plugin:
- Create a new private plugin
- paste the relevant src file into the markup (Full, Half horizontal, etc...)
- be sure to copy the src from shared.liquid into your Shared markup

<img src="screenshot.png" alt="TRMNL recipe/plugin screenshot" width="500">

#### Dev
Use dev.sh to start the TRMNL docker container and preview the plugin
```bash
./dev.sh
```
To rebuild the image
```bash
./dev.sh --rebuild
```

---

### Quote Server
Quotes are now served through an api. You can either host your own quote server, or use the public api
#### Public (no authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/v1/health` | Health check (rate limited: 10/min per IP) |
| GET | `/api/v1/quote/public` | Get today's quote (rate limited: 10/min per IP) |
| GET | `/api/v1/quote/public?date=YYYY-MM-DD` | Get specific date's quote (rate limited: 10/min per IP) |

#### More details in the [Server README](srv/README.md)

