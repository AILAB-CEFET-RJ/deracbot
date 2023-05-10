# Botderac

Add project summary.

## Python

This repository requires the environment to have python installed in order to run the following commands:

[Bash/CMD](https://pypi.org/project/nodeenv)

```bash
python3 -m pip install nodeenv
```

## Node.js virtual environment

In order to ensure that the correct dependencies are installed, one MAY chose to run the following [commands](https://firebase.google.com/docs/functions/get-started?hl=pt-br) inside the project's root directory (which create a [Node.js](https://nodejs.org/pt-br/download/releases) virtual environment) before using the module:

Bash

```bash
python3 -m nodeenv --node=14.21.3 --npm=6.14.18 --with-npm .venv
source .venv/Scripts/activate
npm install -g firebase-tools
firebase login
firebase init firestore
firebase init functions
cd functions
npm uninstall --save-dev firebase-functions-test
npm install --save-dev actions-on-google@^2.4.1
npm install
```

CMD

```bash
python3 -m nodeenv --node=14.21.3 --npm=6.14.18 --with-npm .venv
.venv\Scripts\activate.bat
npm install -g firebase-tools
firebase login
firebase init firestore
firebase init functions
cd functions
npm uninstall --save-dev firebase-functions-test
npm install --save-dev actions-on-google@^2.4.1
npm install
```

Power Shell

```powershell
python3 -m nodeenv --node=14.21.3 --npm=6.14.18 --with-npm .venv
.venv\Scripts\Activate.ps1
npm install -g firebase-tools
firebase login
firebase init firestore
firebase init functions
cd functions
npm uninstall --save-dev firebase-functions-test
npm install --save-dev actions-on-google@^2.4.1
npm install
```

**Note**: the Node.js virtual environment creation is an optional step if already have Node 10 and NPM 6 installed on your environment. Skip the first two lines if the correct environment is already set up.

**Optional**: check the installation. The following commands should print node version 10.24.1 and npm version 6.14.12:

```bash
node --version
npm --version
```

## Running

To start all, build the scrip, then run the emulators:

Bash

```bash
source .venv/Scripts/activate
cd functions
npm cache clean -force
npm run build
cd ..
firebase emulators:start
```

CMD

```bash
.venv\Scripts\activate.bat
cd functions
npm cache clean -force
npm run build
cd ..
firebase emulators:start
```

Power Shell

```powershell
.venv\Scripts\Activate.ps1
cd functions
npm cache clean -force
npm run build
cd ..
firebase emulators:start
```
