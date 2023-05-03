// See https://github.com/dialogflow/dialogflow-fulfillment-nodejs
// for Dialogflow fulfillment library docs, samples, and to report issues
'use strict';

import { https, Request, Response } from 'firebase-functions';
import functions = require('firebase-functions');
import { WebhookClient } from 'dialogflow-fulfillment';
import { Card, Suggestion } from 'dialogflow-fulfillment';
import firebaseAdmin = require("firebase-admin");
import { DataSnapshot } from 'firebase-admin/database';
// import firebase = require("firebase/app");

process.env.DEBUG = 'dialogflow:debug'; // enables lib debugging statements

// export const environment = {
//   production: false,
//   firebaseConfig: {
//     apiKey: "AIzaSyADzMHtzGeCd7Bjk1ME8ahn3N95yL5z5iQ",
//     authDomain: "deracbot-9da9f.firebaseapp.com",
//     databaseURL: "https://deracbot-9da9f-default-rtdb.firebaseio.com",
//     projectId: "deracbot-9da9f",
//     storageBucket: "deracbot-9da9f.appspot.com",
//     messagingSenderId: "327411191935",
//     appId: "1:327411191935:web:ec0e9b463bcbc42ff0af4a"
//   }
// };

// let serviceAccount = require("../../test-project-key.json");
// import params = require('firebase-functions/params');


const app = firebaseAdmin.initializeApp(functions.config().firebase);
// firebaseAdmin.initializeApp({
//   credential: firebaseAdmin.credential.cert({
//     projectId: params.projectID,
//     clientEmail: params.c,
//     privateKey: params.privateKey
//   }),
//   databaseURL: "https://deracbot-9da9f-default-rtdb.firebaseio.com/",
//   projectId: params.projectID.value
// });

const db = firebaseAdmin.firestore();

exports.dialogflowFirebaseFulfillment = https.onRequest((request: Request, response: Response) => {
  const _agent = new WebhookClient({ request: request, response: response });
  // const fs = firebaseAdmin.firestore();
  // const db = firebaseAdmin.database();

  console.log('Dialogflow Request headers: ' + JSON.stringify(request.headers));
  console.log('Dialogflow Request body: ' + JSON.stringify(request.body));
  console.log('functions.config().firebase: ' + JSON.stringify(functions.config().firebase));
  console.log('functions.config().firebase: ' + JSON.stringify(app));

  function GetStatusIsencao(agent: WebhookClient) {
    console.log('Rodando GetStatusIsencao');
    var matricula = agent.parameters.matricula;
    return firebaseAdmin.database(app).ref("matricula").once("value").then((snapshot: DataSnapshot) => {
      // var isencaoStatus = snapshot.val();
      // agent.add("Status da sua isencao: " + isencaoStatus);
    });
    // agent.add("Webhook code: I didn't understand");
    // agent.add("Webhook code: I'm sorry, can you try again?");
  }

  function NovaIsencao(agent: WebhookClient) {
    console.log('NovaIsencao');
    // agent.add("Webhook code: Welcome to my agent!");
    return firebaseAdmin.database(app).ref("teste").once("value").then(
      (snapshot: DataSnapshot) => {
        console.log('NovaIsencao: SUCESSO: ' + JSON.stringify(snapshot));
      },
      (reason: any) => {
        console.log('NovaIsencao: FALHA: ' + JSON.stringify(reason));
      }
    )
  }

  // // Uncomment and edit to make your own intent handler
  // // uncomment `intentMap.set('your intent name here', yourFunctionHandler);`
  // // below to get this function to be run when a Dialogflow intent is matched
  // function yourFunctionHandler(agent: WebhookClient) {
  //   agent.add(`This message is from Dialogflow's Cloud Functions for Firebase editor!`);
  //   agent.add(new Card({
  //       title: `Title: this is a card title`,
  //       imageUrl: 'https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png',
  //       text: `This is the body text of a card.  You can even use line\n  breaks and emoji! 💁`,
  //       buttonText: 'This is a button',
  //       buttonUrl: 'https://assistant.google.com/'
  //     })
  //   );
  //   agent.add(new Suggestion(`Quick Reply`));
  //   agent.add(new Suggestion(`Suggestion`));
  //   agent.setContext({ name: 'weather', lifespan: 2, parameters: { city: 'Rome' }});
  // }

  // Run the proper function handler based on the matched Dialogflow intent name
  let intentMap = new Map();
  intentMap.set("GetStatusIsencao", GetStatusIsencao);
  intentMap.set("NovaIsencao", NovaIsencao);
  intentMap.set("fetchTest", GetStatusIsencao);
  // intentMap.set('your intent name here', yourFunctionHandler);
  _agent.handleRequest(intentMap);
});
