# Botderac

The DeracBot Project is a chatbot developed to assist students of CEFET-RJ (Maracanã Campus) in registering exemption requests for courses. The chatbot is integrated with various components and resources, including Node.js, Google Cloud Functions, Google Cloud Firestore, Google DialogFlow ES, and the Facebook infrastructure.

## Node.js environment

In order to ensure that the correct dependencies are installed, one MAY chose to run the following [commands](https://firebase.google.com/docs/functions/get-started?hl=pt-br) inside the project's root directory:

Bash

```bash
npm install -g firebase-tools
firebase login
firebase init firestore
firebase init functions
cd functions
npm uninstall --save-dev firebase-functions-test
npm install --save-dev actions-on-google
npm install
```

**Optional**: check the installation. The following commands should print node version v18.16.0 or greater and npm version 9.7.1 or greater:

```bash
node --version
npm --version
```

[Here](https://nodejs.org/en/download/releases) are some Node.js + NPM pair version.

## Running

To start all, build the scrip, then run the emulators:

Bash

```bash
cd functions
npm run build
cd ..
firebase emulators:start
```
