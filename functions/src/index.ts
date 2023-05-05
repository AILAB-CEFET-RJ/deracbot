// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
import * as functions from "firebase-functions";
import { Request } from "firebase-functions/lib/common/providers/https";
import { Response } from "firebase-functions/lib/v1";

// The Firebase Admin SDK to access Firestore.
import * as admin from "firebase-admin";
admin.initializeApp();

// Fulfillment
import { WebhookClient } from 'dialogflow-fulfillment';
import { DocumentData, QuerySnapshot } from "firebase-admin/firestore";

// Long type name aliases
type FirestoreCountQuerySnapshot = FirebaseFirestore.AggregateQuerySnapshot<{ count: FirebaseFirestore.AggregateField<number> }>;
type IntentHandlerFunction = (agent: WebhookClient) => void;

exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request: Request, response: Response<any>) => {
    const _agent = new WebhookClient({ request: request, response: response });

    // Reference: https://googleapis.dev/nodejs/firestore/latest/Firestore.html
    const firestore = admin.firestore();

    function IniciarChat(agent: WebhookClient) {
        // Reference: https://groups.google.com/g/dialogflow-cx-edition-users/c/jajSEPqhYZE?pli=1
        // Workaround avoid timeout/health check

        // Reference: https://googleapis.dev/nodejs/firestore/latest/CollectionReference.html#select-examples
        return firestore.collection('CURSO')
            .count()
            .get()
            .then((res: FirestoreCountQuerySnapshot) => {
                agent.add("Olá! Voce quer pedir isenção de uma materia ou conferir o status de um pedido já aberto?");
            });
    }

    function GetStatusIsencao(agent: WebhookClient) {
        const matricula = agent.parameters.matricula;
        setTimeout(() => {
            console.log('Rodando GetStatusIsencao');
        }, 0);

        // Reference: https://googleapis.dev/nodejs/firestore/latest/CollectionReference.html#select-examples
        return firestore.collection('REQUISICAO')
            .where("MATRICULA", "==", matricula)
            .select("DATA_CADASTRO", "SITUACAO")
            .orderBy("DATA_CADASTRO", "desc")
            .limit(1)
            .select("SITUACAO")
            .get()
            .then((res: QuerySnapshot<DocumentData>) => {
                var resposta = "";
                if (res.size == 0) {
                    resposta = `Nenhum pedido de isenção encontrado para ${matricula}.`;
                } else {
                    const ultimo = res.size == 1 ? "do" : "do último";
                    resposta = `O status ${ultimo} pedido de isenção de ${matricula} é: ${res.docs[0].get("SITUACAO")}.`;
                }

                agent.add("UHUL");
                agent.add(resposta);
                agent.add("WOW");
                setTimeout(() => {
                    console.log(resposta);
                }, 0);
            });
    }

    // function NovaIsencao(agent: WebhookClient) {
    //     console.log('NovaIsencao');
    //     // agent.add("Webhook code: Welcome to my agent!");
    //     return admin.database().ref("teste").once("value").then(
    //         (snapshot: DataSnapshot) => {
    //             console.log('NovaIsencao: SUCESSO: ' + JSON.stringify(snapshot));
    //         },
    //         (reason: any) => {
    //             console.log('NovaIsencao: FALHA: ' + JSON.stringify(reason));
    //         }
    //     )
    // }

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
    let intentMap = new Map<string, IntentHandlerFunction>();
    intentMap.set("IniciarChat", IniciarChat);
    intentMap.set("GetStatusIsencao", GetStatusIsencao);
    // intentMap.set("NovaIsencao", NovaIsencao);
    // intentMap.set("fetchTest", GetStatusIsencao);
    // intentMap.set('your intent name here', yourFunctionHandler);
    _agent.handleRequest(intentMap);
});


// Take the text parameter passed to this HTTP endpoint and insert it into
// Firestore under the path /curso/:documentId/ID_CURSO
// exports.addCurso = functions.https.onRequest(async (req, resp) => {
//     // // Grab the text parameter.
//     // const parametro = req.query.text;
//     // // Push the new message into Firestore using the Firebase Admin SDK.
//     // const writeResult = await admin.firestore().collection('curso').add({ ID_CURSO: parametro, NOME: "TMP" });
//     // // Send back a message that we've successfully written the message
//     // res.json({ result: `Message with ID: ${writeResult.id} added.` });

//     console.log('Rodando addCurso');
//     //const matricula = agent.parameters.matricula;

//     // import { collection, query, where } from "firebase/firestore";
//     // Reference: https://googleapis.dev/nodejs/firestore/latest/Firestore.html
//     const firestore = admin.firestore()

//     // Reference: https://googleapis.dev/nodejs/firestore/latest/CollectionReference.html#select-examples
//     return firestore.collection('curso').where("ID_CURSO", "==", "abc").select("ID_CURSO", "NOME").get().then((res: admin.firestore.QuerySnapshot<admin.firestore.DocumentData>) => {
//         console.log(`Objeto retornado: ${JSON.stringify(res.docs)}.`);
//         resp.json({ result: "Webhook code: UHUL " + "matricula" });
//     });
// });

// Listens for new messages added to /messages/:documentId/original and creates an
// uppercase version of the message to /messages/:documentId/uppercase
// exports.makeUppercase = functions.firestore.document('/messages/{documentId}')
//     .onCreate((snap, context) => {
//       // Grab the current value of what was written to Firestore.
//       const original = snap.data().original;

//       // Access the parameter `{documentId}` with `context.params`
//       functions.logger.log('Uppercasing', context.params.documentId, original);

//       const uppercase = original.toUpperCase();

//       // You must return a Promise when performing asynchronous tasks inside a Functions such as
//       // writing to Firestore.
//       // Setting an 'uppercase' field in Firestore document returns a Promise.
//       return snap.ref.set({uppercase}, {merge: true});
//     });
