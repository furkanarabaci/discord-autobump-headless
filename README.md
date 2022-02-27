# Discord Headless AutoBump

> This service does not violate Discord ToS. However, I still do not endorse usage of this service since it might still result on ban or suspend of your account.

## Usage

This service uses `playwright` to simulate browser actions and executes it headlessly.

> It is recommended to use node version as at least 14.

1. Launch this command: `cp .env.template .env`
2. Fill your authorization information on the `.env` file. DO NOT EVER COMMIT THIS FILE OR REMOVE FROM .GITIGNORE
3. Create a `state.json` file on your root or the value you have at `STORAGE_SAVE_LOCATION` variable.
4. Execute the following commands:

```
yarn
yarn build
yarn start
```

If you want to use this as a service under Linux (tested on Ubuntu Server 20.04), simply run these commands:

```
node index.js > log.txt 2>&1 &
echo $! > /tmp/discord-autobump.pid
```

## LICENSE

This project is licensed under MIT.
