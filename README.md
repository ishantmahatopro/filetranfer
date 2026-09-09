# Location sharing page

A single-file, consent-based web page that asks a visitor to share their
location. It shows the precise coordinates, accuracy, and approximate address,
and can optionally forward them to a webhook you control. Access is gated so the
page won't run under certain VPN / location conditions.

This is a **transparent** tool: the page tells the visitor what it does, and the
browser shows its own location-permission prompt. It is meant for people who
knowingly share their location (meetups, field check-ins, "where are you"
links), not for tracking anyone without their knowledge.

## Use it

Just open `index.html`, or host it (GitHub Pages works):

1. Push this branch.
2. Repo → Settings → Pages → deploy from this branch, root.
3. Share the resulting `https://…` URL. **HTTPS is required** — the browser
   Geolocation API will not work over plain HTTP.

## Configure

Edit the `CONFIG` block at the top of the `<script>` in `index.html`:

| Key | What it does |
|-----|--------------|
| `bangalore` | Centre `{lat,lng}` and `radiusKm` that define "inside Bangalore". |
| `vpnapiKey` | Free key from <https://vpnapi.io> to enable VPN/proxy/Tor detection. Leave `""` to skip it. |
| `recipientName` | Name shown in the consent notice ("…shared with X"). |
| `webhookUrl` | Optional endpoint (your own, or Formspree/Make/Zapier) the location is POSTed to as JSON. Leave `""` to only show it on screen. |
| `shouldBlock(ctx)` | The access rule. Return `true` to block. |

### Access rule

`shouldBlock({ isVPN, insideBangalore })` decides who is turned away. The
default, matching the request, blocks only when the visitor is **both** on a
VPN **and** outside Bangalore:

```js
return ctx.isVPN && !ctx.insideBangalore;
```

Two other common rules are included as comments — allow only inside Bangalore
and block VPN entirely, or allow everywhere except Bangalore. Change the one
line to switch.

The Bangalore check uses the **GPS coordinates** from the browser, not the IP
address, so a VPN cannot fake it. VPN detection itself uses the IP, before the
location prompt.

## How the pieces work

- **Location** — browser Geolocation API (`getCurrentPosition`), always behind
  the OS/browser permission prompt.
- **Address** — BigDataCloud free client reverse-geocode endpoint (no key).
- **VPN flag** — vpnapi.io (needs the free key).
- **Coarse IP city/country** — ipwho.is when no vpnapi key is set.

## Honest limitations

- **VPN detection is never 100%.** IP-reputation services miss new or
  residential-proxy VPNs and occasionally false-positive. Treat it as a filter,
  not a guarantee.
- **GPS accuracy varies.** On a phone it's usually a few metres; on a laptop on
  Wi-Fi it can be hundreds of metres. The page shows the accuracy radius.
- **A visitor can decline.** If they deny the browser prompt, no location is
  collected — by design.
- The third-party lookups run from the visitor's browser; if you set a
  `webhookUrl` or vpnapi key, those services see the request.

## Please use it responsibly

Only send this to people who expect to share their location with you, and keep
the consent notice honest. Don't disguise it as something else or use it to
track a person who hasn't agreed to it — that's what the visible notice and the
browser prompt are there to prevent.
