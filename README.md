# Somnia Exchange Bot

This guide will walk you through the setup and deployment of a Somnia Exchange Bot.

## ⚠️ Minimum Requirements

Ensure your environment meets these requirements:

| Component | Required Version | Installation Link                              |
| --------- | ---------------- | ---------------------------------------------- |
| NodeJS    | latest           | [Installation](https://nodejs.org/en/download) |

## 📝 Setup Environment

1. Clone Somnia Exchange Bot project from [this repository](https://github.com/mrhabibie/somnia-exchange-bot) :
   - HTTPS
     ```bash
     $ git clone https://github.com/mrhabibie/somnia-exchange-bot
     ```
   - SSH
     ```bash
     $ git clone git@github.com:mrhabibie/somnia-exchange-bot.git
     ```
2. Move to project directory :
   ```bash
   $ cd somnia-exchange-bot
   ```
3. Install all the required project dependencies :
   ```bash
   $ npm install
   ```
4. Create new file called `keys.txt` :
   ```bash
   $ touch keys.txt
   ```
5. Paste your wallet private key at `keys.txt` file.
6. Copy `.env.example` to `.env` :
   ```bash
   $ cp .env.example .env
   ```

## 🖥️ Pro Tips

If you're running using VPS, you can use `screen` to running this bot at background :

```bash
$ screen -S somnia-exchange-bot
```

Detach from current active screen using `CTRL + A + D` in Windows/Linux or `^ + A + D` in macOS.

Re-attach to specific screen using this command :

```bash
$ screen -r somnia-exchange-bot
```

## 🚀 Running the Bot

1. Make sure [Setup Environment](#-setup-environment) are done.
2. To start the application locally :
   ```bash
   $ npm run start
   ```
   And your bot will running smoothly.

## Developer Info

Having problem with this project?
[Contact me](https://t.me/mrhabibie).
