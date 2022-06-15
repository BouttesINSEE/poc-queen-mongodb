import http from 'k6/http';
import { check, sleep } from 'k6';



export const options = {
  stages: [
    { duration: "30s", target: 20 }, // simulate ramp-up of traffic from 1 to ${__ENV.VUS} users over 20 minutes.
    { duration: "1m30s", target: 20 }, // stay at ${__ENV.VUS} users for 60m minutes
    { duration: "20s", target: 0 }, // ramp-down to 0 users over 20 minutes
  ],
  //vus: 1,
  //iterations: 1,
  //duration: "3600s",
  setupTimeout: "300s",
};

const nbQuestions = 70;
const iterMax = 20;

function safeGet(url) {
  const { status, body } = http.get(url);
  if (status != 200) {
    throw new Error(`Setup failed : GET ${url} ${status}`);
  }
  return  JSON.parse(body);
}



export function setup() {

  const idCampaign = "kwi5uegy3101";

  const length = 20 * iterMax;
  
  /** on génère plus mais on prend ce qu'on a généré**/ 
  
  /**const arrIdSurveyUnit = safeGet(
    "https://raw.githubusercontent.com/BouttesINSEE/poc-queen-mongodb/main/load-test/Data/Data.json"
  ); **/

  const arrData = safeGet(
    "https://raw.githubusercontent.com/BouttesINSEE/poc-queen-mongodb/main/load-test/Data/Data.json"
  );

  const arrParadata = safeGet(
    "https://raw.githubusercontent.com/BouttesINSEE/poc-queen-mongodb/main/load-test/Data/Paradata.json"
  );


  const arrStateData = safeGet(
    "https://raw.githubusercontent.com/BouttesINSEE/poc-queen-mongodb/main/load-test/Data/State-Data.json"
  );

  return {
    idCampaign,
    arrIdSurveyUnit,
    arrData,
    arrParadata,
  };
}

export default function (data) {
  /****Init : get model, metadata and nomenclatures****/
  group("Init questionnaire", function () {
    const { idCampaign } = data;

    const res = http.get(
      `https://demoqueenmongo.dev.insee.io/api/campaign/${idCampaign}/questionnaire`
    );

    check(res, {
      "status 200 get questionnaire model": (r) => r.status === 200,
    });

    const res2 = http.get(
      `https://demoqueenmongo.dev.insee.io/api/campaign/${idCampaign}/metadata`
    );
    check(res2, {
      "status 200 get campaign metadata": (r) => r.status === 200,
    });

    const res3 = http.get(
      `https://demoqueenmongo.dev.insee.io/api/campaign/${idCampaign}/required-nomenclatures`
    );
    check(res3, {
      "status 200 get required-nomenclatures": (r) => r.status === 200,
    });

    res3.json().forEach(function (elt) {
      const res4 = http.get(
        `https://demoqueenmongo.dev.insee.io/api/nomenclature/${elt}`
      );
      check(res4, { "status 200 get nomenclature": (r) => r.status === 200 });
    });
  });



  /****Filling out questionnaire and paradata****/
  group("Filling out questionnaire", function () {
    const currentId = (20 - 1) * iterMax + __ITER
    const idSurveyUnit = data.arrIdSurveyUnit[currentId];
    const end = 70;
    function fillingOutQuestions(end, current = 0) {
      if (current < end) {
        const iterationData = data.arrData[current];
        const iterationParadata = data.arrParadata[current];

        const params = { headers: { "Content-type": "application/json" } };

        const res5 = http.put(
          `https://demoqueenmongo.dev.insee.io/api/survey-unit/${idSurveyUnit}/data`,
          iterationData,
          params
        );
        check(res5, { "status 200 put": (r) => r.status === 200 });

        const res6 = http.post(
          `https://demoqueenmongo.dev.insee.io/api/paradata`, /* pioche dedans et random(2,10) */
          iterationParadata,
          params
        );
        check(res6, { "status 200 post": (r) => r.status === 200 });
            /*rajouter les PUT/ state-data incrémenation de la page de 1 */
        sleep(3 + Math.random() * 7);

        fillingOutQuestions(end, current + 1);
      }
    }
    fillingOutQuestions(data.arrData.length);
  }); 
}