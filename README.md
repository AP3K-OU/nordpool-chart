# Nordpool price chart with transfer tax

> Currently network service transfer tax works only for Estonia

Includes option to switch between network services:

- Võrk 1
- Võrk 2
- Võrk 2 kuutasuga
- Võrk 4
- Võrk 5

![screenshot of chart](screenshot1.png)

Can see it live at [https://el.ap3k.pro/ee](https://el.ap3k.pro/ee)

## Usage:

- NPM: `npx jsr add @ap3k/nordpool-chart`
- Deno: `deno add @ap3k/nordpool-chart`

Import it in your app entrypoint

`import '@ap3k/nordpool-chart'`

Use custom web component in HTML:

```html
<nordpool-chart apiUrl="https://el.ap3k.pro"></nordpool-chart>
```

It accepts one property which is `apiUrl`. It defaults to
`window.location.origin`
