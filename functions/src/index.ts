// The Cloud Functions for Firebase SDK to create Cloud Functions and set up triggers.
import * as functions from "firebase-functions";
import { Request } from "firebase-functions/lib/common/providers/https";
import { Response } from "firebase-functions/lib/v1";

// The Firebase Admin SDK to access Firestore.
import * as admin from "firebase-admin";
admin.initializeApp();

// Fulfillment
import { WebhookClient } from 'dialogflow-fulfillment';
import { DocumentData, QuerySnapshot, Firestore, WriteBatch, QueryDocumentSnapshot } from "firebase-admin/firestore";


// Enumeration
// type StatusIsencao =
//     | "DEFERIDO"
//     | "INDEFERIDO"
//     | "ABERTO";


// Long type name aliases
type FirestoreCountQuerySnapshot = FirebaseFirestore.AggregateQuerySnapshot<{ count: FirebaseFirestore.AggregateField<number> }>;
type IntentHandlerFunction = (agent: WebhookClient) => void | Promise<void>;


// Auxliar function
function logDefered(text: String): void {
    setTimeout(() => {
        console.log(text);
    }, 1000);
}

function onRejected(reason: any): void {
    logDefered(`REJECTED! ${reason}`);
}

function onCatch(reason: any): void {
    logDefered(`EXCEPTION! ${reason}`);
}

function emptyPromise(): Promise<void> {
    return new Promise<void>((): void => { })
}

