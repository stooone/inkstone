![Inkstone in action](http://i.imgur.com/FetiXVc.gif)

### Introduction

Inkstone is a mobile-friendly web app for people who want to learn to read and
write Mandarin. It's **totally free**, **open-source**, and can be used
**without an Internet connection**! Inkstone is licensed under the
[GNU General Public License v3.0](https://www.gnu.org/licenses/gpl-3.0.en.html).
It has quite a few features:

- Tap for a hint, double-tap for a walkthrough
- Stroke recognition and automatic grading
- Spaced-repetition-based scheduling
- Help pages and stroke-order animations for every character
- Bundled word lists: radicals and all HSK levels
- Settings that give you control over scheduling
- Support for custom word lists

### Project History & Fork Notice

This project is a modern fork of the original [Inkstone app by Shaunak Kishore](https://github.com/skishore/inkstone). 

**What changed:**
The original project was built using the Meteor framework and wrapped as an Android app using Cordova. This modernized version was completely rewritten by **Peter Karoly "Stone" JUHASZ** (with the help of Antigravity) to ditch the heavy legacy dependencies (Meteor, Cordova, jQuery, Underscore) and port the application to a lightning-fast, lightweight **Vite + Preact** Progressive Web App (PWA).

All user data and spaced-repetition progress is now stored securely in the browser using IndexedDB. The app can be installed directly to your phone's home screen from the browser and works fully offline.

### Building and Running from Source

To build and run Inkstone, you will need [Node.js](https://nodejs.org/) installed on your machine.

1. Clone the repository and install dependencies:
```bash
npm install
```

2. Start the local development server:
```bash
npm run dev
```

3. Build the production application:
```bash
npm run build
```
This will generate a `dist/` directory containing the purely static HTML/JS/CSS files. You can host this `dist/` folder on any web server (Nginx, Apache, GitHub Pages, Vercel, etc.) and it will function perfectly.

### Open source credits

[Inkstone was made possible by a number of other open-source projects,
a full listing of which can be found here.](https://www.skishore.me/inkstone/docs/credits.html)