// Main code
exports.dialogflowFirebaseFulfillment = functions.https.onRequest((request: Request, response: Response<any>): void => {
    const _agent: WebhookClient = new WebhookClient({ request: request, response: response });

    // Reference: https://googleapis.dev/nodejs/firestore/latest/Firestore.html
    const firestore: Firestore = admin.firestore();
    logDefered("Chamou. Body: " + request.rawBody.toString("utf-8"));

    async function IniciarChat(agent: WebhookClient): Promise<void> {
        logDefered("Running IniciarChat");
        // Reference: https://groups.google.com/g/dialogflow-cx-edition-users/c/jajSEPqhYZE?pli=1
        // Workaround avoid timeout and also works as health check

        // Reference: https://googleapis.dev/nodejs/firestore/latest/CollectionReference.html#select-examples
        try {
            await firestore.collection("CURSO").count().get();
            agent.add("Olá! Voce quer pedir isenção de uma materia ou conferir o status de um pedido já aberto?");
        } catch (e) {
            onCatch(e);
        }
    }

    async function GetStatusIsencao(agent: WebhookClient): Promise<void> {
        const matricula = agent.parameters.matricula;
        logDefered("Running GetStatusIsencao");

        try {
            const res: QuerySnapshot<DocumentData> = await firestore.collection("REQUISICAO")
                .where("MATRICULA", "!=", "MATRICULA_MOCK")
                .where("MATRICULA", "==", matricula)
                .select("DATA_CADASTRO", "SITUACAO")
                .orderBy("DATA_CADASTRO", "desc")
                .limit(1)
                .select("SITUACAO")
                .get();

            let resposta = "";
            if (res.size == 0) {
                resposta = `Nenhum pedido de isenção encontrado para ${matricula}.`;
            } else {
                const ultimo = res.size == 1 ? "do" : "do último";
                resposta = `O status ${ultimo} pedido de isenção de ${matricula} é: ${res.docs[0].get("SITUACAO")}.`;
            }

            agent.add(resposta);
            logDefered(resposta);
        } catch (e) {
            onCatch(e);
        }
    }

    async function NovaIsencao(agent: WebhookClient): Promise<void> {
        logDefered("Running NovaIsencao");

        // Auxiliar letiables
        const matricula: string = agent.parameters.matricula;
        const id_curso: string = agent.parameters.id_curso;

        // Conferir se a matrícula foi inserida
        logDefered(`matricula: '${matricula}'`);
        if (!matricula) {
            return;
        }

        // Conferir se a matrícula inserida tem alguma requisicao aberta
        try {
            const res: QuerySnapshot<DocumentData> = await firestore.collection("REQUISICAO")
                .where("MATRICULA", "!=", "MATRICULA_MOCK")
                .where("MATRICULA", "==", matricula)
                .where("SITUACAO", "==", "ABERTO")
                .orderBy("DATA_CADASTRO", "asc")
                .limit(1)
                .select("DATA_CADASTRO")
                .get();

            // A matrícula inserida tem uma requisicao aberta
            let resposta = "";
            if (res.size > 0) {
                const dataRequisicao = res.docs[0].get("DATA_CADASTRO")
                resposta = `A matrícula ${matricula} possui uma solicitação ABERTA realizada na data ${dataRequisicao}.`;

                agent.add(resposta);
                logDefered(resposta);
                return;
            }

            // Função para listar todos os cursos disponíveis
            let listCourses = async (): Promise<void> => {
                const res: QuerySnapshot<DocumentData> = await firestore.collection("CURSO")
                    .where("ID_CURSO", "!=", "CURSO_MOCK")
                    .select("ID_CURSO", "NOME")
                    .orderBy("ID_CURSO", "asc")
                    .get();

                let resposta = "";
                if (res.size == 0) {
                    resposta = `Nenhum curso cadastrado. Entre em contato com o DERAC.`;
                } else {
                    for (let i = 0; i != res.size; ++i) {
                        resposta += `${res.docs[i].get("ID_CURSO")} - ${res.docs[i].get("NOME")}\n`;
                    }
                }

                agent.add(resposta);
                logDefered(resposta);
                return;
            }

            // Não preencheu curso ainda: dá opções de cursos
            logDefered(`id_curso: '${id_curso}'`);
            if (!id_curso) {
                return listCourses();
            }

            // Preencheu curso corretamente?
            const res2: QuerySnapshot<DocumentData> = await firestore.collection("CURSO")
                .where("ID_CURSO", "!=", "CURSO_MOCK")
                .where("ID_CURSO", "==", id_curso)
                .select("ID_CURSO", "NOME")
                .get();

            // Não preencheu curso corretamente
            if (res2.size == 0) {
                return listCourses();
            }

            // Preencheu curso corretamente!
            resposta = `Preencheu curso corretamente! TODO.`;

            agent.add(resposta);
            logDefered(resposta);
            return;

        } catch (e) {
            onCatch(e);
        }
    }


    // // Uncomment and edit to make your own intent handler
    // // uncomment `intentMap.set("your intent name here", yourFunctionHandler);`
    // // below to get this function to be run when a Dialogflow intent is matched
    // function yourFunctionHandler(agent: WebhookClient) {
    //   agent.add(`This message is from Dialogflow's Cloud Functions for Firebase editor!`);
    //   agent.add(new Card({
    //       title: `Title: this is a card title`,
    //       imageUrl: "https://developers.google.com/actions/images/badges/XPM_BADGING_GoogleAssistant_VER.png",
    //       text: `This is the body text of a card.  You can even use line\n  breaks and emoji! 💁`,
    //       buttonText: "This is a button",
    //       buttonUrl: "https://assistant.google.com/"
    //     })
    //   );
    //   agent.add(new Suggestion(`Quick Reply`));
    //   agent.add(new Suggestion(`Suggestion`));
    //   agent.setContext({ name: "weather", lifespan: 2, parameters: { city: "Rome" }});
    // }

    async function PopularBD(agent: WebhookClient): Promise<void> {
        logDefered("Running PopularBD");

        // CLEAN: ALUNO
        const CURSO: Array<any> = JSON.parse("[{\"ID_CURSO\":\"BCC\",\"NOME\":\"Bacharelado em Ciência da Computação\"}]");
        const DISCIPLINA: Array<any> = JSON.parse("[{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GEXT7501\",\"NOME\":\"Álgebra Linear I\"},{\"CARGA_HORARIA\":90,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GEXT7301\",\"NOME\":\"Cálculo a uma Variável\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1101\",\"NOME\":\"Introdução à Administração\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1102\",\"NOME\":\"Arquitetura de Computadores\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1103\",\"NOME\":\"Projeto de Algoritmos Computacionais\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1104\",\"NOME\":\"Lógica Matemática\"},{\"CARGA_HORARIA\":54,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GEXT7502\",\"NOME\":\"Álgebra Linear II\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GEXT7302\",\"NOME\":\"Cálculo a Várias Variáveis\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1205\",\"NOME\":\"Sistemas Operacionais\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1206\",\"NOME\":\"Arquiteturas Avançadas de Computadores\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1207\",\"NOME\":\"Estruturas de Dados\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1208\",\"NOME\":\"Matemática Discreta\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1209\",\"NOME\":\"Ciências Ambientais\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GEXT7303\",\"NOME\":\"Equações Diferenciais Ordinárias\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1309\",\"NOME\":\"Sistemas Digitais\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1310\",\"NOME\":\"Fundamentos de Redes de Computadores\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1311\",\"NOME\":\"Programação Orientada a Objetos\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1312\",\"NOME\":\"Engenharia de Requisitos\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1313\",\"NOME\":\"Empreendedorismo\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1314\",\"NOME\":\"Humanidades e Ciências Sociais\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1416\",\"NOME\":\"Análise e Projeto de Sistemas\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1417\",\"NOME\":\"Projeto de Banco de Dados\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1418\",\"NOME\":\"Organização de Estruturas de Arquivos\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1415\",\"NOME\":\"Programação de Software para Web\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1414\",\"NOME\":\"Gerência de Projetos de Tecnologia da Informação\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1518\",\"NOME\":\"Estatística e Probabilidade\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1519\",\"NOME\":\"Arquitetura de Programação\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1520\",\"NOME\":\"Arquitetura e Padrões de Software\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1521\",\"NOME\":\"Engenharia de Software\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1522\",\"NOME\":\"Administração de Banco de Dados\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1523\",\"NOME\":\"Metodologia Científica\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1624\",\"NOME\":\"Teoria da Computação\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1625\",\"NOME\":\"Inferência Estatística\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1626\",\"NOME\":\"Inteligência Computacional\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1627\",\"NOME\":\"Algoritmos em Grafos\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1628\",\"NOME\":\"Interação Humano-Computador\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1629\",\"NOME\":\"Prática em Pesquisa Aplicada\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1730\",\"NOME\":\"Compiladores\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1731\",\"NOME\":\"Computação Gráfica\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1732\",\"NOME\":\"Sistemas Concorrentes e Distribuídos\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1733\",\"NOME\":\"Projeto e Construção de Sistemas\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1734\",\"NOME\":\"Inteligência Artificial\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1735\",\"NOME\":\"Concepção e Elaboração de Projeto Final\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1836\",\"NOME\":\"Legislação em Informática\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1837\",\"NOME\":\"Informática e Sociedade\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1839\",\"NOME\":\"Elaboração e Construção de Projeto Final\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1910\",\"NOME\":\"Programação de Jogos\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1911\",\"NOME\":\"Aplicações para Dispositivos Móveis\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GEDA7201\",\"NOME\":\"Expressão Oral e Escrita\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GEDA7101\",\"NOME\":\"Economia\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1912\",\"NOME\":\"Gestão de Tecnologia da Informação\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1913\",\"NOME\":\"Inteligência de Negócios\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GADM7743\",\"NOME\":\"Responsabilidade Social\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GADM7763\",\"NOME\":\"Instituições do Direito\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GADM7741\",\"NOME\":\"Gestão Estratégica\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GADM7756\",\"NOME\":\"Economia Brasileira\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GADM7731\",\"NOME\":\"Simulações Empresariais\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GADM7708\",\"NOME\":\"Microeconomia\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1914\",\"NOME\":\"Tópicos Especiais em Inteligência Computacional\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1915\",\"NOME\":\"Programação em Lógica\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1916\",\"NOME\":\"Simulações Computacionais\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1917\",\"NOME\":\"Tópicos Especiais em Programação I\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1918\",\"NOME\":\"Tópicos Especiais em Programação II\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1919\",\"NOME\":\"Tópicos Especiais em Programação III\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1920\",\"NOME\":\"Tópicos Especiais em Programação IV\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GADM7761\",\"NOME\":\"Inovações Tecnológicas\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1921\",\"NOME\":\"Aplicações na Internet para TV Digital Interativa\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GADM7765\",\"NOME\":\"Práticas em Responsabilidade Socioambiental\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1924\",\"NOME\":\"LIBRAS – Língua Brasileira de Sinais\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1924\",\"NOME\":\"LIBRAS – Língua Brasileira de Sinais\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1925\",\"NOME\":\"Programação de Clientes Web\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1926\",\"NOME\":\"Gerência de Dados Semiestruturados\"},{\"CARGA_HORARIA\":54,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GEXT7304\",\"NOME\":\"Equações Diferenciais Parciais e Séries (EDPS)\"},{\"CARGA_HORARIA\":54,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GEXT7306\",\"NOME\":\"Variáveis Complexas\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GEXT7503\",\"NOME\":\"Cálculo Vetorial\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1922\",\"NOME\":\"Segurança da Informação\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1927\",\"NOME\":\"Desenvolvimento de Aplicações Ricas para Internet\"},{\"CARGA_HORARIA\":72,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GCC1928\",\"NOME\":\"Programação de Servidores WEB\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GLEA1079\",\"NOME\":\"Direito Empresarial\"},{\"CARGA_HORARIA\":36,\"ID_CURSO\":\"BCC\",\"ID_DISCIPLINA\":\"GLEA1081\",\"NOME\":\"Inglês Básico\"}]");
        // CLEAN: REQUISICAO

        const fsBatch: WriteBatch = firestore.batch();
        let countResult: FirestoreCountQuerySnapshot;
        let hasSchedule: boolean = false;

        try {
            countResult = await firestore.collection("ALUNO").where("MATRICULA", "==", "MATRICULA_MOCK").count().get();
            if (countResult.data().count == 0) {
                logDefered("Scheduling restore of 'ALUNO' collection (MOCK).");
                hasSchedule = true;

                fsBatch.create(firestore.collection("ALUNO").doc(), {
                    ID_CURSO: "CURSO_MOCK",
                    MATRICULA: "MATRICULA_MOCK",
                    NOME_COMPLETO: "MOCK"
                });
            }

            countResult = await firestore.collection("ALUNO").where("MATRICULA", "!=", "MATRICULA_MOCK").count().get();
            if (countResult.data().count != 0) {
                logDefered("Scheduling restore of 'ALUNO' collection.");
                hasSchedule = true;

                const snapshot: QuerySnapshot<DocumentData> = await firestore.collection("ALUNO")
                    .where("MATRICULA", "!=", "MATRICULA_MOCK")
                    .select()
                    .get();

                snapshot.forEach((document: QueryDocumentSnapshot<DocumentData>): void => {
                    fsBatch.delete(document.ref);
                });
            }

            countResult = await firestore.collection("CURSO").where("ID_CURSO", "==", "CURSO_MOCK").count().get();
            if (countResult.data().count == 0) {
                logDefered("Scheduling restore of 'CURSO' collection (MOCK).");
                hasSchedule = true;

                fsBatch.create(firestore.collection("CURSO").doc(), {
                    ID_CURSO: "CURSO_MOCK",
                    NOME: "MOCK"
                });
            }

            countResult = await firestore.collection("CURSO").where("ID_CURSO", "!=", "CURSO_MOCK").count().get();
            if (countResult.data().count != CURSO.length) {
                logDefered("Scheduling restore of 'CURSO' collection.");
                hasSchedule = true;

                const snapshot: QuerySnapshot<DocumentData> = await firestore.collection("CURSO")
                    .where("ID_CURSO", "!=", "CURSO_MOCK")
                    .select()
                    .get();

                snapshot.forEach((document: QueryDocumentSnapshot<DocumentData>): void => {
                    fsBatch.delete(document.ref);
                });

                for (let i = 0; i != CURSO.length; ++i) {
                    fsBatch.create(firestore.collection("CURSO").doc(), CURSO[i]);
                }
            }

            countResult = await firestore.collection("DISCIPLINA").where("ID_DISCIPLINA", "==", "DISCIPLINA_MOCK").count().get();
            if (countResult.data().count == 0) {
                logDefered("Scheduling restore of 'DISCIPLINA' collection (MOCK).");
                hasSchedule = true;

                fsBatch.create(firestore.collection("DISCIPLINA").doc(), {
                    CARGA_HORARIA: 0,
                    ID_CURSO: "CURSO_MOCK",
                    ID_DISCIPLINA: "DISCIPLINA_MOCK",
                    NOME: "MOCK"
                });
            }

            countResult = await firestore.collection("DISCIPLINA").where("ID_DISCIPLINA", "!=", "DISCIPLINA_MOCK").count().get();
            if (countResult.data().count != DISCIPLINA.length) {
                logDefered("Scheduling restore of 'DISCIPLINA' collection.");
                hasSchedule = true;

                const snapshot: QuerySnapshot<DocumentData> = await firestore.collection("DISCIPLINA")
                    .where("ID_DISCIPLINA", "!=", "DISCIPLINA_MOCK")
                    .select()
                    .get();

                snapshot.forEach((document: QueryDocumentSnapshot<DocumentData>): void => {
                    fsBatch.delete(document.ref);
                });

                for (let i = 0; i != DISCIPLINA.length; ++i) {
                    fsBatch.create(firestore.collection("DISCIPLINA").doc(), DISCIPLINA[i]);
                }
            }

            countResult = await firestore.collection("REQUISICAO").where("MATRICULA", "==", "MATRICULA_MOCK").count().get();
            if (countResult.data().count == 0) {
                logDefered("Scheduling restore of 'REQUISICAO' collection (MOCK).");
                hasSchedule = true;

                fsBatch.create(firestore.collection("REQUISICAO").doc(), {
                    DATA_CADASTRO: new Date(),
                    ESTRUTURA_CURRICULAR: "",
                    MATRICULA: "MATRICULA_MOCK",
                    SITUACAO: "ABERTO"
                });
            }

            countResult = await firestore.collection("REQUISICAO").where("MATRICULA", "!=", "MATRICULA_MOCK").count().get();
            if (countResult.data().count != 0) {
                logDefered("Scheduling restore of 'REQUISICAO' collection.");
                hasSchedule = true;

                const snapshot: QuerySnapshot<DocumentData> = await firestore.collection("REQUISICAO")
                    .where("MATRICULA", "!=", "MATRICULA_MOCK")
                    .select()
                    .get();

                snapshot.forEach((document: QueryDocumentSnapshot<DocumentData>): void => {
                    fsBatch.delete(document.ref);
                });
            }

            // Commits the batch, if required
            if (hasSchedule) {
                logDefered("Commiting scheduled writes...");
                await fsBatch.commit();
                logDefered("Done!");
            }

            // Send success message
            agent.add("Sucesso! Base de dados restaurada.");

        } catch (e) {
            onCatch(e);
            agent.add(`Falha! Exceção: ${e}`);
        }
    }

    // Run the proper function handler based on the matched Dialogflow intent name
    let intentMap = new Map<string, IntentHandlerFunction>();
    intentMap.set("IniciarChat", IniciarChat);
    intentMap.set("GetStatusIsencao", GetStatusIsencao);
    intentMap.set("NovaIsencao", NovaIsencao);
    intentMap.set("PopularBD", PopularBD);
    // intentMap.set("fetchTest", GetStatusIsencao);
    // intentMap.set("your intent name here", yourFunctionHandler);
    _agent.handleRequest(intentMap).catch(onCatch);
});


// Take the text parameter passed to this HTTP endpoint and insert it into
// Firestore under the path /curso/:documentId/ID_CURSO
// exports.addCurso = functions.https.onRequest(async (req, resp) => {
//     // // Grab the text parameter.
//     // const parametro = req.query.text;
//     // // Push the new message into Firestore using the Firebase Admin SDK.
//     // const writeResult = await admin.firestore().collection("CURSO").add({ ID_CURSO: parametro, NOME: "TMP" });
//     // // Send back a message that we've successfully written the message
//     // res.json({ result: `Message with ID: ${writeResult.id} added.` });

//     console.log('Rodando addCurso');
//     //const matricula = agent.parameters.matricula;

//     // import { collection, query, where } from "firebase/firestore";
//     // Reference: https://googleapis.dev/nodejs/firestore/latest/Firestore.html
//     const firestore = admin.firestore()

//     // Reference: https://googleapis.dev/nodejs/firestore/latest/CollectionReference.html#select-examples
//     return firestore.collection("CURSO").where("ID_CURSO", "==", "abc").select("ID_CURSO", "NOME").get().then((res: admin.firestore.QuerySnapshot<admin.firestore.DocumentData>) => {
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
